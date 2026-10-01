import {
  createPhoenixDirectMarkScenario,
  createPhoenixMaintenanceMarginScenario,
  fetchDynamicRefOptions,
  type DynamicRefOption,
} from '@/lib/scenarios-api';
import { comboboxResults } from '@/test-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhoenixStateDialog from './phoenix-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createPhoenixCollateralScenario: vi.fn(),
  createPhoenixDirectMarkScenario: vi.fn(),
  createPhoenixMaintenanceMarginScenario: vi.fn(),
  fetchDynamicRefOptions: vi.fn(),
}));

vi.mock('@surfpool/ui', async () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Combobox: (await import('@/test-utils')).MockCombobox,
  ComboboxDescription: ({ children }: any) => <span>{children}</span>,
  ComboboxLabel: ({ children }: any) => <span>{children}</span>,
  ComboboxOption: ({ children }: any) => <div>{children}</div>,
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

const createDirectMarkMock = vi.mocked(createPhoenixDirectMarkScenario);
const fetchSymbolsMock = vi.mocked(fetchDynamicRefOptions);

const markets = (...symbols: string[]): DynamicRefOption[] =>
  symbols.map((value) => ({ value, address: `${value}Orderbook1111111111111111111111111` }));

const renderDialog = (onCreated = vi.fn()) =>
  render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

beforeEach(() => {
  fetchSymbolsMock.mockResolvedValue(markets('BTC', 'SOL'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PhoenixStateDialog', () => {
  it('keeps invalid exact tick inputs out of the backend', async () => {
    renderDialog();

    await screen.findByRole('button', { name: 'BTC' });
    // Not a whole number, a zero mark, and one past u32::MAX.
    for (const invalid of ['80.5', '0', '4294967296']) {
      fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: invalid } });
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    }
    expect(createDirectMarkMock).not.toHaveBeenCalled();
  });

  it('surfaces backend validation failures', async () => {
    createDirectMarkMock.mockRejectedValue(new Error('Phoenix PerpAssetMap account not found'));
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '80000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('Phoenix PerpAssetMap account not found')).toBeInTheDocument();
  });

  it('picks a listed market typed by its symbol in any case or by its orderbook address', async () => {
    const amat = 'AvPTRe4XjC1xdVhwzUiVwDDfqrqm6eVaKMAnS39raEjW';
    const unlisted = '6tgCsPZqZi4rcQWLLgoMHE1XAnRqA7mYYRByGUYxyFwB';
    fetchSymbolsMock.mockResolvedValue([
      { value: 'AMAT', address: amat },
      { value: 'AMD', address: 'ABBz13DENxvLRLh6pjHxNsxBPNNbEnfiMPPXrx8sK7qN' },
    ]);
    createDirectMarkMock.mockResolvedValue({ id: 'amat' });
    renderDialog();

    await screen.findByRole('button', { name: 'AMD' });
    const search = screen.getByLabelText('Phoenix market');
    fireEvent.change(search, { target: { value: amat } });
    expect(comboboxResults('Phoenix market')).toEqual(['AMAT']);
    fireEvent.change(search, { target: { value: 'amat' } });
    expect(comboboxResults('Phoenix market')).toEqual(['AMAT']);
    fireEvent.change(search, { target: { value: unlisted } });
    expect(comboboxResults('Phoenix market')).toEqual([unlisted]);
    expect(screen.getByText('Custom symbol')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: amat } });
    fireEvent.click(screen.getByRole('button', { name: 'AMAT' }));
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '31350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createDirectMarkMock).toHaveBeenCalledWith('http://studio', 'AMAT', '31350');
    });
  });

  it('keeps a custom market when the dialog is closed and reopened', async () => {
    createDirectMarkMock.mockResolvedValue({ id: 'custom' });
    const dialog = (open: boolean) => (
      <PhoenixStateDialog open={open} studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />
    );
    const { rerender } = render(dialog(true));

    await screen.findByRole('button', { name: 'BTC' });
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'XYZ' } });
    fireEvent.click(screen.getByRole('button', { name: 'XYZ' }));
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '1000' } });
    rerender(dialog(false));
    rerender(dialog(true));
    await screen.findByRole('button', { name: 'BTC' });

    expect(screen.getByLabelText('Phoenix market')).toHaveValue('XYZ');
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => {
      expect(createDirectMarkMock).toHaveBeenCalledWith('http://studio', 'XYZ', '1000');
    });
  });

  it('creates a direct mark scenario with a market selected from the live dropdown', async () => {
    fetchSymbolsMock.mockResolvedValue(markets('SOL', 'NEW'));
    createDirectMarkMock.mockResolvedValue({ id: 'direct-mark' });
    const onCreated = vi.fn();
    renderDialog(onCreated);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'direct-mark' } });
    await screen.findByRole('button', { name: 'NEW' });
    expect(screen.getByLabelText('Phoenix market')).toHaveValue('SOL');
    fireEvent.click(screen.getByRole('button', { name: 'NEW' }));
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createDirectMarkMock).toHaveBeenCalledWith('http://studio', 'NEW', '12345');
      expect(onCreated).toHaveBeenCalledWith('direct-mark');
    });
  });

  it('creates a maintenance margin scenario and keeps invalid factors out of the backend', async () => {
    const createMock = vi.mocked(createPhoenixMaintenanceMarginScenario);
    createMock.mockResolvedValue({ id: 'maintenance' });
    const onCreated = vi.fn();
    renderDialog(onCreated);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'maintenance-margin' } });
    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    for (const invalid of ['0', '10001', '65536', '1.5']) {
      fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: invalid } });
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('http://studio', 'SOL', '10000');
      expect(onCreated).toHaveBeenCalledWith('maintenance');
    });
  });

  it('locks the market while the catalog loads and takes a typed symbol when it loads empty', async () => {
    let finishLoading!: (options: DynamicRefOption[]) => void;
    fetchSymbolsMock.mockReturnValue(new Promise((resolve) => { finishLoading = resolve; }));
    createDirectMarkMock.mockResolvedValue({ id: 'typed' });
    renderDialog();
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'direct-mark' } });
    fireEvent.change(screen.getByLabelText('Target mark ticks'), { target: { value: '12345' } });

    expect(screen.getByLabelText('Phoenix market')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    await act(async () => finishLoading([]));
    expect(await screen.findByRole('status')).toHaveTextContent('Markets could not be loaded');
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: ' ETH ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ETH' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => {
      expect(createDirectMarkMock).toHaveBeenCalledWith('http://studio', 'ETH', '12345');
    });

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'collateral' } });
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: 'trader' } });
    fireEvent.change(screen.getByLabelText('Target collateral quote lots'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
  });
});
