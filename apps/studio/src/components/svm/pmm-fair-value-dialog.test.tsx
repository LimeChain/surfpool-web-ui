import { createTemplateScenario, fetchScenarioTemplates } from '@/lib/scenarios-api';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PmmFairValueDialog from './pmm-fair-value-dialog';

vi.mock('@/lib/scenarios-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/scenarios-api')>()),
  createTemplateScenario: vi.fn(),
  fetchScenarioTemplates: vi.fn(),
}));

vi.mock('@surfpool/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogActions: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  Input: (props: any) => <input {...props} />,
  Listbox: ({ children, onChange, placeholder, ...props }: any) => {
    const handleChange = (event: any) => onChange(event.target.value);

    return (
      <select {...props} onChange={handleChange}>
        {children}
      </select>
    );
  },
  ListboxOption: ({ children, ...props }: any) => <option {...props}>{children}</option>,
}));

const createScenarioMock = vi.mocked(createTemplateScenario);
const fetchTemplatesMock = vi.mocked(fetchScenarioTemplates);

const wsolUsdc = { label: 'WSOL / USDC', value: 'FLckHLGM', metadata: { base_decimals: 9, quote_decimals: 6 } };
const cbbtcUsdc = { label: 'cbBTC / USDC', value: '9NkuAWB4', metadata: { base_decimals: 8, quote_decimals: 6 } };

const optionNames = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent);

const renderDialog = (onCreated = vi.fn()) =>
  render(<PmmFairValueDialog open studioUrl="http://studio" onClose={vi.fn()} onCreated={onCreated} />);

beforeEach(() => {
  fetchTemplatesMock.mockResolvedValue([
    { id: 'tessera-price', address: { pubkey: 'FLckHLGM' }, constants: { market: { options: [wsolUsdc, cbbtcUsdc] } } },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PmmFairValueDialog', () => {
  it('lists the PMM protocols and the markets of the adapter catalog', async () => {
    renderDialog();

    expect(await screen.findByLabelText('Price of WSOL in USDC')).toHaveValue('100');
    expect(fetchTemplatesMock).toHaveBeenCalledTimes(1);
    expect(fetchTemplatesMock).toHaveBeenCalledWith('http://studio');
    expect(optionNames('PMM protocol')).toEqual(['Tessera']);
    expect(optionNames('PMM market')).toEqual(['WSOL / USDC', 'cbBTC / USDC']);
  });

  it('posts the price and freshness overrides for the selected market and its decimals', async () => {
    const onCreated = vi.fn();
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog(onCreated);

    await screen.findByLabelText('Price of WSOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: '9NkuAWB4' } });
    fireEvent.change(screen.getByLabelText('Price of cbBTC in USDC'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('scenario-id'));
    const [studioUrl, scenario] = createScenarioMock.mock.calls[0] as [string, { overrides: any[] }];
    const [price, freshness] = scenario.overrides;
    expect(studioUrl).toBe('http://studio');
    expect(price).toMatchObject({ templateId: 'tessera-price', account: { pubkey: '9NkuAWB4' } });
    expect(String(price.values.quote_atoms_per_base_atom_x1e15)).toBe('1000000000000000000');
    expect(String(price.values.base_atoms_per_quote_atom_x1e15)).toBe('1000000000000');
    expect(freshness).toMatchObject({
      templateId: 'tessera-freshness',
      account: { pubkey: '9NkuAWB4' },
      values: { last_update_slot: 0 },
    });
  });

  it('shows an error and disables Create when the surfnet serves no PMM template', async () => {
    fetchTemplatesMock.mockResolvedValue([{ id: 'pump-amm-canonical-pool', address: {} }]);
    renderDialog();

    expect(await screen.findByText('This surfnet serves no PMM fair value templates')).toBeInTheDocument();
    expect(within(screen.getByLabelText('PMM protocol')).queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it('refuses a malformed price and shows an out-of-range one without posting', async () => {
    renderDialog();

    const price = await screen.findByLabelText('Price of WSOL in USDC');
    const createButton = screen.getByRole('button', { name: 'Create scenario' });
    fireEvent.change(price, { target: { value: '1e3' } });
    expect(createButton).toBeDisabled();

    fireEvent.change(price, { target: { value: '0.00000001' } });
    fireEvent.click(createButton);
    expect(await screen.findByText("Price is too small for this market's decimals")).toBeInTheDocument();
    expect(createScenarioMock).not.toHaveBeenCalled();
  });
});
