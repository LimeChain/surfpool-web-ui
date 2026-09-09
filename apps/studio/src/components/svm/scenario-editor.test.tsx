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
