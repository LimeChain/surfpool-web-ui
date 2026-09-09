import {
  createGoonfiPriceScenario,
  createTesseraFairValueScenario,
  fetchGoonfiMarkets,
  fetchTesseraMarkets,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PmmFairValueDialog from './pmm-fair-value-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createGoonfiPriceScenario: vi.fn(),
  createTesseraFairValueScenario: vi.fn(),
  fetchTesseraMarkets: vi.fn(),
  fetchGoonfiMarkets: vi.fn(),
}));

vi.mock('@surfpool/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogActions: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  Input: (props: any) => <input {...props} />,
  Listbox: ({ children, onChange, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.value);

    return (
      <select {...props} onChange={handleChange}>
        {children}
      </select>
    );
  },
  ListboxOption: ({ children, ...props }: any) => <option {...props}>{children}</option>,
}));

const createScenarioMock = vi.mocked(createTesseraFairValueScenario);
const fetchMarketsMock = vi.mocked(fetchTesseraMarkets);
const fetchGoonfiMarketsMock = vi.mocked(fetchGoonfiMarkets);
const createGoonfiScenarioMock = vi.mocked(createGoonfiPriceScenario);

const markets = [
  { label: 'SOL/USDC', value: 'FLckHLGM' },
  { label: 'cbBTC/USDC', value: '9NkuAWB4' },
];

