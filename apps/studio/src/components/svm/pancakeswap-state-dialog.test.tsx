import {
  createPancakeswapClmmFeeTierScenario,
  createPancakeswapPriceShockScenario,
  fetchPancakeswapFeeTierOptions,
} from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PancakeswapStateDialog from './pancakeswap-state-dialog';

vi.mock('@/lib/scenarios-api', () => ({
  createPancakeswapClmmFeeTierScenario: vi.fn(),
  createPancakeswapPriceShockScenario: vi.fn(),
  fetchPancakeswapFeeTierOptions: vi.fn(async () => [{ value: '14', label: 'Fee tier 0.2% - Index 14' }]),
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

const onCreated = vi.fn();

function renderDialog() {
  render(
    <PancakeswapStateDialog
      open
      studioUrl="http://studio"
      rpcUrl="http://rpc"
      onClose={vi.fn()}
      onCreated={onCreated}
    />
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('PancakeswapStateDialog', () => {
  it('creates a CLMM price shock scenario with the pool prefilled', async () => {
    vi.mocked(createPancakeswapPriceShockScenario).mockResolvedValue({ id: 'price-shock-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('Price factor'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('price-shock-scenario'));
    expect(createPancakeswapPriceShockScenario).toHaveBeenCalledWith(
      'http://studio',
      'http://rpc',
      'DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ',
      '4'
    );
  });

  it('creates a CLMM fee tier scenario from the live catalog', async () => {
    vi.mocked(createPancakeswapClmmFeeTierScenario).mockResolvedValue({ id: 'fee-tier-scenario' });
    renderDialog();

    fireEvent.change(screen.getByLabelText('State goal'), { target: { value: 'fee-tier' } });
    await screen.findByRole('option', { name: 'Fee tier 0.2% - Index 14' });
    fireEvent.change(screen.getByLabelText('New fee in basis points'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('fee-tier-scenario'));
    expect(createPancakeswapClmmFeeTierScenario).toHaveBeenCalledWith('http://studio', '14', '1000');
    expect(fetchPancakeswapFeeTierOptions).toHaveBeenCalledWith('http://studio');
  });

  it('surfaces creation errors', async () => {
    vi.mocked(createPancakeswapPriceShockScenario).mockRejectedValue(new Error('tick array does not exist'));
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    expect(await screen.findByText('tick array does not exist')).toBeInTheDocument();
  });
});
