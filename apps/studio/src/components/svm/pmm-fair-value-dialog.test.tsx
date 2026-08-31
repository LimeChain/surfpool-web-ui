import { createTesseraFairValueScenario, fetchTesseraMarkets } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PmmFairValueDialog from './pmm-fair-value-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createTesseraFairValueScenario: vi.fn(),
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

const markets = [
  { label: 'SOL/USDC', value: 'FLckHLGM' },
  { label: 'cbBTC/USDC', value: '9NkuAWB4' },
];

const renderDialog = (onCreated = vi.fn()) =>
  render(<PmmFairValueDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

beforeEach(() => {
  fetchMarketsMock.mockResolvedValue(markets);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PmmFairValueDialog', () => {
  it('offers Tessera through the PMM protocol selector', () => {
    renderDialog();

    const protocolListbox = screen.getByLabelText('PMM protocol');
    expect(protocolListbox).toHaveValue('tessera');
    expect(within(protocolListbox).getAllByRole('option')).toHaveLength(1);
    expect(within(protocolListbox).getByRole('option', { name: 'Tessera' })).toBeInTheDocument();
  });

  it('labels the price with the pair of the market the catalog names as default', async () => {
    renderDialog();

    expect(await screen.findByLabelText('Price of SOL in USDC')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });

    expect(await screen.findByLabelText('Price of cbBTC in USDC')).toBeInTheDocument();
  });

  it('routes an empty market through the adapter so the backend picks its default', async () => {
    const onCreated = vi.fn();
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog(onCreated);

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('Price of SOL in USDC'), { target: { value: '100.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createScenarioMock).toHaveBeenCalledWith('http://studio', '', '100.25');
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

    expect(optionNames).toEqual(['Default market (SOL/USDC)', 'SOL/USDC', 'cbBTC/USDC']);
  });

  it('locks the market field while the catalog is loading', () => {
    fetchMarketsMock.mockReturnValue(new Promise(() => {}));
    renderDialog();

    const marketField = screen.getByLabelText('PMM market');
    expect(marketField).toBeDisabled();
    expect(marketField).toHaveAttribute('placeholder', 'Loading markets…');
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
