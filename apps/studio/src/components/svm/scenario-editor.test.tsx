import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ScenarioEditor from './scenario-editor';

vi.mock('@/hooks/use-app-config', () => ({
  useAppConfig: () => ({ studioUrl: 'http://studio', rpcUrl: 'http://rpc' }),
}));
vi.mock('@surfpool/ui', () => ({
  Select: ({ children, ...props }: any) => <select {...props}>{children}</select>,
  Switch: ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={onChange} />,
}));
vi.mock('./transaction-inspector', () => ({ default: () => null }));
vi.mock('@/lib/scenarios-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/scenarios-api')>()),
  fetchPhoenixMarketSymbols: vi.fn().mockResolvedValue([]),
}));

const collateralTemplate = {
  id: 'phoenix-trader-collateral-stress',
  name: 'Collateral stress',
  protocol: 'Phoenix Eternal',
  description: 'Set collateral',
  accountType: 'Trader',
  address: { pubkey: 'trader' },
  properties: [{ path: 'traderState.quoteLotCollateral' }],
  idl: {
    types: [
      {
        name: 'Trader',
        type: { kind: 'struct', fields: [{ name: 'traderState', type: { defined: { name: 'TraderState' } } }] },
      },
      { name: 'TraderState', type: { kind: 'struct', fields: [{ name: 'quoteLotCollateral', type: 'i64' }] } },
    ],
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function openEditor(
  template: any = collateralTemplate,
  values: Record<string, unknown> = {},
  account: unknown = template.address
) {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (url.endsWith('/templates') ? [template] : { result: { value: null } }),
  }));
  render(
    <ScenarioEditor
      scenarioId="precision-test"
      initialSteps={[
        {
          id: 'slot',
          name: 'Slot',
          type: 'slot',
          actions: [
            {
              protocolId: 'phoenix-eternal',
              actionId: template.id,
              protocol: 'Phoenix Eternal',
              action: template.name,
              account,
              overrides: values,
            },
          ],
        },
      ]}
    />
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  fireEvent.click(await screen.findByTitle(`Phoenix Eternal: ${template.name}`));
  fireEvent.click(await screen.findByText(template.name));
}

it.each(['-9007199254740993', '9223372036854775807'])(
  'preserves exact collateral %s when editing and saving an IDL field',
  async (target) => {
    await openEditor(collateralTemplate, { 'traderState.quoteLotCollateral': '1' });
    fireEvent.change(await screen.findByPlaceholderText('Enter quoteLotCollateral...'), {
      target: { value: target },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(JSON.parse(patch![1].body).overrides[0].values['traderState.quoteLotCollateral']).toBe(target);
    });
  }
);

it('keeps the saved market visible when the live catalog is unavailable', async () => {
  const template = {
    ...collateralTemplate,
    id: 'phoenix-direct-mark-risk-shock',
    name: 'Mark shock',
    accountType: 'Market',
    properties: [{ path: 'symbol', type: 'dynamic_ref', source: 'list_phoenix_markets' }],
    idl: { types: [{ name: 'Market', type: { kind: 'struct', fields: [{ name: 'symbol', type: 'string' }] } }] },
  };
  await openEditor(template, { symbol: 'SOL' });
  const option = await screen.findByRole('option', { name: 'Custom · SOL' });
  expect((option as HTMLOptionElement).selected).toBe(true);
});

it('keeps the address a saved override was created against when updating it', async () => {
  const template = { ...collateralTemplate, address: { pubkey: 'template-map' } };
  await openEditor(template, { 'traderState.quoteLotCollateral': '1' }, { pubkey: 'live-map' });
  fireEvent.change(await screen.findByPlaceholderText('Enter quoteLotCollateral...'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(JSON.parse(patch![1].body).overrides[0].account).toEqual({ pubkey: 'live-map' });
  });
});

it('keeps numeric inputs for other IDL templates unchanged', async () => {
  await openEditor({ ...collateralTemplate, id: 'other-collateral' }, { 'traderState.quoteLotCollateral': 1 });
  const input = await screen.findByPlaceholderText('Enter quoteLotCollateral...');
  expect(input).toHaveAttribute('type', 'number');
  fireEvent.change(input, { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(JSON.parse(patch![1].body).overrides[0].values['traderState.quoteLotCollateral']).toBe(2);
  });
});

