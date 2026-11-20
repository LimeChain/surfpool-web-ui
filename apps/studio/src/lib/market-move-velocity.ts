import {
  type AccountKind,
  dataView,
  expectAccount,
  I64_MAX,
  type MarketMoveAdapter,
  type MarketMoveMarket,
  moveValue,
  pubkeyAt,
  readAccounts,
  readProgramAccounts,
  readWithClock,
} from './market-move';
import { toScenarioNumber } from './scenarios-api';

const VELOCITY_PROGRAM = 'vELoC1audYbSYVRXn1vPaV8Axoa9oU6BYmNGZZBDZ1P';
// A PerpMarket holds its oracle at 312, its name as 32 ASCII bytes at 424 and its u16 market_index at 640.
const MARKET_HEAD = { offset: 0, length: 642 };
const PERP_MARKET: AccountKind = {
  name: 'Velocity perp market',
  owner: VELOCITY_PROGRAM,
  discriminator: [10, 223, 12, 44, 107, 245, 55, 247],
  minLength: MARKET_HEAD.length,
};
// A PythLazerOracle holds its i64 price at 8 and its u64 conf at 40.
const ORACLE: AccountKind = {
  name: 'Velocity oracle',
  owner: VELOCITY_PROGRAM,
  discriminator: [159, 7, 161, 249, 34, 81, 121, 133],
  minLength: 48,
};

const marketIndex = (data: Uint8Array) => dataView(data).getUint16(640, true);

const toMarket = (address: string, data: Uint8Array): MarketMoveMarket => ({
  label: new TextDecoder().decode(data.subarray(424, 456)).replace(/[\s\0]+$/, ''),
  value: address,
  account: pubkeyAt(data, 312),
});

export const velocityMarketMove: MarketMoveAdapter = {
  protocol: 'velocity',
  label: 'Velocity',
  templateId: 'velocity-oracle-price',
  // The price is derived from the oracle read below, which also loads it into the local VM. Play writes
  // that copy; a refetch would put the derived price on a newer oracle.
  fetchBeforeUse: false,
  listMarkets: async (rpcUrl) => {
    const markets = await readProgramAccounts(rpcUrl, PERP_MARKET, MARKET_HEAD);
    return markets
      .sort((a, b) => marketIndex(a.data) - marketIndex(b.data))
      .map(({ address, data }) => toMarket(address, data));
  },
  readMarket: async (rpcUrl, address) => {
    const [account] = await readAccounts(rpcUrl, [address], MARKET_HEAD);
    return toMarket(address, expectAccount(account, address, PERP_MARKET));
  },
  buildOverrides: async (rpcUrl, market, move) => {
    const { account, slot, unixTimestamp } = await readWithClock(rpcUrl, market.account);
    const oracle = dataView(expectAccount(account, market.account, ORACLE));
    const price = moveValue(oracle.getBigInt64(8, true), move, I64_MAX);
    const conf = (oracle.getBigUint64(40, true) * move.numerator) / move.denominator;
    return [
      {
        templateId: 'velocity-oracle-price',
        label: `Velocity ${market.label} oracle price ${move.label}`,
        account: { pubkey: market.account },
        // conf moves with the price.
        values: {
          price: toScenarioNumber(price.toString()),
          conf: toScenarioNumber(conf.toString()),
          posted_slot: toScenarioNumber(slot.toString()),
          publish_time: toScenarioNumber((unixTimestamp * BigInt(1000000)).toString()),
        },
      },
    ];
  },
};
