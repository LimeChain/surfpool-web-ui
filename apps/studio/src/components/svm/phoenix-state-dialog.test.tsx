import {
  createPhoenixLiquidationCascadeScenario,
  createPhoenixLiquidationReadyScenario,
  createPhoenixMaintenanceMarginScenario,
  createPhoenixMarketMoveScenario,
  fetchDynamicRefOptions,
  fetchPhoenixTraderPositions,
  type DynamicRefOption,
  type PhoenixTraderPosition,
} from '@/lib/scenarios-api';
import { comboboxResults } from '@/test-utils';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhoenixStateDialog from './phoenix-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createPhoenixLiquidationCascadeScenario: vi.fn(),
  createPhoenixLiquidationReadyScenario: vi.fn(),
  createPhoenixMaintenanceMarginScenario: vi.fn(),
  createPhoenixMarketMoveScenario: vi.fn(),
  fetchDynamicRefOptions: vi.fn(),
  fetchPhoenixTraderPositions: vi.fn(),
}));

vi.mock('@surfpool/ui', async () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Checkbox: ({ checked, onChange, color, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.checked);

    return <input type="checkbox" checked={checked} onChange={handleChange} {...props} />;
  },
  CheckboxField: ({ children }: any) => <label>{children}</label>,
  CheckboxGroup: ({ children }: any) => <div>{children}</div>,
  Description: ({ children }: any) => <span>{children}</span>,
  Label: ({ children }: any) => <span>{children}</span>,
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
  Switch: ({ checked, onChange, color, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.checked);

    return <input type="checkbox" checked={checked} onChange={handleChange} {...props} />;
  },
}));

const createMarketMoveMock = vi.mocked(createPhoenixMarketMoveScenario);
const fetchSymbolsMock = vi.mocked(fetchDynamicRefOptions);

const markets = (...symbols: string[]): DynamicRefOption[] =>
  symbols.map((value) => ({ value, address: `${value}Orderbook1111111111111111111111111` }));

const TRADER = 'HB66UQf7Bv82q9VPhg9Hz6RcDaTMY1yJm8KVDA8VG7Gp';

const position = (symbol: string, side: 'long' | 'short', baseLots: string): PhoenixTraderPosition => ({
  symbol,
  orderbook: `${symbol}Orderbook1111111111111111111111111`,
  side,
  baseLots,
  maintenanceMarginQuoteLots: '1000000',
});

