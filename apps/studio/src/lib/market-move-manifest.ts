import {
  type AccountKind,
  dataView,
  expectAccount,
  type MarketMoveAdapter,
  type MarketMoveMarket,
  moveValue,
  pubkeyAt,
  readAccounts,
  readProgramAccounts,
  tokenSymbol,
  type TokenSymbols,
} from './market-move';

// The header up to order_sequence_number (a u64 at 144), with the base mint at 16 and the quote mint at 48.
const HEADER = { offset: 0, length: 152 };
const MARKET: AccountKind = {
  name: 'Manifest market',
  owner: 'MNFSTqtC93rEfYHB6hF82sKdZpUDFWkViLByLd1k1Ms',
  discriminator: [240, 175, 97, 143, 147, 159, 113, 67],
  minLength: HEADER.length,
};

const toMarket = (address: string, header: Uint8Array, symbols: TokenSymbols): MarketMoveMarket => ({
  label: `${tokenSymbol(pubkeyAt(header, 16), symbols)} / ${tokenSymbol(pubkeyAt(header, 48), symbols)}`,
  value: address,
  account: address,
});

const orderSequence = (header: Uint8Array) => dataView(header).getBigUint64(144, true);

// Every order and swap bumps the sequence number, so the busiest markets sort first.
const busiestFirst = (a: { data: Uint8Array }, b: { data: Uint8Array }) => {
  const difference = orderSequence(b.data) - orderSequence(a.data);
  return difference > BigInt(0) ? 1 : difference < BigInt(0) ? -1 : 0;
};

export const manifestMarketMove: MarketMoveAdapter = {
  protocol: 'manifest',
  label: 'Manifest',
  templateId: 'manifest-book-shift',
  // The ratio applies to whatever book Play finds, so fetching a newer one first is safe.
  fetchBeforeUse: true,
  listMarkets: async (rpcUrl, symbols) => {
    const markets = await readProgramAccounts(rpcUrl, MARKET, HEADER);
    return markets.sort(busiestFirst).map(({ address, data }) => toMarket(address, data, symbols));
  },
  readMarket: async (rpcUrl, address, symbols) => {
    const [account] = await readAccounts(rpcUrl, [address], HEADER);
    return toMarket(address, expectAccount(account, address, MARKET), symbols);
  },
  buildOverrides: async (_rpcUrl, market, move) => [
    {
      templateId: 'manifest-book-shift',
      label: `Manifest ${market.label} book shift ${move.label}`,
      account: { pubkey: market.account },
      values: { ratio_ppm: moveValue(BigInt(1000000), move).toString(), side: 'both' },
    },
  ],
};