const renderDialog = (onCreated = vi.fn()) =>
  render(<PmmFairValueDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

beforeEach(() => {
  fetchMarketsMock.mockResolvedValue(markets);
  fetchGoonfiMarketsMock.mockResolvedValue([{ label: 'SOL/USDC', value: 'goonfi-market' }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PmmFairValueDialog', () => {
  it('offers Tessera and GoonFi through the PMM protocol selector', async () => {
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    const protocolListbox = screen.getByLabelText('PMM protocol');
    expect(protocolListbox).toHaveValue('tessera');
    expect(within(protocolListbox).getAllByRole('option')).toHaveLength(2);
    expect(within(protocolListbox).getByRole('option', { name: 'Tessera' })).toBeInTheDocument();
    expect(within(protocolListbox).getByRole('option', { name: 'GoonFi' })).toBeInTheDocument();
  });

  it('labels the price with the selected discovered pair', async () => {
    renderDialog();

    expect(await screen.findByLabelText('Price of SOL in USDC')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });

    expect(await screen.findByLabelText('Price of cbBTC in USDC')).toBeInTheDocument();
  });

  it('submits a discovered market explicitly when the default market is absent', async () => {
    fetchMarketsMock.mockResolvedValue([markets[1]]);
    const onCreated = vi.fn();
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog(onCreated);

    await screen.findByLabelText('Price of cbBTC in USDC');
    fireEvent.change(screen.getByLabelText('Price of cbBTC in USDC'), { target: { value: '100.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createScenarioMock).toHaveBeenCalledWith('http://studio', '9NkuAWB4', '100.25');
      expect(onCreated).toHaveBeenCalledWith('scenario-id');
    });
  });

  it('passes the selected market pubkey and the price as strings', async () => {
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog();

    await screen.findByLabelText('PMM market');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });
    fireEvent.change(screen.getByLabelText('Price of cbBTC in USDC'), { target: { value: '78.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createScenarioMock).toHaveBeenCalledWith('http://studio', '9NkuAWB4', '78.5');
    });
  });

  it('constrains the market choice to the loaded catalog, labeled by pair', async () => {
    renderDialog();

    await screen.findByRole('option', { name: 'cbBTC/USDC' });
    const optionNames = within(screen.getByLabelText('PMM market'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(optionNames).toEqual(['SOL/USDC', 'cbBTC/USDC']);
  });

  it('locks the market field while the catalog is loading', () => {
    fetchMarketsMock.mockReturnValue(new Promise(() => {}));
    renderDialog();

    const marketField = screen.getByLabelText('PMM market');
    expect(marketField).toBeDisabled();
    expect(marketField).toHaveAttribute('placeholder', 'Loading markets…');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it.each([
    ['replaces a removed market', markets, '9NkuAWB4', [markets[0]], 'FLckHLGM'],
    ['keeps a listed market', markets, '9NkuAWB4', markets, '9NkuAWB4'],
    ['replaces an unlisted fallback address', [], 'SomeOtherMarket', markets, 'FLckHLGM'],
    ['keeps a fallback address without a catalog', [], 'SomeOtherMarket', [], 'SomeOtherMarket'],
  ])('%s when reopening', async (_name, initialOptions, selected, refreshedOptions, expected) => {
    fetchMarketsMock.mockResolvedValue(initialOptions);
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    const props = { studioUrl: 'http://studio', onClose: vi.fn(), onCreated: vi.fn() };
    const { rerender } = render(<PmmFairValueDialog {...props} open />);
    await waitFor(() => expect(screen.getByLabelText('PMM market')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: selected } });

    rerender(<PmmFairValueDialog {...props} open={false} />);
    fetchMarketsMock.mockResolvedValue(refreshedOptions);
    rerender(<PmmFairValueDialog {...props} open />);

    await waitFor(() => {
      expect(screen.getByLabelText('PMM market')).not.toBeDisabled();
      expect(screen.getByLabelText('PMM market')).toHaveValue(expected);
      expect(screen.getByRole('button', { name: 'Create scenario' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => expect(createScenarioMock).toHaveBeenCalledWith('http://studio', expected, '100'));
  });

  it('accepts a free-text market when the catalog fails to load', async () => {
    fetchMarketsMock.mockResolvedValue([]);
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog();

    await waitFor(() => expect(fetchMarketsMock).toHaveBeenCalledWith('http://studio'));
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: 'SomeOtherMarket' } });
    fireEvent.change(screen.getByLabelText('Price in quote tokens'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createScenarioMock).toHaveBeenCalledWith('http://studio', 'SomeOtherMarket', '5');
    });
  });

  it('rejects zero and excessive precision before calling the backend', async () => {
    renderDialog();

    const price = await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(price, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();

    fireEvent.change(price, { target: { value: '1.0000000000001' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createScenarioMock).not.toHaveBeenCalled();
  });

  it('shows backend validation errors', async () => {
    createScenarioMock.mockRejectedValue(new Error('market is not owned by Tessera'));
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('market is not owned by Tessera')).toBeInTheDocument();
  });
});

describe('GoonFi PMM preset', () => {
  const selectGoonfi = () => fireEvent.change(screen.getByLabelText('PMM protocol'), { target: { value: 'goonfi' } });

  it('creates a GoonFi scenario through the Studio MCP and opens the returned id', async () => {
    const onCreated = vi.fn();
    createGoonfiScenarioMock.mockResolvedValue({ id: 'goonfi-id' });
    renderDialog(onCreated);
    selectGoonfi();
    await screen.findByRole('option', { name: 'SOL/USDC' });
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: 'goonfi-market' } });
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '99.740001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('goonfi-id'));
    expect(createGoonfiScenarioMock).toHaveBeenCalledWith('http://studio', 'goonfi-market', '99.740001');
    expect(createScenarioMock).not.toHaveBeenCalled();
    expect(fetchGoonfiMarketsMock).toHaveBeenCalledWith('http://studio');
  });

  // Reselecting the same protocol used to clear the catalog without rerunning the effect that
  // reloads it, which left the market listbox disabled on "Loading markets…" for good.
  it('keeps the loaded catalog when the current protocol is reselected', async () => {
    renderDialog();
    selectGoonfi();
    await screen.findByRole('option', { name: 'SOL/USDC' });
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();

    selectGoonfi();

    expect(screen.getByRole('option', { name: 'SOL/USDC' })).toBeInTheDocument();
    expect(screen.getByLabelText('PMM market')).toBeEnabled();
    expect(screen.getByLabelText('Price of SOL in USDC')).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
    expect(fetchGoonfiMarketsMock).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous protocol market from the new catalog and blocks submission while loading', async () => {
    let resolveMarkets!: (options: typeof markets) => void;
    fetchGoonfiMarketsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveMarkets = resolve;
      })
    );
    createGoonfiScenarioMock.mockResolvedValue({ id: 'default-goonfi' });
    renderDialog();
    await screen.findByRole('option', { name: 'cbBTC/USDC' });
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });
    selectGoonfi();
    expect(screen.getByLabelText('PMM market')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    resolveMarkets([{ label: 'SOL/USDC', value: 'goonfi-market' }]);
    await screen.findByRole('option', { name: 'SOL/USDC' });
    // The stale Tessera market is gone; the new catalog's first entry takes its place.
    expect(screen.getByLabelText('PMM market')).toHaveValue('goonfi-market');
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() =>
      expect(createGoonfiScenarioMock).toHaveBeenCalledWith('http://studio', 'goonfi-market', '100')
    );
  });

  it('ignores a previous protocol catalog that arrives after switching', async () => {
    let resolveTessera!: (options: typeof markets) => void;
    fetchMarketsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveTessera = resolve;
      })
    );
    renderDialog();
    selectGoonfi();
    await screen.findByRole('option', { name: 'SOL/USDC' });
    resolveTessera(markets);
    await waitFor(() => expect(screen.getByLabelText('PMM market')).toBeEnabled());
    expect(screen.queryByRole('option', { name: 'cbBTC/USDC' })).not.toBeInTheDocument();
  });

  it('rejects more than six decimals while Tessera still accepts twelve', async () => {
    renderDialog();
    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '1.0000001' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
    selectGoonfi();
    await screen.findByRole('option', { name: 'SOL/USDC' });
    expect(screen.getByLabelText('Price of SOL in USDC')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '1.0000001' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '0.000001' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
  });
});
