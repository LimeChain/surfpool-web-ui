import { getAddressDecoder, getAddressEncoder, type Address } from '@solana/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOCK_SYSVAR, parseMarketMove } from './market-move';
import { velocityMarketMove } from './market-move-velocity';

const VELOCITY = 'vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P';
const key = (byte: number) => getAddressDecoder().decode(new Uint8Array(32).fill(byte));
const [SOL_PERP, BTC_PERP, SOL_ORACLE, BTC_ORACLE] = [1, 2, 3, 4].map(key);

const encoded = (data: Uint8Array) => [btoa(String.fromCharCode(...data)), 'base64'];

const perpMarket = (name: string, index: number, oracle: string) => {
  const data = new Uint8Array(642);
  data.set([10, 223, 12, 44, 107, 245, 55, 247]);
  data.set(getAddressEncoder().encode(oracle as Address), 312);
  data.set(new TextEncoder().encode(name.padEnd(32, ' ')), 424);
  new DataView(data.buffer).setUint16(640, index, true);
  return encoded(data);
};

const oracle = new Uint8Array(48);
oracle.set([159, 7, 161, 249, 34, 81, 121, 133]);
new DataView(oracle.buffer).setBigInt64(8, BigInt(15000000000), true);
new DataView(oracle.buffer).setBigUint64(40, BigInt(5000000), true);
const clock = new Uint8Array(40);
new DataView(clock.buffer).setBigUint64(0, BigInt(456351600), true);
new DataView(clock.buffer).setBigInt64(32, BigInt(1800000000), true);

const stubRpc = (result: unknown) => {
  const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({
    ok: true,
    json: async () => ({ result }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return () => JSON.parse(fetchMock.mock.calls[0][1].body).params;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('velocityMarketMove', () => {
  it('lists the perp markets by name in market index order, each with its oracle', async () => {
    const sentParams = stubRpc([
      { pubkey: BTC_PERP, account: { data: perpMarket('BTC-PERP', 1, BTC_ORACLE) } },
      { pubkey: SOL_PERP, account: { data: perpMarket('SOL-PERP', 0, SOL_ORACLE) } },
    ]);

    await expect(velocityMarketMove.listMarkets('http://rpc', new Map())).resolves.toEqual([
      { label: 'SOL-PERP', value: SOL_PERP, account: SOL_ORACLE },
      { label: 'BTC-PERP', value: BTC_PERP, account: BTC_ORACLE },
    ]);
    expect(sentParams()[1].filters).toEqual([{ memcmp: { offset: 0, bytes: '2pTyMkwXuti' } }]);
  });

  it('reads a typed perp market and refuses an oracle typed in its place', async () => {
    stubRpc({ value: [{ owner: VELOCITY, data: perpMarket('SOL-PERP', 0, SOL_ORACLE) }] });
    await expect(velocityMarketMove.readMarket('http://rpc', SOL_PERP, new Map())).resolves.toMatchObject({
      account: SOL_ORACLE,
    });

    stubRpc({ value: [{ owner: VELOCITY, data: encoded(oracle) }] });
    await expect(velocityMarketMove.readMarket('http://rpc', SOL_ORACLE, new Map())).rejects.toThrow(
      `${SOL_ORACLE} is not a Velocity perp market account`
    );
  });

  it('moves the oracle price, posts it at the Clock, and scales conf with it', async () => {
    const sentParams = stubRpc({
      value: [
        { owner: VELOCITY, data: encoded(oracle) },
        { owner: 'Sysvar1111111111111111111111111111111111111', data: encoded(clock) },
      ],
    });
    const market = { label: 'SOL-PERP', value: SOL_PERP, account: SOL_ORACLE };

    const [override] = await velocityMarketMove.buildOverrides('http://rpc', market, parseMarketMove('-20')!);

    expect(sentParams()[0]).toEqual([SOL_ORACLE, CLOCK_SYSVAR]);
    expect(override).toEqual({
      templateId: 'velocity-oracle-price',
      label: 'Velocity SOL-PERP oracle price -20%',
      account: { pubkey: SOL_ORACLE },
      values: { price: 12000000000, conf: 4000000, posted_slot: 456351600, publish_time: 1800000000000000 },
    });
  });
});
