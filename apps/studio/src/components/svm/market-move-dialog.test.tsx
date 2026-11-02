import { createMarketMoveScenario, fetchServedTemplates } from '@/lib/market-move';
import { getAddressDecoder } from '@solana/kit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketMoveDialog from './market-move-dialog';

const adapter = vi.hoisted(() => ({
  protocol: 'fake',
  label: 'Fake',
  templateId: 'fake-price',
  fetchBeforeUse: false,
  listMarkets: vi.fn(),
  readMarket: vi.fn(),
  buildOverrides: vi.fn(),
}));

vi.mock('@/lib/market-move-adapters', () => ({
  MARKET_MOVE_ADAPTERS: [adapter, { ...adapter, protocol: 'other', label: 'Other', templateId: 'other' }],
}));

vi.mock('@/lib/market-move', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/market-move')>()),
  createMarketMoveScenario: vi.fn(),
  fetchServedTemplates: vi.fn(),
}));

vi.mock('@surfpool/ui', async () => {
  const { useState } = await import('react');

  // Runs the dialog's own filter, displayValue and customOption, so the search itself is under test.
  const Combobox = (props: any) => {
    const [query, setQuery] = useState('');
    const handleQueryChange = (event: any) => setQuery(event.target.value);
    const filtered = query ? props.options.filter((option: any) => props.filter(option, query)) : props.options;
    const typed = query ? props.customOption(query) : null;

    return (
      <div>
        <input aria-label={props['aria-label']} value={query} onChange={handleQueryChange} disabled={props.disabled} />
        <ul aria-label="Market results">
          {(typed ? [...filtered, typed] : filtered).map((option: any) => (
            <li key={option.value}>
              <button type="button" onClick={() => props.onChange(option)}>
                {props.displayValue(option)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  const Listbox = ({ children, onChange, placeholder, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.value);
    return (
      <select {...props} onChange={handleChange}>
        {children}
      </select>
    );
  };
  const Passthrough = ({ children }: any) => <div>{children}</div>;

  return {
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Combobox,
    ComboboxDescription: Passthrough,
    ComboboxLabel: Passthrough,
    ComboboxOption: Passthrough,
    Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
    DialogActions: Passthrough,
    DialogDescription: Passthrough,
    DialogTitle: Passthrough,
    Input: (props: any) => <input {...props} />,
    Listbox,
    ListboxOption: ({ children, ...props }: any) => <option {...props}>{children}</option>,
  };
});

const createScenarioMock = vi.mocked(createMarketMoveScenario);

const key = (byte: number) => getAddressDecoder().decode(new Uint8Array(32).fill(byte));
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TYPED = key(9);
const MARKETS = [
  { label: 'SOL / USDC', value: key(1), account: 'oracle-1' },
  { label: 'BTC / USDC', value: key(2), account: 'oracle-2' },
];
const OVERRIDE = {
  templateId: 'fake-price',
  label: 'Fake move',
  account: { pubkey: 'oracle-2' },
  values: { price: 1 },
};

const renderDialog = (onCreated = vi.fn()) =>
  render(
    <MarketMoveDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );

const marketNames = () =>
  within(screen.getByLabelText('Market results'))
    .queryAllByRole('button')
    .map((option) => option.textContent);
const createButton = () => screen.getByRole('button', { name: 'Create scenario' });
const search = (text: string) =>
  fireEvent.change(screen.getByLabelText('Market move market'), { target: { value: text } });
const loaded = () => waitFor(() => expect(marketNames()).toEqual(['SOL / USDC', 'BTC / USDC']));

const pickTyped = () => {
  search(TYPED);
  fireEvent.click(screen.getByRole('button', { name: `Custom · ${TYPED}` }));
};

beforeEach(() => {
  vi.mocked(fetchServedTemplates).mockResolvedValue([
    { id: 'fake-price' },
    { id: 'tokens', constants: { mints: { options: [{ value: SOL_MINT, metadata: { symbol: 'SOL' } }] } } },
  ]);
  adapter.listMarkets.mockResolvedValue(MARKETS);
  adapter.buildOverrides.mockResolvedValue([OVERRIDE]);
  createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MarketMoveDialog', () => {
  it('offers the served protocols and lists their markets with the known symbols, searchable by pair', async () => {
    renderDialog();

    await loaded();
    const protocols = within(screen.getByLabelText('Market move protocol')).getAllByRole('option');
    expect(protocols.map((option) => option.textContent)).toEqual(['Fake']);
    expect(adapter.listMarkets.mock.calls[0][0]).toBe('http://rpc');
    expect(adapter.listMarkets.mock.calls[0][1].get(SOL_MINT)).toBe('SOL');
    search('btc/usdc');
    expect(marketNames()).toEqual(['BTC / USDC']);
  });

  it('creates the scenario the adapter builds for the selected market and move', async () => {
    const onCreated = vi.fn();
    renderDialog(onCreated);

    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'BTC / USDC' }));
    fireEvent.change(screen.getByLabelText('Move (%)'), { target: { value: '-100' } });
    expect(createButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Move (%)'), { target: { value: '-20' } });
    fireEvent.click(createButton());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('scenario-id'));
    const [rpcUrl, market, move] = adapter.buildOverrides.mock.calls[0];
    expect([rpcUrl, market, move.label]).toEqual(['http://rpc', MARKETS[1], '-20%']);
    const [studioUrl, scenario] = createScenarioMock.mock.calls[0];
    expect(studioUrl).toBe('http://studio');
    expect(scenario).toMatchObject({ name: 'Fake BTC / USDC move -20%', tags: ['fake', 'market-move'] });
    expect(scenario.overrides).toEqual([
      { id: expect.any(String), ...OVERRIDE, scenarioRelativeSlot: 0, enabled: true, fetchBeforeUse: false },
    ]);
  });

  it('moves a typed address even when the market list fails, refusing one that is not a market', async () => {
    adapter.listMarkets.mockRejectedValue(new Error('getProgramAccounts failed: 429'));
    adapter.readMarket.mockRejectedValueOnce(new Error(`${TYPED} is not a Fake market account`));
    adapter.readMarket.mockResolvedValue({ label: 'JUP / USDC', value: TYPED, account: TYPED });
    renderDialog();

    expect(await screen.findByText('getProgramAccounts failed: 429')).toBeInTheDocument();
    pickTyped();
    expect(await screen.findByText(`${TYPED} is not a Fake market account`)).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
    pickTyped();
    await waitFor(() => expect(createButton()).toBeEnabled());
    fireEvent.click(createButton());

    await waitFor(() => expect(createScenarioMock).toHaveBeenCalled());
    expect(adapter.readMarket.mock.calls[1].slice(0, 2)).toEqual(['http://rpc', TYPED]);
    expect(adapter.buildOverrides.mock.calls[0][1]).toEqual({ label: 'JUP / USDC', value: TYPED, account: TYPED });
  });

  it('shows the error and posts nothing when the adapter cannot build the move', async () => {
    adapter.buildOverrides.mockRejectedValue(new Error('oracle-1 is not a Fake oracle account'));
    renderDialog();

    await waitFor(() => expect(createButton()).toBeEnabled());
    fireEvent.click(createButton());

    expect(await screen.findByText('oracle-1 is not a Fake oracle account')).toBeInTheDocument();
    expect(createScenarioMock).not.toHaveBeenCalled();
  });

  it('shows an error and disables Create when the surfnet serves no market move template', async () => {
    vi.mocked(fetchServedTemplates).mockResolvedValue([{ id: 'pump-amm-canonical-pool' }]);
    renderDialog();

    expect(await screen.findByText('This surfnet serves no market move templates')).toBeInTheDocument();
    expect(adapter.listMarkets).not.toHaveBeenCalled();
    expect(createButton()).toBeDisabled();
  });
});
