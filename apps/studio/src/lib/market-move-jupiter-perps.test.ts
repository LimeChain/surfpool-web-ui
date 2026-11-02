import { getAddressEncoder, type Address } from '@solana/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { truncateAddress } from './address-utils';
import { parseMarketMove } from './market-move';
import { jupiterPerpsMarketMove } from './market-move-jupiter-perps';

const POOL = '5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq';
const SOL = 'So11111111111111111111111111111111111111112';
const ETH = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';
const SOL_CUSTODY = '7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz';
const ETH_CUSTODY = 'AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn';
const SOL_FEED = 'FYq2BWQ1V5P1WFBqr3qB2Kb5yHVvSv7upzKodgQE5zXh';
const ETH_FEED = 'AFZnHPzy4mvVCffrVwhewHbFc93uTHvDSFrVH7GtfXF1';

// An account of `length` bytes owned by `owner`, starting with `head` and holding `keys` at their offsets.
const account = (owner: string, length: number, head: number[], keys: Record<number, string> = {}) => {
  const data = new Uint8Array(length);
  data.set(head);
  for (const [offset, key] of Object.entries(keys)) data.set(getAddressEncoder().encode(key as Address), +offset);
  return { owner, data, view: new DataView(data.buffer) };
};
const encoded = ({ owner, data }: { owner: string; data: Uint8Array }) => ({
  owner,
  data: [btoa(String.fromCharCode(...data)), 'base64'],
});

const PERPS = 'PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu';
const CUSTODY_HEAD = [1, 184, 48, 81, 93, 131, 63, 145];
const pool = account(PERPS, 84, [241, 154, 109, 4, 17, 177, 109, 188, 4, 0, 0, 0, 80, 111, 111, 108, 2], {
  20: SOL_CUSTODY,
  52: ETH_CUSTODY,
});
const feed = account('DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e', 266, [112, 249, 139, 217, 215, 208, 249, 54]);
feed.view.setBigUint64(168, BigInt(15000000000), true);

const accounts: Record<string, unknown> = {
  [POOL]: encoded(pool),
  [SOL_CUSTODY]: encoded(account(PERPS, 2000, CUSTODY_HEAD, { 40: SOL, 384: SOL_FEED })),
  [ETH_CUSTODY]: encoded(account(PERPS, 2000, CUSTODY_HEAD, { 40: ETH, 384: ETH_FEED })),
  [SOL_FEED]: encoded(feed),
  [ETH_FEED]: encoded(feed),
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const [addresses] = JSON.parse(init.body).params;
      return {
        ok: true,
        json: async () => ({ result: { value: addresses.map((key: string) => accounts[key] ?? null) } }),
      };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('jupiterPerpsMarketMove', () => {
  it("lists the JLP Pool's custodies by token with their Doves feeds, and reads only a custody when typed", async () => {
    await expect(jupiterPerpsMarketMove.listMarkets('http://rpc', new Map([[SOL, 'SOL']]))).resolves.toEqual([
      { label: 'SOL', value: SOL_CUSTODY, account: SOL_FEED },
      { label: truncateAddress(ETH), value: ETH_CUSTODY, account: ETH_FEED },
    ]);
    await expect(
      jupiterPerpsMarketMove.readMarket('http://rpc', ETH_CUSTODY, new Map([[ETH, 'ETH']]))
    ).resolves.toEqual({ label: 'ETH', value: ETH_CUSTODY, account: ETH_FEED });
    await expect(jupiterPerpsMarketMove.readMarket('http://rpc', SOL_FEED, new Map())).rejects.toThrow(
      `${SOL_FEED} is not a Jupiter Perps custody account`
    );
  });

  it('moves the feed price, refusing an account that is not a feed', async () => {
    const market = { label: 'SOL', value: SOL_CUSTODY, account: SOL_FEED };
    await expect(jupiterPerpsMarketMove.buildOverrides('http://rpc', market, parseMarketMove('-20')!)).resolves.toEqual(
      [
        {
          templateId: 'jupiter-perps-doves-price',
          label: 'Jupiter Perps SOL price -20%',
          account: { pubkey: SOL_FEED },
          values: { price: 12000000000 },
        },
      ]
    );

    const wrong = { label: 'ETH', value: ETH_CUSTODY, account: ETH_CUSTODY };
    await expect(jupiterPerpsMarketMove.buildOverrides('http://rpc', wrong, parseMarketMove('5')!)).rejects.toThrow(
      `${ETH_CUSTODY} is not a Doves price feed account`
    );
  });
});
