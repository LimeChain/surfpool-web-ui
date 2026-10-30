import { fetchDynamicRefOptions } from '@/lib/scenarios-api';
import { comboboxResults } from '@/test-utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ScenarioEditor from './scenario-editor';

vi.mock('@/hooks/use-app-config', () => ({
  useAppConfig: () => ({ studioUrl: 'http://studio', rpcUrl: 'http://rpc' }),
}));
vi.mock('@surfpool/ui', async () => ({
  Combobox: (await import('@/test-utils')).MockCombobox,
  ComboboxLabel: ({ children }: any) => <span>{children}</span>,
  ComboboxOption: ({ children }: any) => <div>{children}</div>,
  Dropdown: ({ children }: any) => <div>{children}</div>,
  DropdownButton: ({ children, title }: any) => <button title={title}>{children}</button>,
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  DropdownLabel: ({ children }: any) => <span>{children}</span>,
  DropdownDescription: ({ children }: any) => <span>{children}</span>,
  Select: ({ children, ...props }: any) => <select {...props}>{children}</select>,
  Switch: ({ checked, onChange }: any) => <input type="checkbox" checked={checked} onChange={onChange} />,
}));
vi.mock('./transaction-inspector', () => ({ default: () => null }));
vi.mock('@/lib/scenarios-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/scenarios-api')>()),
  fetchDynamicRefOptions: vi.fn().mockResolvedValue([]),
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

const PAUSED_CLOCK_WARNING_TEXT =
  'Time-sensitive scenario: pausing the clock may make the program refuse transactions due to time mismatches. Running clock is recommended.';

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(fetchDynamicRefOptions).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderEditor(
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
}

async function openEditor(
  template: any = collateralTemplate,
  values: Record<string, unknown> = {},
  account: unknown = template.address
) {
  await renderEditor(template, values, account);
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
  expect(await screen.findByLabelText('symbol')).toHaveValue('Custom · SOL');
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

it('rebuilds a saved derived (PDA) address from the template when updating it', async () => {
  const pda = { pda: { programId: 'pool-program', seeds: [{ string: 'pool' }, { propertyRef: 'mint' }] } };
  const template = { ...collateralTemplate, address: pda };
  const resolvedSeeds = { pda: { programId: 'pool-program', seeds: [{ string: 'pool' }, { pubkey: 'OldMint' }] } };
  await openEditor(template, { 'traderState.quoteLotCollateral': '1' }, resolvedSeeds);
  fireEvent.change(await screen.findByPlaceholderText('Enter quoteLotCollateral...'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(JSON.parse(patch![1].body).overrides[0].account).toEqual(pda);
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
    name: 'Maintenance margin',
    id: 'phoenix-maintenance-margin-stress',
    prices: ['maintenance_risk_factor_bps'],
  },
];

const marketTemplate = (market: (typeof marketTemplates)[number]) => ({
  ...collateralTemplate,
  ...market,
  accountType: 'PerpAssetMap',
  address: { pubkey: 'template-map' },
  properties: [
    { path: 'symbol', type: 'dynamic_ref', source: 'list_phoenix_markets' },
    ...market.prices.map((path) => ({ path, type: 'input', value_type: 'string' })),
  ],
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
});

for (const market of marketTemplates) {
  it('edits and saves ' + market.name + ' using input template fields', async () => {
    const template = marketTemplate(market);
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
    expect(await screen.findByLabelText('symbol')).toHaveValue('Custom · SOL');
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

const rpcParams = () =>
  fetchMock.mock.calls.filter(([url]) => url === 'http://rpc').map(([, init]) => JSON.parse(init.body).params);
const rpcAccounts = () => rpcParams().map(([account]) => account);

it('fetches the saved account when reopening a saved override', async () => {
  const template = { ...collateralTemplate, address: { pubkey: 'template-trader' } };
  await openEditor(template, {}, { pubkey: 'saved-trader' });
  await waitFor(() => expect(rpcAccounts()).toEqual(['saved-trader']));
});

it('reads the account of a template with IDL fields as parsed JSON', async () => {
  await openEditor();
  await waitFor(() => expect(rpcParams()).toEqual([['trader', { commitment: 'confirmed', encoding: 'jsonParsed' }]]));
});

for (const market of marketTemplates) {
  it('sends only the inputs of a newly selected ' + market.name + ' action', async () => {
    const template = marketTemplate(market);
    vi.mocked(fetchDynamicRefOptions).mockResolvedValue([{ value: 'SOL', address: 'solOrderbook' }]);
    await openEditor(template);
    // As on a surfnet with the Phoenix IDL: jsonParsed decodes the map, base64 returns its bytes.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const config = url === 'http://rpc' ? JSON.parse(`${init?.body}`).params[1] : undefined;
      const data =
        config?.encoding === 'jsonParsed'
          ? { parsed: { numAssets: 90, padding0: [0, 0, 0, 0, 0, 0] } }
          : ['', 'base64'];
      return { ok: true, json: async () => ({ result: { value: { data } } }) };
    });

    fireEvent.click(await screen.findByRole('heading', { name: template.name }));
    fireEvent.click(await screen.findByRole('button', { name: 'SOL' }));
    const values: Record<string, string> = { symbol: 'SOL' };
    for (const name of market.prices) {
      fireEvent.change(await screen.findByPlaceholderText(`Enter ${name}...`), { target: { value: '1' } });
      values[name] = '1';
    }
    fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(JSON.parse(patch![1].body).overrides[0].values).toEqual(values);
    });
    expect(rpcParams().at(-1)).toEqual([
      'template-map',
      { commitment: 'confirmed', encoding: 'base64', dataSlice: { offset: 0, length: 0 } },
    ]);
  });
}

const savedSymbol = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Update Action' }));
  let symbol: unknown;
  await waitFor(() => {
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patch).toBeDefined();
    symbol = JSON.parse(patch![1].body).overrides[0].values.symbol;
  });
  return symbol;
};

