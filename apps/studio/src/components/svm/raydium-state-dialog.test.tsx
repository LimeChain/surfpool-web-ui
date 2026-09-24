import {
  createRaydiumAmmPoolStatusScenario,
  createRaydiumClmmFeeTierScenario,
  createRaydiumClmmPriceShockScenario,
  fetchRaydiumFeeTierOptions,
} from '@/lib/scenarios-api';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RaydiumStateDialog from './raydium-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createRaydiumAmmPoolStatusScenario: vi.fn(),
  createRaydiumClmmFeeTierScenario: vi.fn(),
  createRaydiumClmmPriceShockScenario: vi.fn(),
  fetchRaydiumFeeTierOptions: vi.fn(),
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

const createPriceShockMock = vi.mocked(createRaydiumClmmPriceShockScenario);
const createPoolStatusMock = vi.mocked(createRaydiumAmmPoolStatusScenario);
const createFeeTierMock = vi.mocked(createRaydiumClmmFeeTierScenario);
const fetchFeeTierOptionsMock = vi.mocked(fetchRaydiumFeeTierOptions);

beforeEach(() => {
  fetchFeeTierOptionsMock.mockResolvedValue([
    { value: '1', label: 'Standard (25 bps) - Index 1' },
    { value: '8', label: 'Index 8 (used by main SOL/USDC pool)' },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RaydiumStateDialog', () => {
  it('creates a CLMM price shock scenario with the pool prefilled', async () => {
    const onCreated = vi.fn();
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByLabelText('Raydium CLMM pool')).toHaveValue('3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv');
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPriceShockMock).toHaveBeenCalledWith(
        'http://studio',
        '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv',
        '0.5'
      );
      expect(onCreated).toHaveBeenCalledWith('price-shock-scenario');
    });
  });

  it('rejects a price factor of 1 before calling the backend', () => {
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPriceShockMock).not.toHaveBeenCalled();
  });

  it('creates an AMM v4 pool status scenario with an empty pool field on mode switch', async () => {
    const onCreated = vi.fn();
    createPoolStatusMock.mockResolvedValue({ id: 'pool-status-scenario' });
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'amm-pool-status' } });
    expect(screen.getByLabelText('Raydium AMM v4 pool')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Raydium AMM v4 pool'), {
      target: { value: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' },
    });
    fireEvent.change(screen.getByLabelText('Pool status'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPoolStatusMock).toHaveBeenCalledWith(
        'http://studio',
        '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
        '3'
      );
      expect(onCreated).toHaveBeenCalledWith('pool-status-scenario');
    });
  });

  it('requires a pool address before creating an AMM v4 pool status scenario', () => {
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'amm-pool-status' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPoolStatusMock).not.toHaveBeenCalled();
  });

  it('creates a CLMM fee tier scenario from the live catalog', async () => {
    const onCreated = vi.fn();
    createFeeTierMock.mockResolvedValue({ id: 'fee-tier-scenario' });
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'clmm-fee-tier' } });
    await screen.findByRole('option', { name: 'Index 8 (used by main SOL/USDC pool)' });

    fireEvent.change(screen.getByLabelText('Fee tier'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createFeeTierMock).toHaveBeenCalledWith('http://studio', '8', '10');
      expect(onCreated).toHaveBeenCalledWith('fee-tier-scenario');
    });
  });

  it('rejects a fee at or above the 1,000,000 denominator bound', async () => {
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'clmm-fee-tier' } });
    await screen.findByRole('option', { name: 'Standard (25 bps) - Index 1' });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '10000' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createFeeTierMock).not.toHaveBeenCalled();
  });

  it('surfaces backend validation errors', async () => {
    createPriceShockMock.mockRejectedValue(new Error('TickArray covering the shocked price does not exist'));
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('TickArray covering the shocked price does not exist')).toBeInTheDocument();
  });

  it('disables fee tier selection and creation while the catalog is loading or unavailable', async () => {
    let finishLoading!: (options: Array<{ value: string; label: string }>) => void;
    fetchFeeTierOptionsMock.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      })
    );
    render(<RaydiumStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'clmm-fee-tier' } });

    expect(screen.getByRole('combobox', { name: 'Fee tier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    await act(async () => finishLoading([]));
    expect(await screen.findByRole('status')).toHaveTextContent('No fee tiers available');
    expect(screen.getByRole('combobox', { name: 'Fee tier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });
});
