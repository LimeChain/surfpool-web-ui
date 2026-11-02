import { LosslessNumber } from 'lossless-json';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMarketMoveScenario,
  createMarketMoveScenario,
  expectAccount,
  knownTokenSymbols,
  type MarketMoveAdapter,
  moveValue,
  parseMarketMove,
  readAccounts,
  readProgramAccounts,
  readWithClock,
} from './market-move';

const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const KIND = { name: 'Fake', owner: 'program', discriminator: [240, 175, 97, 143, 147, 159, 113, 67], minLength: 9 };

// A server that answers with `body` and records what it was sent.
const stubFetch = (body: unknown, ok = true) => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
    ok,
    json: async () => body,
    text: async () => String(body),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};
const sentParams = (fetchMock: ReturnType<typeof stubFetch>) => JSON.parse(`${fetchMock.mock.calls[0][1].body}`).params;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('market move math', () => {
  it.each([
    ['-20', '-20%', 80, 100],
    ['12.5', '+12.5%', 1125, 1000],
    [' +05 ', '+5%', 105, 100],
    ['-99.9999', '-99.9999%', 1, 1000000],
  ])('reads %j as %s', (text, label, numerator, denominator) => {
    expect(parseMarketMove(text)).toEqual({ label, numerator: BigInt(numerator), denominator: BigInt(denominator) });
  });

  it.each(['0', '-0.0', '-100', '-150', '1.23456', 'abc', '1e3', '', '%5'])('refuses %j', (text) => {
    expect(parseMarketMove(text)).toBeNull();
  });

  it('moves a value exactly, rounds half up and refuses a result of zero or past the maximum', () => {
    expect(moveValue(BigInt(1000000), parseMarketMove('-20')!)).toBe(BigInt(800000));
    expect(moveValue(BigInt('18446744073709551615'), parseMarketMove('-50')!)).toBe(BigInt('9223372036854775808'));
    expect(moveValue(BigInt(3), parseMarketMove('50')!)).toBe(BigInt(5));
    expect(() => moveValue(BigInt(1), parseMarketMove('-60')!)).toThrow('A -60% move takes 1 out of range');
    expect(() => moveValue(BigInt(10), parseMarketMove('100')!, BigInt(19))).toThrow('out of range');
  });

  it('collects the symbols the served token catalogs carry', () => {
    const symbols = knownTokenSymbols([
      { id: 'a', constants: { token_mint: { options: [{ value: 'mint-1', metadata: { symbol: 'SOL' } }] } } },
      { id: 'b', constants: { fee_tier: { options: [{ value: '1', metadata: { index: 1 } }] } } },
      { id: 'c' },
    ]);
    expect([...symbols]).toEqual([['mint-1', 'SOL']]);
  });
});

describe('surfnet reads', () => {
  it('reads accounts as base64 with an optional slice, and program accounts by discriminator', async () => {
    let fetchMock = stubFetch({ result: { value: [{ owner: 'program', data: [base64([1, 2]), 'base64'] }, null] } });
    await expect(readAccounts('http://rpc', ['a', 'b'], { offset: 0, length: 2 })).resolves.toEqual([
      { owner: 'program', data: new Uint8Array([1, 2]) },
      null,
    ]);
    expect(sentParams(fetchMock)).toEqual([['a', 'b'], { encoding: 'base64', dataSlice: { offset: 0, length: 2 } }]);

    fetchMock = stubFetch({ result: [{ pubkey: 'market-1', account: { data: [base64([9]), 'base64'] } }] });
    await expect(readProgramAccounts('http://rpc', KIND, { offset: 0, length: 1 })).resolves.toEqual([
      { address: 'market-1', data: new Uint8Array([9]) },
    ]);
    expect(sentParams(fetchMock)[1].filters).toEqual([{ memcmp: { offset: 0, bytes: 'hFwv1prLTHL' } }]);
  });

  it('reads the Clock slot and unix time with the account', async () => {
    const clock = new Uint8Array(40);
    new DataView(clock.buffer).setBigUint64(0, BigInt(456351600), true);
    new DataView(clock.buffer).setBigInt64(32, BigInt(1800000000), true);
    stubFetch({ result: { value: [null, { owner: 'sysvar', data: [base64([...clock]), 'base64'] }] } });

    await expect(readWithClock('http://rpc', 'feed')).resolves.toEqual({
      account: null,
      slot: BigInt(456351600),
      unixTimestamp: BigInt(1800000000),
    });
  });

  it('refuses an account of another owner or kind, or a shorter one', () => {
    const data = new Uint8Array([...KIND.discriminator, 0]);
    expect(expectAccount({ owner: 'program', data }, 'addr', KIND)).toBe(data);
    for (const account of [
      { owner: 'other', data },
      { owner: 'program', data: new Uint8Array([1, ...data.subarray(1)]) },
      { owner: 'program', data: data.subarray(0, 8) },
      null,
    ]) {
      expect(() => expectAccount(account, 'addr', KIND)).toThrow('addr is not a Fake account');
    }
  });
});

describe('createMarketMoveScenario', () => {
  it('posts u64 values losslessly and surfaces a refusal', async () => {
    const adapter = { protocol: 'fake', label: 'Fake', fetchBeforeUse: true } as MarketMoveAdapter;
    const market = { label: 'SOL / USDC', value: 'market', account: 'market' };
    const values = { price: new LosslessNumber('18446744073709551615') };
    const override = { templateId: 'fake-price', label: 'Fake move', account: { pubkey: 'market' }, values };
    const scenario = buildMarketMoveScenario(adapter, market, parseMarketMove('-20')!, [override]);

    const fetchMock = stubFetch({ id: 'id-1' });
    await expect(createMarketMoveScenario('http://studio', scenario)).resolves.toEqual({ id: 'id-1' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://studio/v1/scenarios');
    expect(fetchMock.mock.calls[0][1].body).toContain('"price":18446744073709551615');

    stubFetch('unknown template', false);
    await expect(createMarketMoveScenario('http://studio', scenario)).rejects.toThrow('unknown template');
  });
});