const marketTemplates = [
  {
    name: 'Direct mark',
    id: 'phoenix-direct-mark-risk-shock',
    prices: ['target_ticks'],
  },
  {
    name: 'Reference prices',
    id: 'phoenix-reference-price-divergence',
    prices: ['spot_ticks', 'perp_ticks'],
  },
];

for (const market of marketTemplates) {
  it('edits and saves ' + market.name + ' using value_type template fields', async () => {
    const names = ['symbol', ...market.prices];
    const template = {
      ...collateralTemplate,
      ...market,
      accountType: 'PerpAssetMap',
      address: { pubkey: 'template-map' },
      properties: names.map((path) => ({
        path,
        value_type: 'string',
        ...(path === 'symbol' ? { type: 'dynamic_ref', source: 'list_phoenix_markets' } : {}),
      })),
      idl: {
        types: [
          {
            name: 'PerpAssetMap',
            type: {
              kind: 'struct',
              fields: [{ name: 'discriminator', type: { array: ['u8', 8] } }],
            },
          },
        ],
      },
    };
    const values: Record<string, string> = { symbol: 'SOL' };
    for (const name of market.prices) values[name] = '1';
    await openEditor(template, values, { pubkey: 'saved-map' });
    const target = '18446744073709551615';
    for (const name of market.prices) {
      const input = await screen.findByPlaceholderText(`Enter ${name}...`);
      expect(input).toHaveAttribute('type', 'text');
      fireEvent.change(input, { target: { value: target } });
      values[name] = target;
    }
    expect(((await screen.findByRole('option', { name: 'Custom · SOL' })) as HTMLOptionElement).selected).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeDefined();
      const override = JSON.parse(patch![1].body).overrides[0];
      expect(override.templateId).toBe(market.id);
      expect(override.account).toEqual({ pubkey: 'saved-map' });
      expect(override.values).toEqual(values);
    });
  });
}

const rpcAccounts = () =>
  fetchMock.mock.calls.filter(([url]) => url === 'http://rpc').map(([, init]) => JSON.parse(init.body).params[0]);

it('fetches the saved account when reopening a saved override', async () => {
  const template = { ...collateralTemplate, address: { pubkey: 'template-trader' } };
  await openEditor(template, {}, { pubkey: 'saved-trader' });
  await waitFor(() => expect(rpcAccounts()).toEqual(['saved-trader']));
});

it('ignores an older account response that resolves after a newer selection', async () => {
  const other = { ...collateralTemplate, id: 'other-collateral', name: 'Other collateral', address: { pubkey: 'b' } };
  const pending: Array<{ account: string; resolve: (collateral: number) => void }> = [];
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/templates')) return Promise.resolve({ ok: true, json: async () => [collateralTemplate, other] });
    if (url !== 'http://rpc') return Promise.resolve({ ok: true, json: async () => ({}) });
    return new Promise((resolve) => {
      pending.push({
        account: JSON.parse(`${init?.body}`).params[0],
        resolve: (collateral) =>
          resolve({
            ok: true,
            json: async () => ({
              result: { value: { data: { parsed: { traderState: { quoteLotCollateral: collateral } } } } },
            }),
          }),
      });
    });
  });
  render(
    <ScenarioEditor
      scenarioId="stale-test"
      initialSteps={[
        {
          id: 'slot',
          name: 'Slot',
          type: 'slot',
          actions: [
            {
              protocolId: 'phoenix-eternal',
              actionId: collateralTemplate.id,
              protocol: 'Phoenix Eternal',
              action: collateralTemplate.name,
              account: { pubkey: 'a' },
              overrides: {},
            },
          ],
        },
      ]}
    />
  );
  fireEvent.click(await screen.findByTitle(`Phoenix Eternal: ${collateralTemplate.name}`));
  fireEvent.click(await screen.findByText(collateralTemplate.name));
  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0].resolve(1);

  fireEvent.click(await screen.findByRole('heading', { name: 'Other collateral' }));
  await waitFor(() => expect(pending).toHaveLength(2));
  fireEvent.click(screen.getByRole('heading', { name: collateralTemplate.name }));
  await waitFor(() => expect(pending).toHaveLength(3));
  expect(pending.map(({ account }) => account)).toEqual(['a', 'b', 'trader']);

  pending[2].resolve(3);
  const collateral = () => (screen.getByPlaceholderText('Enter quoteLotCollateral...') as HTMLInputElement).value;
  await waitFor(() => expect(collateral()).toBe('3'));
  pending[1].resolve(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(collateral()).toBe('3');
});
