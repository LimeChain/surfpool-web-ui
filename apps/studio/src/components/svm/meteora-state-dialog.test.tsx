import { createMeteoraPairHaltScenario, createMeteoraPriceShockScenario } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeteoraStateDialog from './meteora-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createMeteoraPairHaltScenario: vi.fn(),
  createMeteoraPriceShockScenario: vi.fn(),
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

const createPriceShockMock = vi.mocked(createMeteoraPriceShockScenario);
const createPairHaltMock = vi.mocked(createMeteoraPairHaltScenario);
const onCreated = vi.fn();
const POOL = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';

function renderDialog() {
  render(
    <MeteoraStateDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MeteoraStateDialog', () => {
  it('creates a price shock scenario with the pair prefilled', async () => {
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('price-shock-scenario'));
    expect(createPriceShockMock).toHaveBeenCalledWith('http://studio', 'http://rpc', POOL, '4');
  });

  it('creates a pair halt scenario from an emptied pool field', async () => {
    createPairHaltMock.mockResolvedValue({ id: 'pair-halt-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'pair-halt' } });
    expect(screen.getByLabelText('Meteora DLMM pair')).toHaveValue('');
    expect(screen.queryByLabelText('Price factor')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Meteora DLMM pair'), { target: { value: POOL } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('pair-halt-scenario'));
    expect(createPairHaltMock).toHaveBeenCalledWith('http://studio', POOL);
  });

  it('shows the error the backend returns', async () => {
    createPriceShockMock.mockRejectedValue(new Error('bin array does not exist'));
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('bin array does not exist')).toBeInTheDocument();
  });
});
