import {
  createMeteoraDammV2FeeScenario,
  createMeteoraDammV2PriceShockScenario,
  createMeteoraPairHaltScenario,
  createMeteoraPriceShockScenario,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeteoraStateDialog from './meteora-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createMeteoraDammV2FeeScenario: vi.fn(),
  createMeteoraDammV2PriceShockScenario: vi.fn(),
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
const createDammV2Mock = vi.mocked(createMeteoraDammV2PriceShockScenario);
const createDammV2FeeMock = vi.mocked(createMeteoraDammV2FeeScenario);
const onCreated = vi.fn();
const POOL = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';
const DAMM_POOL = '8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie';

function renderDialog() {
  render(
    <MeteoraStateDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MeteoraStateDialog', () => {
  it('creates a price shock scenario from empty fields', async () => {
    createPriceShockMock.mockResolvedValue({ id: 'price-shock-scenario' });
    renderDialog();

    expect(screen.getByLabelText('Meteora DLMM pair')).toHaveValue('');
    expect(screen.getByLabelText('Price factor')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Meteora DLMM pair'), { target: { value: POOL } });
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('price-shock-scenario'));
    expect(createPriceShockMock).toHaveBeenCalledWith('http://studio', 'http://rpc', POOL, '4');
  });

  it('creates a DAMM v2 fee scenario', async () => {
    createDammV2FeeMock.mockResolvedValue({ id: 'damm-v2-fee-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'damm-v2-fee' } });
    fireEvent.change(screen.getByLabelText('Meteora DAMM v2 pool'), { target: { value: DAMM_POOL } });
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Base fee (bps)'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('damm-v2-fee-scenario'));
    expect(createDammV2FeeMock).toHaveBeenCalledWith('http://studio', 'http://rpc', DAMM_POOL, '500');
  });

  it('creates a DAMM v2 price shock scenario', async () => {
    createDammV2Mock.mockResolvedValue({ id: 'damm-v2-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'damm-v2-price-shock' } });
    fireEvent.change(screen.getByLabelText('Meteora DAMM v2 pool'), { target: { value: DAMM_POOL } });
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '1.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('damm-v2-scenario'));
    expect(createDammV2Mock).toHaveBeenCalledWith('http://studio', 'http://rpc', DAMM_POOL, '1.1');
  });

  it('creates a pair halt scenario', async () => {
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

    fireEvent.change(screen.getByLabelText('Meteora DLMM pair'), { target: { value: POOL } });
    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('bin array does not exist')).toBeInTheDocument();
  });
});
