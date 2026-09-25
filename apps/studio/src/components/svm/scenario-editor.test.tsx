import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ScenarioEditor from './scenario-editor';

vi.mock('@/hooks/use-app-config', () => ({
  useAppConfig: () => ({ rpcUrl: 'http://rpc', studioUrl: 'http://studio' }),
}));

vi.mock('./transaction-inspector', () => ({ default: () => null }));

vi.mock('@surfpool/ui', () => ({
  ComboboxLabel: () => null,
  ComboboxOption: () => null,
  Select: () => null,
  Switch: () => null,
  Combobox: ({ options, onChange, 'aria-label': label }: any) => {
    const handleChange = (event: any) => onChange(options.find((option: any) => option.value === event.target.value));

    return (
      <select aria-label={label} onChange={handleChange}>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));

const tesseraPrice = {
  id: 'tessera-price',
  name: 'Tessera price',
  description: 'Set the fair value',
  protocol: 'Tessera',
  idl: { accounts: [{ name: 'Market', type: { fields: [{ name: 'price', type: 'u64' }] } }] },
  accountType: 'Market',
  address: { pubkey: 'market-a' },
  constants: {
    market: {
      label: 'Market',
      options: [
        { label: 'Market A', value: 'market-a' },
        { label: 'Market B', value: 'market-b' },
      ],
    },
  },
  properties: [{ path: 'price', label: 'Price' }],
};

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
  url === 'http://studio/v1/scenarios/templates'
    ? new Response(JSON.stringify([tesseraPrice]))
    : new Response(JSON.stringify({ result: { value: { data: { parsed: { price: 1 } } } } }))
);

const fetchedAccounts = () =>
  fetchMock.mock.calls.filter(([url]) => url === 'http://rpc').map(([, init]) => JSON.parse(`${init?.body}`).params[0]);

it('refetches the account when another market is selected', async () => {
  vi.stubGlobal('fetch', fetchMock);
  render(<ScenarioEditor />);

  const slotCard = screen.getByText('Slot 1').parentElement?.nextElementSibling?.firstElementChild;
  fireEvent.click(slotCard as Element);
  fireEvent.click(await screen.findByAltText('Tessera'));
  await waitFor(() => expect(fetchedAccounts()).toEqual(['market-a']));

  fireEvent.change(await screen.findByLabelText('Market'), { target: { value: 'market-b' } });
  await waitFor(() => expect(fetchedAccounts()).toEqual(['market-a', 'market-b']));
  vi.unstubAllGlobals();
});

it('ignores an older account response that resolves after a newer selection', async () => {
  const pending: Array<{ account: string; resolve: (price: number) => void }> = [];
  const deferredFetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === 'http://studio/v1/scenarios/templates')
      return Promise.resolve(new Response(JSON.stringify([tesseraPrice])));
    return new Promise<Response>((resolve) => {
      pending.push({
        account: JSON.parse(`${init?.body}`).params[0],
        resolve: (price) =>
          resolve(new Response(JSON.stringify({ result: { value: { data: { parsed: { price } } } } }))),
      });
    });
  });
  vi.stubGlobal('fetch', deferredFetch);
  render(<ScenarioEditor />);

  const slotCard = screen.getByText('Slot 1').parentElement?.nextElementSibling?.firstElementChild;
  fireEvent.click(slotCard as Element);
  fireEvent.click(await screen.findByAltText('Tessera'));
  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0].resolve(1);

  fireEvent.change(await screen.findByLabelText('Market'), { target: { value: 'market-b' } });
  await waitFor(() => expect(pending).toHaveLength(2));
  fireEvent.click(screen.getByRole('heading', { name: 'Tessera price' }));
  await waitFor(() => expect(pending).toHaveLength(3));
  expect(pending.map(({ account }) => account)).toEqual(['market-a', 'market-b', 'market-a']);

  pending[2].resolve(3);
  expect(await screen.findByPlaceholderText('Enter price...')).toHaveValue(3);
  pending[1].resolve(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.getByPlaceholderText('Enter price...')).toHaveValue(3);
  expect(screen.getByLabelText('Market')).toHaveValue('market-a');
  vi.unstubAllGlobals();
});