it('picks the listed market a template field is given by symbol in any case or by orderbook address', async () => {
  const amat = 'AvPTRe4XjC1xdVhwzUiVwDDfqrqm6eVaKMAnS39raEjW';
  vi.mocked(fetchDynamicRefOptions).mockResolvedValue([
    { value: 'AMAT', address: amat },
    { value: 'AMD', address: 'ABBz13DENxvLRLh6pjHxNsxBPNNbEnfiMPPXrx8sK7qN' },
  ]);
  await openEditor(marketTemplate(marketTemplates[0]), { symbol: 'AMD', target_ticks: '1' }, { pubkey: 'saved-map' });
  const field = await screen.findByLabelText('symbol');
  await waitFor(() => expect(field).toHaveValue('AMD'));

  fireEvent.change(field, { target: { value: 'amat' } });
  expect(comboboxResults('symbol')).toEqual(['AMAT']);
  fireEvent.change(field, { target: { value: amat } });
  expect(comboboxResults('symbol')).toEqual(['AMAT']);
  fireEvent.click(screen.getByRole('button', { name: 'AMAT' }));

  expect(await savedSymbol()).toBe('AMAT');
});

it('keeps a value a template field has no option for as a custom value', async () => {
  const unlisted = '6tgCsPZqZi4rcQWLLgoMHE1XAnRqA7mYYRByGUYxyFwB';
  vi.mocked(fetchDynamicRefOptions).mockResolvedValue([
    { value: 'AMAT', address: 'AvPTRe4XjC1xdVhwzUiVwDDfqrqm6eVaKMAnS39raEjW' },
  ]);
  await openEditor(marketTemplate(marketTemplates[0]), { symbol: 'AMAT', target_ticks: '1' }, { pubkey: 'saved-map' });
  const field = await screen.findByLabelText('symbol');
  await waitFor(() => expect(field).toHaveValue('AMAT'));

  fireEvent.change(field, { target: { value: unlisted } });
  expect(comboboxResults('symbol')).toEqual([`Custom · ${unlisted}`]);
  fireEvent.click(screen.getByRole('button', { name: `Custom · ${unlisted}` }));

  expect(await savedSymbol()).toBe(unlisted);
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

it('keeps the later of two saved overrides reopened before the first one loaded', async () => {
  let releaseFirst = () => {};
  const firstLoaded = new Promise<void>((resolve) => (releaseFirst = resolve));
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(init?.body).includes('first-trader')) await firstLoaded;
    return {
      ok: true,
      json: async () => (url.endsWith('/templates') ? [collateralTemplate] : { result: { value: null } }),
    };
  });
  const saved = (pubkey: string, collateral: string) => ({
    protocolId: 'phoenix-eternal',
    actionId: collateralTemplate.id,
    protocol: 'Phoenix Eternal',
    action: collateralTemplate.name,
    account: { pubkey },
    overrides: { 'traderState.quoteLotCollateral': collateral },
  });
  render(
    <ScenarioEditor
      scenarioId="race-test"
      initialSteps={[
        { id: 'slot', name: 'Slot', type: 'slot', actions: [saved('first-trader', '1'), saved('second-trader', '2')] },
      ]}
    />
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const savedAction = async (index: number) => (await screen.findAllByText(collateralTemplate.name))[index];
  // The first click selects the slot, the next ones reopen a saved override.
  fireEvent.click(await savedAction(0));
  fireEvent.click(await savedAction(0));
  await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).toContain('first-trader'));
  fireEvent.click(await savedAction(1));
  const input = await screen.findByPlaceholderText('Enter quoteLotCollateral...');
  await waitFor(() => expect(input).toHaveValue('2'));

  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getByPlaceholderText('Enter quoteLotCollateral...')).toHaveValue('2');
});

const rpcCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === 'http://rpc').map(([, init]) => JSON.parse(init.body));
const rpcMethods = () => rpcCalls().map((call) => call.method);

const clockSensitiveTemplate = { ...collateralTemplate, tags: ['clock-sensitive'] };

const column = (id: string) => ({
  id,
  name: 'Slot',
  type: 'slot' as const,
  actions: [
    {
      protocolId: 'phoenix-eternal',
      actionId: collateralTemplate.id,
      protocol: 'Phoenix Eternal',
      action: collateralTemplate.name,
      account: collateralTemplate.address,
      overrides: { 'traderState.quoteLotCollateral': id },
    },
  ],
});

const renderColumns = (template: any, ids: string[]) => {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (url.endsWith('/templates') ? [template] : { result: { absoluteSlot: 500 } }),
  }));
  render(<ScenarioEditor scenarioId="columns" initialSteps={ids.map(column)} />);
};

it('plays one column per produced slot: the first at Play, the next on each step', async () => {
  renderColumns(clockSensitiveTemplate, ['1', '2']);

  fireEvent.click(await screen.findByText('Play with paused clock'));
  await waitFor(() =>
    expect(rpcCalls().map((call) => call.method)).toEqual([
      'surfnet_registerScenario',
      'surfnet_pauseClock',
      'getEpochInfo',
      'surfnet_timeTravel',
    ])
  );
  const [first] = rpcCalls();
  expect(first.params[0].name).toBe('Scenario · column 1/2');
  expect(first.params[0].overrides).toHaveLength(1);
  expect(first.params[0].overrides[0]).toMatchObject({
    scenarioRelativeSlot: 0,
    values: { 'traderState.quoteLotCollateral': '1' },
  });

  fireEvent.click(await screen.findByTitle('Step forward'));
  await waitFor(() =>
    expect(
      rpcCalls()
        .map((call) => call.method)
        .slice(4)
    ).toEqual(['surfnet_registerScenario', 'getEpochInfo', 'surfnet_timeTravel'])
  );
  const [, , , , second, , timeTravel] = rpcCalls();
  expect(second.params[0].name).toBe('Scenario · column 2/2');
  expect(second.params[0].overrides).toHaveLength(1);
  expect(second.params[0].overrides[0]).toMatchObject({
    scenarioRelativeSlot: 0,
    values: { 'traderState.quoteLotCollateral': '2' },
  });
  expect(timeTravel.params).toEqual([{ absoluteSlot: 501 }]);
});

it('stays in read mode and never pauses the clock when the first column is rejected', async () => {
  await renderEditor(clockSensitiveTemplate);
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/templates')
        ? [clockSensitiveTemplate]
        : { error: { code: -32602, message: 'base slot 500 is already produced; the next slot is 501' } },
  }));
  fireEvent.click(await screen.findByText('Play with paused clock'));
  await waitFor(() => expect(rpcCalls().map((call) => call.method)).toEqual(['surfnet_registerScenario']));
  expect(screen.getByTitle('Play scenario')).toBeInTheDocument();
});

it('retries a step whose time travel failed without registering the column again', async () => {
  let failNextTimeTravel = false;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = url === 'http://rpc' ? JSON.parse(`${init?.body}`).method : undefined;
    if (method === 'surfnet_timeTravel' && failNextTimeTravel) {
      failNextTimeTravel = false;
      return { ok: true, json: async () => ({ error: { code: -32603, message: 'Failed to confirm clock update' } }) };
    }
    return {
      ok: true,
      json: async () => (url.endsWith('/templates') ? [clockSensitiveTemplate] : { result: { absoluteSlot: 500 } }),
    };
  });
  render(<ScenarioEditor scenarioId="retry" initialSteps={[column('1'), column('2')]} />);
  fireEvent.click(await screen.findByText('Play with paused clock'));
  await waitFor(() => expect(rpcCalls()).toHaveLength(4));

  failNextTimeTravel = true;
  fireEvent.click(await screen.findByTitle('Step forward'));
  await waitFor(() => expect(rpcCalls()).toHaveLength(7));
  expect(await screen.findByTitle('Step forward')).toBeInTheDocument();

  fireEvent.click(screen.getByTitle('Step forward'));
  await waitFor(() => expect(rpcCalls()).toHaveLength(9));
  expect(
    rpcCalls()
      .map((call) => call.method)
      .slice(4)
  ).toEqual(['surfnet_registerScenario', 'getEpochInfo', 'surfnet_timeTravel', 'getEpochInfo', 'surfnet_timeTravel']);
});

