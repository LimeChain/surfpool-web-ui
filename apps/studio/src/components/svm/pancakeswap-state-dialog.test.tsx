import {
  createPancakeswapClmmFeeTierScenario,
  createPancakeswapPriceShockScenario,
  fetchPancakeswapFeeTierOptions,
} from '@/lib/scenarios-api';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PancakeswapStateDialog from './pancakeswap-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createPancakeswapClmmFeeTierScenario: vi.fn(),
  createPancakeswapPriceShockScenario: vi.fn(),
  fetchPancakeswapFeeTierOptions: vi.fn(),
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

const createPriceShockMock = vi.mocked(createPancakeswapPriceShockScenario);
const createFeeTierMock = vi.mocked(createPancakeswapClmmFeeTierScenario);
const fetchFeeTierOptionsMock = vi.mocked(fetchPancakeswapFeeTierOptions);

beforeEach(() => {
  fetchFeeTierOptionsMock.mockResolvedValue([
    { value: '0', label: 'Fee tier 0.01% (tick spacing 10) - Index 0' },
    { value: '14', label: 'Fee tier 0.2% (tick spacing 10) - Index 14' },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PancakeswapStateDialog', () => {
  it('creates a CLMM price shock scenario with the pool prefilled', async () => {
    const onCreated = vi.fn();
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByLabelText('PancakeSwap CLMM pool')).toHaveValue('DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ');
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPriceShockMock).toHaveBeenCalledWith(
        'http://studio',
        'DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ',
        '0.5'
      );
      expect(onCreated).toHaveBeenCalledWith('price-shock-scenario');
    });
  });

  it('rejects a price factor of 1 before calling the backend', () => {
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPriceShockMock).not.toHaveBeenCalled();
  });

  it('creates a CLMM fee tier scenario from the live catalog', async () => {
    const onCreated = vi.fn();
    createFeeTierMock.mockResolvedValue({ id: 'fee-tier-scenario' });
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-tier' } });
    await screen.findByRole('option', { name: 'Fee tier 0.2% (tick spacing 10) - Index 14' });

    fireEvent.change(screen.getByLabelText('Fee tier'), { target: { value: '14' } });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createFeeTierMock).toHaveBeenCalledWith('http://studio', '14', '1000');
      expect(onCreated).toHaveBeenCalledWith('fee-tier-scenario');
    });
  });

  it('rejects a fee at or above the 1,000,000 denominator bound', async () => {
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-tier' } });
    await screen.findByRole('option', { name: 'Fee tier 0.01% (tick spacing 10) - Index 0' });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '10000' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createFeeTierMock).not.toHaveBeenCalled();
  });

  it('surfaces backend validation errors', async () => {
    createPriceShockMock.mockRejectedValue(new Error('TickArrayState covering the shocked price does not exist'));
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('TickArrayState covering the shocked price does not exist')).toBeInTheDocument();
  });

  it('disables fee tier selection and creation while the catalog is loading or unavailable', async () => {
    let finishLoading!: (options: Array<{ value: string; label: string }>) => void;
    fetchFeeTierOptionsMock.mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve;
      })
    );
    render(<PancakeswapStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-tier' } });

    expect(screen.getByRole('combobox', { name: 'Fee tier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    await act(async () => finishLoading([]));
    expect(await screen.findByRole('status')).toHaveTextContent('No fee tiers available');
    expect(screen.getByRole('combobox', { name: 'Fee tier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });
});
