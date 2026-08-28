import {
  createPhoenixCollateralScenario,
  createPhoenixDirectMarkScenario,
  createPhoenixReferencePriceScenario,
  fetchPhoenixMarketSymbols,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  fetchSymbolsMock.mockResolvedValue([]);
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
    fireEvent.change(screen.getByLabelText('Phoenix market'), { target: { value: 'SOL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => {
      expect(createReferencePriceMock).toHaveBeenCalledWith('http://studio', 'SOL', '80000', '120000');
      expect(onCreated).toHaveBeenCalledWith('phoenix-scenario');
    });
  });

  it('keeps invalid exact tick inputs out of the backend', async () => {
    render(<PhoenixStateDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={vi.fn()} />);

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

    await waitFor(() => expect(fetchSymbolsMock).toHaveBeenCalledWith('http://studio'));

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
});
