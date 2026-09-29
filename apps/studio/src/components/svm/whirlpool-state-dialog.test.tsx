import { createWhirlpoolFeeRateScenario, createWhirlpoolPriceShockScenario } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const POOL = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE';

function renderDialog(onCreated = vi.fn()) {
  render(
    <WhirlpoolStateDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );
  return onCreated;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('WhirlpoolStateDialog', () => {
  it('creates a price shock scenario with the pool prefilled', async () => {
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    const onCreated = renderDialog();

    expect(screen.getByLabelText('Whirlpool pool')).toHaveValue(POOL);
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('price-shock-scenario'));
    expect(createPriceShockMock).toHaveBeenCalledWith('http://studio', 'http://rpc', POOL, '0.5');
  });

  it('creates a fee rate scenario with an empty pool field on mode switch', async () => {
    createFeeRateMock.mockResolvedValue({ id: 'fee-rate-scenario' });
    const onCreated = renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-rate' } });
    expect(screen.getByLabelText('Whirlpool pool')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Whirlpool pool'), { target: { value: POOL } });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('fee-rate-scenario'));
    expect(createFeeRateMock).toHaveBeenCalledWith('http://studio', POOL, '25');
  });

  it('shows the error the scenario request failed with', async () => {
    createPriceShockMock.mockRejectedValue(new Error('tick array does not exist'));
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('tick array does not exist')).toBeInTheDocument();
  });
});
