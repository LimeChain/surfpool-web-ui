import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callMCPTool, fetchMCPTools } from './ai-client';
import { createGoonfiPriceScenario, fetchGoonfiMarkets } from './scenarios-api';

vi.mock('./ai-client', () => ({
  fetchMCPTools: vi.fn(),
  callMCPTool: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(fetchMCPTools).mockResolvedValue({ tools: [], sessionId: 'goonfi-session' });
  vi.mocked(callMCPTool).mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({ url: '/scenario?id=goonfi-scenario' }) }],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('fetchGoonfiMarkets', () => {
  it('loads live market addresses through MCP without fetching a template snapshot', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.mocked(callMCPTool).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            markets: [
              { label: ' SOL/USDC ', address: ' market-account ', oracle: 'oracle-account' },
              { label: 'Missing address', oracle: 'oracle-only' },
              { label: ' ', address: 'unlabeled' },
              { label: 'cbBTC/USDC', address: 'second-market' },
            ],
          }),
        },
      ],
    });

    await expect(fetchGoonfiMarkets('http://studio')).resolves.toEqual([
      { label: 'SOL/USDC', value: 'market-account' },
      { label: 'cbBTC/USDC', value: 'second-market' },
    ]);
    expect(callMCPTool).toHaveBeenCalledWith('http://studio', 'list_goonfi_markets', {}, 'goonfi-session');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['empty catalog', '{"markets":[]}'],
    ['discovery error', '{"error":"Discovery failed"}'],
    ['invalid catalog', '{"markets":{}}'],
    ['malformed JSON', 'Unavailable'],
  ])('returns an empty list for %s without loading a snapshot', async (_description, text) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.mocked(callMCPTool).mockResolvedValue({ content: [{ type: 'text', text }] });
    await expect(fetchGoonfiMarkets('http://studio')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when discovery fails', async () => {
    vi.mocked(callMCPTool).mockRejectedValue(new Error('Disconnected'));
    await expect(fetchGoonfiMarkets('http://studio')).resolves.toEqual([]);
  });
});

describe('createGoonfiPriceScenario', () => {
  it('calls the price tool with the market and exact decimal string', async () => {
    await expect(
      createGoonfiPriceScenario('http://studio', ' market-account ', ' 18446744073709.551615 ')
    ).resolves.toEqual({ id: 'goonfi-scenario' });
    expect(callMCPTool).toHaveBeenCalledWith(
      'http://studio',
      'create_goonfi_price_scenario',
      { market: 'market-account', price: '18446744073709.551615' },
      'goonfi-session'
    );
  });

  it('omits the market when using the backend default', async () => {
    await createGoonfiPriceScenario('http://studio', '  ', ' 0.000001 ');
    expect(callMCPTool).toHaveBeenCalledWith(
      'http://studio',
      'create_goonfi_price_scenario',
      { price: '0.000001' },
      'goonfi-session'
    );
  });
});
