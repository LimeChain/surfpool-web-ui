import { createMeteoraPairHaltScenario, createMeteoraPriceShockScenario } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MeteoraStateDialog', () => {
  it('creates a price shock scenario with the pair prefilled', async () => {
    const onCreated = vi.fn();
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByLabelText('Meteora DLMM pair')).toHaveValue('BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y');
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPriceShockMock).toHaveBeenCalledWith(
        'http://studio',
        'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y',
        '0.5'
      );
      expect(onCreated).toHaveBeenCalledWith('price-shock-scenario');
    });
  });

  it('rejects a price factor of 1 before calling the backend', () => {
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPriceShockMock).not.toHaveBeenCalled();
  });

  it('creates a pair halt scenario with an empty pool field on mode switch', async () => {
    const onCreated = vi.fn();
    createPairHaltMock.mockResolvedValue({ id: 'pair-halt-scenario' });
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'pair-halt' } });
    expect(screen.getByLabelText('Meteora DLMM pair')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Meteora DLMM pair'), {
      target: { value: 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createPairHaltMock).toHaveBeenCalledWith('http://studio', 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y');
      expect(onCreated).toHaveBeenCalledWith('pair-halt-scenario');
    });
  });

  it('requires a pair address before creating a pair halt scenario', () => {
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'pair-halt' } });

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    expect(createPairHaltMock).not.toHaveBeenCalled();
  });

  it('does not render the price factor field in pair halt mode', () => {
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'pair-halt' } });

    expect(screen.queryByLabelText('Price factor')).not.toBeInTheDocument();
  });

  it('surfaces backend validation errors', async () => {
    createPriceShockMock.mockRejectedValue(new Error('BinArray covering the shocked bin does not exist'));
    render(<MeteoraStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('BinArray covering the shocked bin does not exist')).toBeInTheDocument();
  });
});
