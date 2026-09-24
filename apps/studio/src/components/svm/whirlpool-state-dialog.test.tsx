import { createWhirlpoolFeeRateScenario, createWhirlpoolPriceShockScenario } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WhirlpoolStateDialog from './whirlpool-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createWhirlpoolFeeRateScenario: vi.fn(),
  createWhirlpoolPriceShockScenario: vi.fn(),
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

const createPriceShockMock = vi.mocked(createWhirlpoolPriceShockScenario);
const createFeeRateMock = vi.mocked(createWhirlpoolFeeRateScenario);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WhirlpoolStateDialog', () => {
  it('creates a price shock scenario with the pool prefilled', async () => {
    const onCreated = vi.fn();
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByLabelText('Whirlpool pool')).toHaveValue('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE');
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPriceShockMock).toHaveBeenCalledWith(
        'http://studio',
        'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE',
        '0.5'
      );
      expect(onCreated).toHaveBeenCalledWith('price-shock-scenario');
    });
  });

  it('rejects a price factor of 1 before calling the backend', () => {
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPriceShockMock).not.toHaveBeenCalled();
  });

  it('creates a fee rate scenario with an empty pool field on mode switch', async () => {
    const onCreated = vi.fn();
    createFeeRateMock.mockResolvedValue({ id: 'fee-rate-scenario' });
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-rate' } });
    expect(screen.getByLabelText('Whirlpool pool')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Whirlpool pool'), {
      target: { value: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE' },
    });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createFeeRateMock).toHaveBeenCalledWith(
        'http://studio',
        'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE',
        '25'
      );
      expect(onCreated).toHaveBeenCalledWith('fee-rate-scenario');
    });
  });

  it('rejects a fee of 600 bps or more before calling the backend', () => {
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-rate' } });
    fireEvent.change(screen.getByLabelText('Whirlpool pool'), {
      target: { value: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE' },
    });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '600' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createFeeRateMock).not.toHaveBeenCalled();
  });

  it('requires a pool address before creating a fee rate scenario', () => {
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-rate' } });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '25' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createFeeRateMock).not.toHaveBeenCalled();
  });

  it('does not render the price factor field in fee rate mode', () => {
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-rate' } });

    expect(screen.queryByLabelText('Price factor')).not.toBeInTheDocument();
  });

  it('does not render the fee bps field in price shock mode', () => {
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.queryByLabelText('New fee in basis points')).not.toBeInTheDocument();
  });

  it('surfaces backend validation errors', async () => {
    createPriceShockMock.mockRejectedValue(new Error('TickArray covering the shocked tick does not exist'));
    render(<WhirlpoolStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('TickArray covering the shocked tick does not exist')).toBeInTheDocument();
  });
});
