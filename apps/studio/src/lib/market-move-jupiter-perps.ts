import {
  type AccountKind,
  dataView,
  expectAccount,
  type MarketMoveAdapter,
  type MarketMoveMarket,
  moveValue,
  pubkeyAt,
  readAccounts,
  tokenSymbol,
  type TokenSymbols,
} from './market-move';
import { toScenarioNumber } from './scenarios-api';

const PERPS_PROGRAM = 'PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu';
const JLP_POOL = '5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq';
const POOL: AccountKind = {
  name: 'JLP Pool',
  owner: PERPS_PROGRAM,
  discriminator: [241, 154, 109, 4, 17, 177, 109, 188],
  minLength: 12,
};
// A Custody holds its mint at 40 and its doves_ag_oracle at 384.
const CUSTODY: AccountKind = {
  name: 'Jupiter Perps custody',
  owner: PERPS_PROGRAM,
  discriminator: [1, 184, 48, 81, 93, 131, 63, 145],
  minLength: 416,
};
// An AgPriceFeed holds its u64 price at 168.
const FEED: AccountKind = {
  name: 'Doves price feed',
  owner: 'DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e',
  discriminator: [112, 249, 139, 217, 215, 208, 249, 54],
  minLength: 176,
};

// The Pool starts with its name as a Borsh string, then lists its custodies as a u32 count and pubkeys.
function poolCustodies(pool: Uint8Array): string[] {
  const tooShort = 'The JLP Pool is shorter than its custody list';
  const countOffset = 12 + dataView(pool).getUint32(8, true);
  if (pool.length < countOffset + 4) throw new Error(tooShort);
  const count = dataView(pool).getUint32(countOffset, true);
  if (pool.length < countOffset + 4 + count * 32) throw new Error(tooShort);
  return Array.from({ length: count }, (_, index) => pubkeyAt(pool, countOffset + 4 + index * 32));
}

async function readPoolCustodies(rpcUrl: string) {
  const [pool] = await readAccounts(rpcUrl, [JLP_POOL]);
  const custodies = poolCustodies(expectAccount(pool, JLP_POOL, POOL));
  const accounts = await readAccounts(rpcUrl, custodies);
  return custodies.map((custody, index) => ({ custody, data: expectAccount(accounts[index], custody, CUSTODY) }));
}

const toMarket = (custody: string, data: Uint8Array, symbols: TokenSymbols): MarketMoveMarket => ({
  label: tokenSymbol(pubkeyAt(data, 40), symbols),
  value: custody,
  account: pubkeyAt(data, 384),
});

export const jupiterPerpsMarketMove: MarketMoveAdapter = {
  protocol: 'jupiter-perps',
  label: 'Jupiter Perps',
  templateId: 'jupiter-perps-doves-price',
  // The price is derived from the feed read below, which also loads it into the local VM. Play writes that
  // copy; a refetch would put the derived price on a newer feed.
  fetchBeforeUse: false,
  listMarkets: async (rpcUrl, symbols) =>
    (await readPoolCustodies(rpcUrl)).map(({ custody, data }) => toMarket(custody, data, symbols)),
  readMarket: async (rpcUrl, address, symbols) => {
    const [account] = await readAccounts(rpcUrl, [address]);
    return toMarket(address, expectAccount(account, address, CUSTODY), symbols);
  },
  buildOverrides: async (rpcUrl, market, move) => {
    const [account] = await readAccounts(rpcUrl, [market.account]);
    const price = moveValue(dataView(expectAccount(account, market.account, FEED)).getBigUint64(168, true), move);
    return [
      {
        templateId: 'jupiter-perps-doves-price',
        label: `Jupiter Perps ${market.label} price ${move.label}`,
        account: { pubkey: market.account },
        values: { price: toScenarioNumber(price.toString()) },
      },
    ];
  },
};
