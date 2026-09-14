import {
  createHumidifiFairValueScenario,
  createTesseraFairValueScenario,
  fetchHumidifiMarkets,
  fetchTesseraMarkets,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PmmFairValueDialog from './pmm-fair-value-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createHumidifiFairValueScenario: vi.fn(),
  createTesseraFairValueScenario: vi.fn(),
  fetchHumidifiMarkets: vi.fn(),
  fetchTesseraMarkets: vi.fn(),
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
const createHumidifiMock = vi.mocked(createHumidifiFairValueScenario);
const fetchHumidifiMarketsMock = vi.mocked(fetchHumidifiMarkets);

const markets = [
  { label: 'SOL/USDC', value: 'FLckHLGM' },
  { label: 'cbBTC/USDC', value: '9NkuAWB4' },
];

const humidifiMarkets = [{ label: 'JUP/USDC', value: 'hKgG7iED' }];

const renderDialog = (onCreated = vi.fn()) =>
  render(<PmmFairValueDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

beforeEach(() => {
  fetchMarketsMock.mockResolvedValue(markets);
  fetchHumidifiMarketsMock.mockResolvedValue(humidifiMarkets);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PmmFairValueDialog', () => {
  it('offers Tessera and HumidiFi through the PMM protocol selector', async () => {
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    const protocolListbox = screen.getByLabelText('PMM protocol');
    expect(protocolListbox).toHaveValue('tessera');
    expect(
      within(protocolListbox)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Tessera', 'HumidiFi']);
  });

  it('preserves the selected market when selecting the current protocol again', async () => {
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });
    fireEvent.change(screen.getByLabelText('PMM protocol'), { target: { value: 'tessera' } });

    const marketField = screen.getByLabelText('PMM market');
    expect(marketField).not.toBeDisabled();
    expect(marketField).toHaveValue('9NkuAWB4');
    expect(screen.getByRole('button', { name: 'Create scenario' })).not.toBeDisabled();
    expect(fetchMarketsMock).toHaveBeenCalledTimes(1);
  });

  it('routes creation through the selected PMM adapter and refetches its markets', async () => {
    const onCreated = vi.fn();
    createHumidifiMock.mockResolvedValue({ id: 'humidifi-1' });
    renderDialog(onCreated);

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM protocol'), { target: { value: 'humidifi' } });
    const price = await screen.findByLabelText('Price of JUP in USDC');
    expect(fetchHumidifiMarketsMock).toHaveBeenCalledWith('http://studio');
    fireEvent.change(price, { target: { value: '104' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createHumidifiMock).toHaveBeenCalledWith('http://studio', 'hKgG7iED', '104');
      expect(createScenarioMock).not.toHaveBeenCalled();
      expect(onCreated).toHaveBeenCalledWith('humidifi-1');
    });
  });

  it("locks the market field again while the selected PMM's catalog loads", async () => {
    fetchHumidifiMarketsMock.mockReturnValue(new Promise(() => {}));
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM protocol'), { target: { value: 'humidifi' } });

    const marketField = screen.getByLabelText('PMM market');
    expect(fetchHumidifiMarketsMock).toHaveBeenCalledWith('http://studio');
    expect(marketField).toBeDisabled();
    expect(marketField).toHaveAttribute('placeholder', 'Loading markets…');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
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

  it.each(['', '   '])('requires an explicit HumidiFi market when discovery fails for %j', async (blankMarket) => {
    fetchHumidifiMarketsMock.mockResolvedValue([]);
    createHumidifiMock.mockResolvedValue({ id: 'humidifi-scenario-id' });
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM protocol'), { target: { value: 'humidifi' } });
    const marketField = await screen.findByLabelText('PMM market');
    await waitFor(() => expect(marketField).toHaveAttribute('placeholder', 'Enter a market account address'));
    expect(
      screen.getByText('Live market list unavailable. Enter a market account address to continue.')
    ).toBeInTheDocument();
    fireEvent.change(marketField, { target: { value: blankMarket } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();

    fireEvent.change(marketField, { target: { value: 'HumidiFiMarket111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createHumidifiMock).toHaveBeenCalledWith('http://studio', 'HumidiFiMarket111', '100');
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
