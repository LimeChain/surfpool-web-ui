import { GOONFI_FEATURED_MARKETS } from '@/lib/goonfi-markets';
import { createTemplateScenario, fetchScenarioTemplates } from '@/lib/pmm-fair-value';
import { PublicKey } from '@solana/web3.js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PmmFairValueDialog from './pmm-fair-value-dialog';

vi.mock('@/lib/pmm-fair-value', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pmm-fair-value')>()),
  createTemplateScenario: vi.fn(),
  fetchScenarioTemplates: vi.fn(),
}));

vi.mock('@surfpool/ui', async () => {
  const { useState } = await import('react');

  // Runs the dialog's own filter and displayValue, so the search itself is under test.
  const Combobox = ({
    'aria-label': ariaLabel,
    options,
    displayValue,
    filter,
    customOption,
    onChange,
    disabled,
  }: any) => {
    const [query, setQuery] = useState('');
    const handleQueryChange = (event: any) => setQuery(event.target.value);
    const filtered = query === '' ? options : options.filter((option: any) => filter(option, query));
    const typed = customOption && query !== '' ? customOption(query) : null;
    const matches = typed ? [...filtered, typed] : filtered;

    return (
      <div>
        <input aria-label={ariaLabel} value={query} onChange={handleQueryChange} disabled={disabled} />
        <ul aria-label={`${ariaLabel} results`}>
          {matches.map((option: any) => (
            <li key={option.value}>
              <button type="button" onClick={() => onChange(option)}>
                {displayValue(option)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return {
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Combobox,
    ComboboxDescription: ({ children }: any) => <span>{children}</span>,
    ComboboxLabel: ({ children }: any) => <span>{children}</span>,
    ComboboxOption: ({ children }: any) => <div>{children}</div>,
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
  };
});

const createScenarioMock = vi.mocked(createTemplateScenario);
const fetchTemplatesMock = vi.mocked(fetchScenarioTemplates);

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const JUP_USDC = GOONFI_FEATURED_MARKETS[2];
const FEATURED = ['SOL / USDC', 'HYPE / USDC', 'JUP / USDC', 'PUMP / USDC'];

const optionNames = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent);

const marketNames = () =>
  within(screen.getByLabelText('PMM market results'))
    .queryAllByRole('button')
    .map((option) => option.textContent);

const renderDialog = (onCreated = vi.fn()) =>
  render(
    <PmmFairValueDialog open studioUrl="http://studio" rpcUrl="http://rpc" onClose={vi.fn()} onCreated={onCreated} />
  );

beforeEach(() => {
  fetchTemplatesMock.mockResolvedValue([{ id: 'goonfi-reference-band' }]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const GOONFI_PROGRAM = 'goonuddtQRrWqqn5nFyczVKaie28f3kDkHWkHtURSLE';
const UNLISTED_MARKET = 'DoKKUBzWcv6TYg3vr6kvVzvadnibieYctse6oD6d7Hxs';
const UNLISTED_ORACLE = 'cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN';

// A surfnet that serves one tagged market account for getAccountInfo.
const stubSurfnet = (owner: string) => {
  const data = new Uint8Array(2048);
  data.set([48, 188, 47, 53, 52, 88, 50, 154], 0);
  data.set(new Uint8Array(32).fill(1), 80);
  data.set(new PublicKey(USDC).toBytes(), 112);
  data.set(new Uint8Array(32).fill(9), 208);
  const accountData = btoa(String.fromCharCode(...data));
  const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({
    json: async () => ({ result: { value: { owner, data: [accountData, 'base64'] } } }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('PmmFairValueDialog', () => {
  it('lists the PMM protocols and the featured markets of the adapter', async () => {
    renderDialog();

    expect(await screen.findByLabelText('Price of SOL in USDC')).toHaveValue('100');
    expect(fetchTemplatesMock).toHaveBeenCalledTimes(1);
    expect(fetchTemplatesMock).toHaveBeenCalledWith('http://studio');
    expect(optionNames('PMM protocol')).toEqual(['GoonFi']);
    expect(marketNames()).toEqual(FEATURED);
  });

  it('searches the markets by pair, ignoring spaces and case, and by address', async () => {
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    const search = screen.getByLabelText('PMM market');

    fireEvent.change(search, { target: { value: 'hype/usdc' } });
    expect(marketNames()).toEqual(['HYPE / USDC']);

    fireEvent.change(search, { target: { value: 'GMCJ' } });
    expect(marketNames()).toEqual(['SOL / USDC']);

    fireEvent.change(search, { target: { value: 'usdc' } });
    expect(marketNames()).toEqual(FEATURED);

    fireEvent.change(search, { target: { value: 'bonk' } });
    expect(marketNames()).toEqual([]);
  });

  it('posts the oracle quote, freshness and reference band for the selected market', async () => {
    const onCreated = vi.fn();
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    renderDialog(onCreated);

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: 'jup' } });
    fireEvent.click(screen.getByRole('button', { name: 'JUP / USDC' }));
    fireEvent.change(screen.getByLabelText('Price of JUP in USDC'), { target: { value: '1.0001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('scenario-id'));
    const [studioUrl, scenario] = createScenarioMock.mock.calls[0] as [string, { overrides: any[]; tags: string[] }];
    const [price, freshness, band] = scenario.overrides;
    expect(studioUrl).toBe('http://studio');
    expect(scenario.tags).toEqual(['goonfi', 'pmm', 'fair-value']);
    expect(price).toMatchObject({
      templateId: 'goonfi-price',
      account: { pubkey: JUP_USDC.oracle },
      fetchBeforeUse: true,
    });
    expect(String(price.values.bid_price_x1e6)).toBe('1000100');
    expect(String(price.values.ask_price_x1e6)).toBe('1000100');
    expect(freshness).toMatchObject({
      templateId: 'goonfi-freshness',
      account: { pubkey: JUP_USDC.oracle },
      values: { last_update_slot: 0 },
      fetchBeforeUse: true,
    });
    expect(band).toMatchObject({ templateId: 'goonfi-reference-band', account: { pubkey: JUP_USDC.market } });
    expect(String(band.values.reference_price_a_x1e6)).toBe('1000100');
    expect(String(band.values.reference_price_b_x1e6)).toBe('1000100');
  });

  it('reads a typed market address the featured list does not offer and targets its oracle', async () => {
    const onCreated = vi.fn();
    createScenarioMock.mockResolvedValue({ id: 'scenario-id' });
    const fetchMock = stubSurfnet(GOONFI_PROGRAM);
    renderDialog(onCreated);

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: UNLISTED_MARKET } });
    fireEvent.click(screen.getByRole('button', { name: `Custom · ${UNLISTED_MARKET}` }));
    await screen.findByLabelText('Price of 4vJ9JU1b⋯4P3bkLKi in USDC');
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('scenario-id'));
    expect(fetchMock.mock.calls[0][0]).toBe('http://rpc');
    const [, scenario] = createScenarioMock.mock.calls[0] as [string, { name: string; overrides: any[] }];
    expect(scenario.name).toBe(`GoonFi Custom · ${UNLISTED_MARKET} fair value 100`);
    expect(scenario.overrides[0]).toMatchObject({ templateId: 'goonfi-price', account: { pubkey: UNLISTED_ORACLE } });
    expect(scenario.overrides[2]).toMatchObject({
      templateId: 'goonfi-reference-band',
      account: { pubkey: UNLISTED_MARKET },
    });
  });

  it('offers a read typed market once, not again as a custom address', async () => {
    stubSurfnet(GOONFI_PROGRAM);
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: UNLISTED_MARKET } });
    fireEvent.click(screen.getByRole('button', { name: `Custom · ${UNLISTED_MARKET}` }));
    await screen.findByLabelText('Price of 4vJ9JU1b⋯4P3bkLKi in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: UNLISTED_MARKET } });

    expect(marketNames()).toEqual([`Custom · ${UNLISTED_MARKET}`]);
  });

  it('refuses a typed address that is not a GoonFi market', async () => {
    stubSurfnet('11111111111111111111111111111111');
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: UNLISTED_MARKET } });
    fireEvent.click(screen.getByRole('button', { name: `Custom · ${UNLISTED_MARKET}` }));

    expect(await screen.findByText(`${UNLISTED_MARKET} is not a GoonFi market account`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it('ignores a market read that resolves after a newer selection', async () => {
    const secondMarket = 'H3chk8rgniKXnToGTdPUFieuHGLQQfBMXVbGp6bR1uMD';
    const fetchMock = stubSurfnet(GOONFI_PROGRAM);
    const respond = fetchMock.getMockImplementation()!;
    let releaseFirstRead = () => {};
    fetchMock.mockImplementationOnce(
      (url, init) => new Promise((resolve) => (releaseFirstRead = () => resolve(respond(url, init))))
    );
    renderDialog();

    await screen.findByLabelText('Price of SOL in USDC');
    for (const address of [UNLISTED_MARKET, secondMarket]) {
      fireEvent.change(screen.getByLabelText('PMM market'), { target: { value: address } });
      fireEvent.click(screen.getByRole('button', { name: `Custom · ${address}` }));
    }
    await screen.findByLabelText('Price of 4vJ9JU1b⋯4P3bkLKi in USDC');
    releaseFirstRead();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeEnabled();
  });

  it('shows an error and disables Create when the surfnet serves no PMM template', async () => {
    fetchTemplatesMock.mockResolvedValue([{ id: 'pump-amm-canonical-pool' }]);
    renderDialog();

    expect(await screen.findByText('This surfnet serves no PMM fair value templates')).toBeInTheDocument();
    expect(within(screen.getByLabelText('PMM protocol')).queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Create scenario' })).toBeDisabled();
  });

  it('refuses a malformed price and shows an out-of-range one without posting', async () => {
    renderDialog();

    const price = await screen.findByLabelText('Price of SOL in USDC');
    const createButton = screen.getByRole('button', { name: 'Create scenario' });
    fireEvent.change(price, { target: { value: '1e3' } });
    expect(createButton).toBeDisabled();

    fireEvent.change(price, { target: { value: '0.0000001' } });
    fireEvent.click(createButton);
    expect(await screen.findByText('Price has more decimals than this market supports, at most 6')).toBeInTheDocument();
    expect(createScenarioMock).not.toHaveBeenCalled();
  });
});
