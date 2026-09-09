import {
  createPhoenixCollateralScenario,
  createPhoenixDirectMarkScenario,
  createPhoenixReferencePriceScenario,
  fetchPhoenixMarketSymbols,
} from '@/lib/scenarios-api';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhoenixStateDialog from './phoenix-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createPhoenixCollateralScenario: vi.fn(),
  createPhoenixDirectMarkScenario: vi.fn(),
  createPhoenixReferencePriceScenario: vi.fn(),
  fetchPhoenixMarketSymbols: vi.fn(),
}));

vi.mock('@surfpool/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogActions: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  Listbox: ({ children, onChange, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.value);

    return (
      <select {...props} onChange={handleChange}>
        {children}
      </select>
    );
  },
  ListboxOption: ({ children, ...props }: any) => <option {...props}>{children}</option>,
  Input: (props: any) => <input {...props} />,
}));

const createReferencePriceMock = vi.mocked(createPhoenixReferencePriceScenario);
const fetchSymbolsMock = vi.mocked(fetchPhoenixMarketSymbols);

beforeEach(() => {
  fetchSymbolsMock.mockResolvedValue(['BTC', 'SOL']);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PhoenixStateDialog', () => {
  it('creates an editable spot/perp divergence scenario', async () => {
    const onCreated = vi.fn();
    createReferencePriceMock.mockResolvedValue({ id: 'phoenix-scenario' });
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Spot reference ticks'), { target: { value: '80000' } });
    fireEvent.change(screen.getByLabelText('Perp reference ticks'), { target: { value: '120000' } });
    await screen.findByRole('option', { name: 'SOL' });
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'SOL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createReferencePriceMock).toHaveBeenCalledWith('http://studio', 'SOL', '80000', '120000');
      expect(onCreated).toHaveBeenCalledWith('phoenix-scenario');
    });
  });

  it('keeps invalid exact tick inputs out of the backend', async () => {
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    await screen.findByRole('option', { name: 'BTC' });
    fireEvent.change(screen.getByLabelText('Spot reference ticks'), { target: { value: '80.5' } });
    fireEvent.change(screen.getByLabelText('Perp reference ticks'), { target: { value: '120000' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPhoenixCollateralScenario).not.toHaveBeenCalled();
    expect(createPhoenixDirectMarkScenario).not.toHaveBeenCalled();
    expect(createReferencePriceMock).not.toHaveBeenCalled();
  });

  it('surfaces backend validation failures', async () => {
    createReferencePriceMock.mockRejectedValue(new Error('Phoenix PerpAssetMap account not found'));
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    await screen.findByRole('option', { name: 'SOL' });
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'SOL' } });
    fireEvent.change(screen.getByLabelText('Spot reference ticks'), { target: { value: '80000' } });
    fireEvent.change(screen.getByLabelText('Perp reference ticks'), { target: { value: '120000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('Phoenix PerpAssetMap account not found')).toBeInTheDocument();
  });

  it('rejects a market symbol outside the loaded catalog but accepts one inside it', async () => {
    fetchSymbolsMock.mockResolvedValue(['BTC', 'ETH']);
    createReferencePriceMock.mockResolvedValue({ id: 'phoenix-scenario' });
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    await screen.findByRole('option', { name: 'ETH' });

    fireEvent.change(screen.getByLabelText('Spot reference ticks'), { target: { value: '80000' } });
    fireEvent.change(screen.getByLabelText('Perp reference ticks'), { target: { value: '120000' } });

    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'BTCC' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createReferencePriceMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'ETH' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createReferencePriceMock).toHaveBeenCalledWith('http://studio', 'ETH', '80000', '120000');
    });
  });

  it('creates a direct mark scenario with a market selected from the live dropdown', async () => {
    fetchSymbolsMock.mockResolvedValue(['SOL', 'NEW']);
    vi.mocked(createPhoenixDirectMarkScenario).mockResolvedValue({ id: 'direct-mark' });
    const onCreated = vi.fn();
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'direct-mark' } });
    await screen.findByRole('option', { name: 'NEW' });
    const market = screen.getByRole('combobox', { name: 'Phoenix market' });
    expect(market).toHaveValue('SOL');
    expect(screen.queryByRole('textbox', { name: 'Phoenix market' })).not.toBeInTheDocument();
    fireEvent.change(market, { target: { value: 'NEW' } });
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPhoenixDirectMarkScenario).toHaveBeenCalledWith('http://studio', 'NEW', '12345');
      expect(onCreated).toHaveBeenCalledWith('direct-mark');
    });
  });

  it('disables market selection and creation while the catalog is loading or unavailable', async () => {
    let finishLoading!: (symbols: string[]) => void;
    fetchSymbolsMock.mockReturnValue(new Promise((resolve) => { finishLoading = resolve; }));
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'direct-mark' } });
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '12345' } });

    expect(screen.getByRole('combobox', { name: 'Phoenix market' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    await act(async () => finishLoading([]));
    expect(await screen.findByRole('status')).toHaveTextContent('No markets available');
    expect(screen.getByRole('combobox', { name: 'Phoenix market' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'collateral' } });
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: 'trader' } });
    fireEvent.change(screen.getByLabelText('Target collateral quote lots'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
  });

});
