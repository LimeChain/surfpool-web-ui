import {
  createRaydiumAmmPoolStatusScenario,
  createRaydiumClmmFeeTierScenario,
  createRaydiumClmmPriceShockScenario,
  fetchRaydiumFeeTierOptions,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RaydiumStateDialog from './raydium-state-dialog';

const POOL = '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv';
const AMM_POOL = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2';

vi.mock('@/lib/scenarios-api', () => ({
  createRaydiumAmmPoolStatusScenario: vi.fn(),
  createRaydiumClmmFeeTierScenario: vi.fn(),
  createRaydiumClmmPriceShockScenario: vi.fn(),
  fetchRaydiumFeeTierOptions: vi.fn(),
}));

vi.mock('@surfpool/ui', () => ({
  Button: 'button',
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogActions: 'div',
  DialogDescription: 'p',
  DialogTitle: 'h2',
  Listbox: ({ children, onChange, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.value);

    return (
      <select {...props} onChange={handleChange}>
        {children}
      </select>
    );
  },
  ListboxOption: 'option',
  Input: 'input',
}));

const onCreated = vi.fn();

beforeEach(() => {
  vi.mocked(fetchRaydiumFeeTierOptions).mockResolvedValue([{ value: '8', label: 'Index 8' }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderDialog() {
  render(
    <RaydiumStateDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function submit(id: string, createMock: unknown, ...args: string[]) {
  fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
  await waitFor(() => expect(createMock).toHaveBeenCalledWith(...args));
  expect(onCreated).toHaveBeenCalledWith(id);
}

describe('RaydiumStateDialog', () => {
  it('creates a CLMM price shock with the pool prefilled', async () => {
    vi.mocked(createRaydiumClmmPriceShockScenario).mockResolvedValue({ id: 'shock' });
    renderDialog();
    change('Price factor', '4');
    await submit('shock', vi.mocked(createRaydiumClmmPriceShockScenario), 'http://studio', 'http://rpc', POOL, '4');
  });

  it('creates an AMM v4 pool status scenario', async () => {
    vi.mocked(createRaydiumAmmPoolStatusScenario).mockResolvedValue({ id: 'status' });
    renderDialog();
    change('State goal', 'amm-pool-status');
    change('Raydium AMM v4 pool', AMM_POOL);
    change('Pool status', '3');
    await submit('status', vi.mocked(createRaydiumAmmPoolStatusScenario), 'http://studio', AMM_POOL, '3');
  });

  it('creates a CLMM fee tier scenario from the catalog', async () => {
    vi.mocked(createRaydiumClmmFeeTierScenario).mockResolvedValue({ id: 'fee' });
    renderDialog();
    change('State goal', 'clmm-fee-tier');
    await screen.findByRole('option', { name: 'Index 8' });
    change('New fee in basis points', '10');
    await submit('fee', vi.mocked(createRaydiumClmmFeeTierScenario), 'http://studio', '8', '10');
  });

  it('shows the backend error', async () => {
    vi.mocked(createRaydiumClmmPriceShockScenario).mockRejectedValue(new Error('tick array X does not exist'));
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    expect(await screen.findByText('tick array X does not exist')).toBeInTheDocument();
  });
});