it('plays with the running clock: one registration per Play and per step, no pause or time travel', async () => {
  renderColumns(collateralTemplate, ['1', '2', '3']);

  fireEvent.click(await screen.findByText('Play with running clock'));
  await waitFor(() => expect(rpcMethods()).toEqual(['surfnet_registerScenario']));
  fireEvent.click(await screen.findByTitle('Step forward'));
  await waitFor(() => expect(rpcMethods()).toEqual(['surfnet_registerScenario', 'surfnet_registerScenario']));
  expect(rpcCalls()[1].params[0].overrides[0].values).toEqual({ 'traderState.quoteLotCollateral': '2' });

  fireEvent.click(await screen.findByTitle('Stop scenario'));
  expect(await screen.findByTitle('Play scenario')).toBeInTheDocument();
  expect(rpcMethods()).toEqual(['surfnet_registerScenario', 'surfnet_registerScenario']);
});

it('resumes the clock when a paused playback is stopped', async () => {
  renderColumns(clockSensitiveTemplate, ['1', '2']);
  fireEvent.click(await screen.findByText('Play with paused clock'));
  fireEvent.click(await screen.findByTitle('Stop scenario'));
  await waitFor(() => expect(rpcMethods().at(-1)).toBe('surfnet_resumeClock'));
});

it('plays to the slot after the processed one, which surfnet reads ahead of the finalized default', async () => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const body = url === 'http://rpc' ? JSON.parse(`${init?.body}`) : {};
    if (body.method === 'getEpochInfo') {
      const absoluteSlot = body.params?.[0]?.commitment === 'processed' ? 663 : 632;
      return { ok: true, json: async () => ({ result: { absoluteSlot } }) };
    }
    return {
      ok: true,
      json: async () => (url.endsWith('/templates') ? [collateralTemplate] : { result: { absoluteSlot: 500 } }),
    };
  });
  render(<ScenarioEditor scenarioId="processed" initialSteps={[column('1'), column('2')]} />);

  fireEvent.click(await screen.findByText('Play with paused clock'));
  await waitFor(() =>
    expect(rpcCalls().find((call) => call.method === 'surfnet_timeTravel')?.params).toEqual([{ absoluteSlot: 664 }])
  );
});

it('resumes the clock when a paused Play cannot move it to the next slot and registers the column again on the next Play', async () => {
  let failTimeTravel = true;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = url === 'http://rpc' ? JSON.parse(`${init?.body}`).method : undefined;
    if (method === 'surfnet_timeTravel' && failTimeTravel) {
      return { ok: true, json: async () => ({ error: { code: -32603, message: 'Failed to confirm clock update' } }) };
    }
    return {
      ok: true,
      json: async () => (url.endsWith('/templates') ? [collateralTemplate] : { result: { absoluteSlot: 500 } }),
    };
  });
  render(<ScenarioEditor scenarioId="advance-fails" initialSteps={[column('1')]} />);

  fireEvent.click(await screen.findByText('Play with paused clock'));
  await waitFor(() =>
    expect(rpcMethods()).toEqual([
      'surfnet_registerScenario',
      'surfnet_pauseClock',
      'getEpochInfo',
      'surfnet_timeTravel',
      'surfnet_resumeClock',
    ])
  );
  expect(screen.getByTitle('Play scenario')).toBeInTheDocument();

  failTimeTravel = false;
  fireEvent.click(screen.getByText('Play with paused clock'));
  await waitFor(() =>
    expect(rpcMethods().slice(5)).toEqual([
      'surfnet_registerScenario',
      'surfnet_pauseClock',
      'getEpochInfo',
      'surfnet_timeTravel',
    ])
  );
});

it('offers both clocks without a warning when no used template is clock-sensitive', async () => {
  await renderEditor();
  expect(await screen.findByText('Play with paused clock')).toBeInTheDocument();
  expect(screen.getByText('Play with running clock')).toBeInTheDocument();
  expect(screen.queryByText(/Time-sensitive scenario/)).not.toBeInTheDocument();
});

it('offers both clocks and warns on the paused one when a used template is clock-sensitive', async () => {
  await renderEditor(clockSensitiveTemplate);
  expect(await screen.findByText('Play with paused clock')).toBeInTheDocument();
  expect(screen.getByText('Play with running clock')).toBeInTheDocument();
  expect(screen.getByText(PAUSED_CLOCK_WARNING_TEXT)).toBeInTheDocument();
});