const renderDialog = (onCreated = vi.fn()) =>
  render(
    <PhoenixStateDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );

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
      fireEvent.change(screen.getByLabelText('Target price'), { target: { value: invalid } });
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
      fireEvent.submit(screen.getByRole('button', { name: 'Create scenario' }).closest('form')!);
    }
    expect(createMarketMoveMock).not.toHaveBeenCalled();
  });

  it('lists the positions of the typed trader and creates a liquidation-ready scenario for the one chosen', async () => {
    const createMock = vi.mocked(createPhoenixLiquidationReadyScenario);
    createMock.mockResolvedValue({ id: 'liquidation-ready' });
    vi.mocked(fetchPhoenixTraderPositions).mockResolvedValue([
      { ...position('ETH', 'long', '1000'), maintenanceMarginQuoteLots: '420000' },
      { ...position('SOL', 'short', '25000'), maintenanceMarginQuoteLots: '4200' },
    ]);
    const onCreated = vi.fn();
    renderDialog(onCreated);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'liquidation-ready' } });
    expect(screen.queryByLabelText('Phoenix market')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unit')).not.toBeInTheDocument();
    // An address copied with a trailing period is not an account, so no positions are asked for.
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: `${TRADER}.` } });
    expect(screen.getByRole('status')).toHaveTextContent('Not a valid Solana address');
    expect(fetchPhoenixTraderPositions).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: TRADER } });

    const sol = await screen.findByRole('checkbox', { name: /^SOL/ });
    expect(fetchPhoenixTraderPositions).toHaveBeenCalledWith('http://studio', 'http://rpc', TRADER);
    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();
    expect(screen.getByText('1000 base lots · margin $0.42')).toBeInTheDocument();
    expect(screen.getByText('25000 base lots · margin $0.0042')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.click(sol);
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('http://studio', TRADER, ['SOL'], false);
      expect(onCreated).toHaveBeenCalledWith('liquidation-ready');
    });
  });

  it('selects every position of a trader at once, however many it holds', async () => {
    const createMock = vi.mocked(createPhoenixLiquidationReadyScenario);
    createMock.mockResolvedValue({ id: 'liquidation-ready' });
    vi.mocked(fetchPhoenixTraderPositions).mockResolvedValue([
      position('ETH', 'long', '1000'),
      position('SOL', 'short', '25000'),
      position('BTC', 'long', '3000'),
      position('XRP', 'short', '500'),
      position('DOGE', 'long', '700'),
    ]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'liquidation-ready' } });
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: TRADER } });
    await screen.findByRole('checkbox', { name: /^SOL/ });
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('5 of 5 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 of 5 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('http://studio', TRADER, ['BTC', 'DOGE', 'ETH', 'SOL', 'XRP'], false);
    });
  });

  it('keeps the chosen positions when only whitespace around the trader changes', async () => {
    vi.mocked(fetchPhoenixTraderPositions).mockResolvedValue([
      position('ETH', 'long', '1000'),
      position('SOL', 'short', '25000'),
    ]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'liquidation-ready' } });
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: TRADER } });
    fireEvent.click(await screen.findByRole('checkbox', { name: /^SOL/ }));
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: ` ${TRADER} ` } });

    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
    expect(fetchPhoenixTraderPositions).toHaveBeenCalledTimes(1);
  });

  it('tells when the trader holds no positions and keeps the scenario from being created', async () => {
    vi.mocked(fetchPhoenixTraderPositions).mockResolvedValue([]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'liquidation-ready' } });
    fireEvent.change(screen.getByLabelText('Phoenix Trader account'), { target: { value: TRADER } });

    expect(await screen.findByText('This trader holds no open Phoenix positions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it('creates a liquidation cascade for the chosen side, sized by the market rather than a count', async () => {
    const createMock = vi.mocked(createPhoenixLiquidationCascadeScenario);
    createMock.mockResolvedValue({ id: 'cascade' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'liquidation-cascade' } });
    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    expect(screen.queryByLabelText('Traders')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Positions to liquidate'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('http://studio', 'SOL', 'short', false);
    });
  });

  it('refetches upstream accounts at Play only when Keep earlier Phoenix changes is turned off', async () => {
    createMarketMoveMock.mockResolvedValue({ id: 'refetched' });
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'raw' } });
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '9000' } });
    expect(screen.getByLabelText('Keep earlier Phoenix changes')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Keep earlier Phoenix changes'));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMarketMoveMock).toHaveBeenCalledWith('http://studio', 'SOL', '9000', true);
    });
  });

  it('surfaces backend validation failures', async () => {
    createMarketMoveMock.mockRejectedValue(new Error('Phoenix PerpAssetMap account not found'));
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '80000' } });
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
    createMarketMoveMock.mockResolvedValue({ id: 'amat' });
    renderDialog();

    await screen.findByRole('button', { name: 'AMD' });
    const search = screen.getByLabelText('Phoenix market');
    expect(search).toHaveValue('AMAT');
    fireEvent.change(search, { target: { value: amat } });
    expect(comboboxResults('Phoenix market')).toEqual(['AMAT']);
    fireEvent.change(search, { target: { value: 'amat' } });
    expect(comboboxResults('Phoenix market')).toEqual(['AMAT']);
    fireEvent.change(search, { target: { value: unlisted } });
    expect(comboboxResults('Phoenix market')).toEqual([unlisted]);
    expect(screen.getByText('Custom symbol')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: amat } });
    fireEvent.click(screen.getByRole('button', { name: 'AMAT' }));
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '31350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMarketMoveMock).toHaveBeenCalledWith('http://studio', 'AMAT', '31350', false);
    });
  });

  it('keeps a custom market when the dialog is closed and reopened', async () => {
    createMarketMoveMock.mockResolvedValue({ id: 'custom' });
    const dialog = (open: boolean) => (
      <PhoenixStateDialog
        open={open}
        studioUrl="http://studio"
        rpcUrl="http://rpc"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );
    const { rerender } = render(dialog(true));

    await screen.findByRole('button', { name: 'BTC' });
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'XYZ' } });
    fireEvent.click(screen.getByRole('button', { name: 'XYZ' }));
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '1000' } });
    rerender(dialog(false));
    rerender(dialog(true));
    await screen.findByRole('button', { name: 'BTC' });

    expect(screen.getByLabelText('Phoenix market')).toHaveValue('XYZ');
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => {
      expect(createMarketMoveMock).toHaveBeenCalledWith('http://studio', 'XYZ', '1000', false);
    });
  });

  it('creates a maintenance margin scenario and keeps invalid factors out of the backend', async () => {
    const createMock = vi.mocked(createPhoenixMaintenanceMarginScenario);
    createMock.mockResolvedValue({ id: 'maintenance' });
    const onCreated = vi.fn();
    renderDialog(onCreated);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'maintenance-margin' } });
    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'raw' } });
    for (const invalid of ['0', '10001', '65536', '1.5']) {
      fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: invalid } });
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    }
    fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith('http://studio', 'SOL', '10000', false);
      expect(onCreated).toHaveBeenCalledWith('maintenance');
    });
  });

  it('locks the market while the catalog loads and takes a typed symbol when it loads empty', async () => {
    let finishLoading!: (options: DynamicRefOption[]) => void;
    fetchSymbolsMock.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      })
    );
    createMarketMoveMock.mockResolvedValue({ id: 'typed' });
    renderDialog();
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'market-move' } });
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '12345' } });

    expect(screen.getByLabelText('Phoenix market')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    await act(async () => finishLoading([]));
    expect(await screen.findByRole('status')).toHaveTextContent('Markets could not be loaded');
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: ' ETH ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ETH' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => {
      expect(createMarketMoveMock).toHaveBeenCalledWith('http://studio', 'ETH', '12345', false);
    });
  });

  it('clears an amount typed in a unit the newly picked market cannot take', async () => {
    fetchSymbolsMock.mockResolvedValue([
      { value: 'BTC', markTicks: 85957, tickSize: 100, baseLotDecimals: 4 },
      { value: 'NEW', address: 'NEWOrderbook1111111111111111111111111' },
    ]);
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'BTC' }));
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'NEW' }));

    expect(screen.getByLabelText('Target price')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it('clears a USD or tick amount on a market change and keeps a % amount', async () => {
    fetchSymbolsMock.mockResolvedValue([
      { value: 'BTC', markTicks: 85957, tickSize: 100, baseLotDecimals: 4 },
      { value: 'SOL', markTicks: 11755, tickSize: 1, baseLotDecimals: 2 },
    ]);
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'usd' } });
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'BTC' }));
    expect(screen.getByLabelText('Target price')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'raw' } });
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '9000' } });
    fireEvent.click(screen.getByRole('button', { name: 'SOL' }));
    expect(screen.getByLabelText('Target price')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'BTC' }));
    expect(screen.getByLabelText('Target price')).toHaveValue('-10');
  });

  it('keeps a maintenance factor at or below the market backstop factor out of the backend', async () => {
    const createMock = vi.mocked(createPhoenixMaintenanceMarginScenario);
    createMock.mockResolvedValue({ id: 'maintenance' });
    fetchSymbolsMock.mockResolvedValue([{ value: 'SOL', backstopRiskFactorBps: 2000 }]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'maintenance-margin' } });
    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'raw' } });
    fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: '2000' } });
    expect(screen.getByRole('status')).toHaveTextContent('Must be above the backstop factor (2000 bps).');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Maintenance risk factor'), { target: { value: '2001' } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith('http://studio', 'SOL', '2001', false));
  });

  it('keeps an amount typed while markets load in the ticks it was typed in', async () => {
    let finishLoading!: (options: DynamicRefOption[]) => void;
    fetchSymbolsMock.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      })
    );
    createMarketMoveMock.mockResolvedValue({ id: 'typed' });
    renderDialog();
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '12345' } });

    await act(async () => finishLoading([{ value: 'BTC', markTicks: 85957, tickSize: 100, baseLotDecimals: 4 }]));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    await waitFor(() => expect(createMarketMoveMock).toHaveBeenCalledWith('http://studio', 'BTC', '12345', false));
  });

  it('converts percent and USD inputs to the raw values the backend takes', async () => {
    const createMarginMock = vi.mocked(createPhoenixMaintenanceMarginScenario);
    createMarketMoveMock.mockResolvedValue({ id: 'mark' });
    createMarginMock.mockResolvedValue({ id: 'margin' });
    fetchSymbolsMock.mockResolvedValue([
      { value: 'BTC', markTicks: 85957, tickSize: 100, baseLotDecimals: 4 },
      { value: 'kBONK', markTicks: 1500, tickSize: 1, baseLotDecimals: -2 },
    ]);
    renderDialog();

    await screen.findByRole('button', { name: 'BTC' });
    const submit = (label: string, value: string) => {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    };
    submit('Target price', '-10');
    expect(screen.getByText('$85,957 → $77,361 (-10%), 77361 ticks')).toBeInTheDocument();
    await waitFor(() => expect(createMarketMoveMock).toHaveBeenLastCalledWith('http://studio', 'BTC', '77361', false));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'usd' } });
    submit('Target price', '85000.4');
    await waitFor(() => expect(createMarketMoveMock).toHaveBeenLastCalledWith('http://studio', 'BTC', '85000', false));
    fireEvent.click(screen.getByRole('button', { name: 'kBONK' }));
    submit('Target price', '0.000015');
    await waitFor(() => expect(createMarketMoveMock).toHaveBeenLastCalledWith('http://studio', 'kBONK', '1500', false));

    fireEvent.click(screen.getByRole('button', { name: 'BTC' }));
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'maintenance-margin' } });
    submit('Maintenance risk factor', '62.5');
    await waitFor(() => expect(createMarginMock).toHaveBeenCalledWith('http://studio', 'BTC', '6250', false));
  });
});
