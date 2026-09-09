import { fetchPhoenixMarketSymbols } from '@/lib/scenarios-api';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScenarioEditor from './scenario-editor';

vi.mock('@/hooks/use-app-config', () => ({
  useAppConfig: () => ({ studioUrl: 'http://studio', rpcUrl: 'http://rpc' }),
}));
vi.mock('@surfpool/shared', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@surfpool/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@surfpool/ui')>()),
  Select: ({ children, ...props }: ComponentProps<'select'>) => <select {...props}>{children}</select>,
  Switch: () => null,
}));
vi.mock('./transaction-inspector', () => ({ default: () => null }));

vi.mock('@/lib/scenarios-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/scenarios-api')>()),
  fetchPhoenixMarketSymbols: vi.fn().mockResolvedValue([]),
}));

describe('Tessera raw actions', () => {
  const selectedMarket = { pubkey: '9NkuAWB4LgCVFV77omEkJEjXqgV5PGupwMTu3B3pBRhc' };
  const defaultMarket = { pubkey: 'FLckHLGMJy5gEoXWwcE68Nprde1D4araK4TGLw4pQq2n' };
  const template = {
    id: 'tessera-depth',
    name: 'Tessera depth',
    description: 'Change quoting depth',
    protocol: 'Tessera',
    address: defaultMarket,
    idl: null,
    rawLayout: { size: 1264 },
    properties: [{ path: 'sell_levels.0.amount', encoding: 'u64', label: 'Sell capacity' }],
  };
  let patches: Array<{ overrides: Array<{ account: unknown; values: Record<string, unknown>; persist?: boolean }> }>;

  beforeEach(() => {
    localStorage.clear();
    patches = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/templates')) return new Response(JSON.stringify([template]));
        if (init?.method === 'PATCH') {
          patches.push(JSON.parse(String(init.body)));
          return new Response('{}');
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function editCapacity(value: string, encoding = 'u64') {
    template.properties[0].encoding = encoding;
    render(
      <ScenarioEditor
        scenarioId="editor-regression"
        initialSteps={[
          {
            id: 'slot-1',
            name: 'Slot 1',
            type: 'slot',
            status: 'pending',
            actions: [
              {
                protocolId: 'tessera',
                actionId: 'tessera-depth',
                protocol: 'Tessera',
                action: 'Edit saved depth',
                account: selectedMarket,
                overrides: { 'sell_levels.0.amount': '100' },
                modifiedFields: ['sell_levels.0.amount'],
                original: { persist: true, account: selectedMarket },
              },
            ],
          },
        ]}
      />
    );
    fireEvent.click(await screen.findByTitle('Tessera: Edit saved depth'));
    await screen.findByPlaceholderText('Search protocols...');
    fireEvent.click(screen.getByText('Edit saved depth'));
    const input = await screen.findByPlaceholderText('Enter sell_levels.0.amount...');
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
    await waitFor(() => expect(patches.length).toBeGreaterThan(0));
    return patches[patches.length - 1].overrides[0];
  }

  describe('saving an edited scenario action', () => {
    it('keeps the selected market instead of replacing it with the template default', async () => {
      const saved = await editCapacity('250');
      expect(saved.account).toEqual(selectedMarket);
      expect(saved.persist).toBe(true);
    });

    it.each([
      ['u64', '18446744073709551615'],
      ['i64', '-9223372036854775808'],
      ['u128', '340282366920938463463374607431768211455'],
      ['i128', '-170141183460469231731687303715884105728'],
    ])('preserves an edited %s exactly', async (encoding, value) => {
      const saved = await editCapacity(value, encoding);
      expect(saved.values['sell_levels.0.amount']).toBe(value);
    });

    it('still sends small integer fields as numbers', async () => {
      const saved = await editCapacity('4294967295', 'u32');
      expect(saved.values['sell_levels.0.amount']).toBe(4294967295);
    });
  });
});

describe('Phoenix IDL actions', () => {
  const collateralTemplate = {
    id: 'phoenix-trader-collateral-stress',
    name: 'Collateral stress',
    protocol: 'Phoenix Eternal',
    description: 'Set collateral',
    accountType: 'Trader',
    address: { pubkey: 'trader' },
    properties: [{ path: 'traderState.quoteLotCollateral' }],
    idl: {
      types: [
        {
          name: 'Trader',
          type: { kind: 'struct', fields: [{ name: 'traderState', type: { defined: { name: 'TraderState' } } }] },
        },
        { name: 'TraderState', type: { kind: 'struct', fields: [{ name: 'quoteLotCollateral', type: 'i64' }] } },
      ],
    },
  };

  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.mocked(fetchPhoenixMarketSymbols).mockResolvedValue([]);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function openEditor(template: any = collateralTemplate, values: Record<string, unknown> = {}) {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/templates') ? [template] : { result: { value: null } }),
    }));
    render(
      <ScenarioEditor
        scenarioId="precision-test"
        initialSteps={[
          {
            id: 'slot',
            name: 'Slot',
            type: 'slot',
            actions: [
              {
                protocolId: 'phoenix-eternal',
                actionId: template.id,
                protocol: 'Phoenix Eternal',
                action: template.name,
                account: template.address,
                overrides: values,
              },
            ],
          },
        ]}
      />
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(await screen.findByTitle(`Phoenix Eternal: ${template.name}`));
    fireEvent.click(await screen.findByText(template.name));
  }

  it.each(['-9007199254740993', '9223372036854775807'])(
    'preserves exact collateral %s when editing and saving an IDL field',
    async (target) => {
      await openEditor(collateralTemplate, { 'traderState.quoteLotCollateral': '1' });
      fireEvent.change(await screen.findByPlaceholderText('Enter quoteLotCollateral...'), {
        target: { value: target },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
      await waitFor(() => {
        const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
        expect(patch).toBeDefined();
        expect(JSON.parse(patch![1].body).overrides[0].values['traderState.quoteLotCollateral']).toBe(target);
      });
    }
  );

  it('keeps the saved market visible when the live catalog is unavailable', async () => {
    const template = {
      ...collateralTemplate,
      id: 'phoenix-direct-mark-risk-shock',
      name: 'Mark shock',
      accountType: 'Market',
      properties: [{ path: 'symbol', type: 'dynamic_ref', source: 'list_phoenix_markets' }],
      idl: { types: [{ name: 'Market', type: { kind: 'struct', fields: [{ name: 'symbol', type: 'string' }] } }] },
    };
    await openEditor(template, { symbol: 'SOL' });
    const option = await screen.findByRole('option', { name: 'Custom · SOL' });
    expect((option as HTMLOptionElement).selected).toBe(true);
  });

  it('preserves wide integers as strings for other IDL templates', async () => {
    await openEditor({ ...collateralTemplate, id: 'other-collateral' }, { 'traderState.quoteLotCollateral': 1 });
    const input = await screen.findByPlaceholderText('Enter quoteLotCollateral...');
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(JSON.parse(patch![1].body).overrides[0].values['traderState.quoteLotCollateral']).toBe('2');
    });
  });
});
