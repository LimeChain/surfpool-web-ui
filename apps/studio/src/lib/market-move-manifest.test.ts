import { getAddressDecoder, getAddressEncoder, type Address } from '@solana/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { truncateAddress } from './address-utils';
import { parseMarketMove } from './market-move';
import { manifestMarketMove } from './market-move-manifest';

const MANIFEST = 'MNFSTqtC93rEfYHB6hF82sKdZpUDFWkViLByLd1k1Ms';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const key = (byte: number) => getAddressDecoder().decode(new Uint8Array(32).fill(byte));
const [QUIET, BUSY] = [1, 2].map(key);

const header = (base: string, quote: string, orders: number) => {
  const data = new Uint8Array(152);
  data.set([240, 175, 97, 143, 147, 159, 113, 67]);
  data.set(getAddressEncoder().encode(base as Address), 16);
  data.set(getAddressEncoder().encode(quote as Address), 48);
  new DataView(data.buffer).setBigUint64(144, BigInt(orders), true);
  return [btoa(String.fromCharCode(...data)), 'base64'];
};

const stubRpc = (result: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ result }) }))
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('manifestMarketMove', () => {
  it('lists the markets busiest first, named by the known symbols or short mints', async () => {
    stubRpc([
      { pubkey: QUIET, account: { data: header(QUIET, USDC, 3) } },
      { pubkey: BUSY, account: { data: header(SOL, USDC, 9000) } },
    ]);

    await expect(manifestMarketMove.listMarkets('http://rpc', new Map([[SOL, 'SOL']]))).resolves.toEqual([
      { label: `SOL / ${truncateAddress(USDC)}`, value: BUSY, account: BUSY },
      { label: `${truncateAddress(QUIET)} / ${truncateAddress(USDC)}`, value: QUIET, account: QUIET },
    ]);
  });

  it('reads a typed market and refuses an account of another owner', async () => {
    stubRpc({ value: [{ owner: MANIFEST, data: header(SOL, USDC, 1) }] });
    const symbols = new Map([
      [SOL, 'SOL'],
      [USDC, 'USDC'],
    ]);
    await expect(manifestMarketMove.readMarket('http://rpc', BUSY, symbols)).resolves.toMatchObject({
      label: 'SOL / USDC',
    });

    stubRpc({ value: [{ owner: '11111111111111111111111111111111', data: header(SOL, USDC, 1) }] });
    await expect(manifestMarketMove.readMarket('http://rpc', BUSY, symbols)).rejects.toThrow(
      `${BUSY} is not a Manifest market account`
    );
  });

  it.each([
    ['-20', '800000'],
    ['12.5', '1125000'],
    ['-99.9999', '1'],
  ])('shifts both sides of the book by %s%% as ratio_ppm %s', async (percent, ratio) => {
    const market = { label: 'SOL / USDC', value: BUSY, account: BUSY };
    const [override] = await manifestMarketMove.buildOverrides('http://rpc', market, parseMarketMove(percent)!);

    expect(override).toMatchObject({
      templateId: 'manifest-book-shift',
      account: { pubkey: BUSY },
      values: { ratio_ppm: ratio, side: 'both' },
    });
  });
});
