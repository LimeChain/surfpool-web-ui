import type { FeaturedAccounts, FeaturedProtocol } from './featured-accounts';

/** The GoonFi markets Studio offers as shortcuts; any other GoonFi account can be typed instead. */
export const GOONFI_FEATURED_MARKETS = [
  {
    id: 'sol-usdc',
    label: 'SOL / USDC',
    market: 'GMCJvYGf5Ex2ARiMquaBDqU6iKM8uiEQkB8jCnoNfHpC',
    oracle: '7yecFG22heommABQ5svcbQLK1Ua4ZrJsHPiktZ17jfm3',
    baseSymbol: 'SOL',
    baseMint: 'So11111111111111111111111111111111111111112',
    baseVault: '8ncU5YW1CQwvr4gs7buH57bW58e86TDau4STrCJBuz8z',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteVault: 'EunHLeqeJKvxnCPQSytnBP63HJVk2fbHceiKKpngyAo8',
  },
  {
    id: 'hype-usdc',
    label: 'HYPE / USDC',
    market: '8TDBxPXyGvxcaoHZoY5D4X2vePuhMYekKpTEhEhaQX5b',
    oracle: 'GHjEJbxWcT55xWCucjSRUJAxxVXD8wXsLUAToBWTUPBa',
    baseSymbol: 'HYPE',
    baseMint: '98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g',
    baseVault: 'FDNiPEBtf5gTzX91wc3H2riudcFdXzz1k8kJJaZP4MyJ',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteVault: 'G4zxFHdZ8nqeHeX9bvhRLfFYGEeZLSVQhRdK5BTGaEwh',
  },
  {
    id: 'jup-usdc',
    label: 'JUP / USDC',
    market: 'AkxuRa1soguFpVRjnDrRsXAcfTkZjRv1XyNXySzVivmC',
    oracle: 'APkXGniPLaXoUeRYrdBwgZE7ky9n1xkiMyrYQH9xsMzS',
    baseSymbol: 'JUP',
    baseMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    baseVault: 'G39Mthg4bixLGYRzHqjfRdpyAWSJGH5CiUC4grTMpwyd',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteVault: 'GFcj7sRkYqoNCiEkXWxapY7D28UCmAqBjiqGNQGydha4',
  },
  {
    id: 'pump-usdc',
    label: 'PUMP / USDC',
    market: 'FkGgvNwKBMkDAWStXx7C9CbYiwTCHq2pFrkWHkvS9eJg',
    oracle: '14kCeUADn4r4sJKFX78b9qibo9JfgZQdWGED3tqJqe4t',
    baseSymbol: 'PUMP',
    baseMint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    baseVault: 'BUiRksN6oyCNeDqjPHvtWedVKWFQeiBo5Ft5HeucmTgw',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteVault: '8iR3pQ7MSZidfu2mP2NtYmSq9prdz3u6mhbRmRbJcx6h',
  },
] as const;

// A market or vault override keeps its market's oracle alive through its `oracle` input, which a featured
// market or vault fills.
const goonfiMarkets: FeaturedAccounts = {
  label: 'GoonFi market',
  description: 'Pick a featured market or type any GoonFi market address.',
  options: GOONFI_FEATURED_MARKETS.map((market) => ({
    id: market.id,
    label: market.label,
    value: market.market,
    description: 'Market account',
    inputs: { oracle: market.oracle },
  })),
};

const goonfiOracles: FeaturedAccounts = {
  label: 'GoonFi oracle',
  description: 'Pick a featured oracle or type any GoonFi oracle address.',
  options: GOONFI_FEATURED_MARKETS.map((market) => ({
    id: market.id,
    label: market.label,
    value: market.oracle,
    description: 'Oracle account',
  })),
};

const goonfiVaults: FeaturedAccounts = {
  label: 'GoonFi vault',
  description: 'Pick a featured payout vault or type any GoonFi vault address.',
  options: GOONFI_FEATURED_MARKETS.flatMap((market) => [
    {
      id: `${market.id}-base`,
      label: `${market.label} (${market.baseSymbol} vault)`,
      value: market.baseVault,
      description: 'Base payout vault',
      inputs: { oracle: market.oracle },
    },
    {
      id: `${market.id}-quote`,
      label: `${market.label} (${market.quoteSymbol} vault)`,
      value: market.quoteVault,
      description: 'Quote payout vault',
      inputs: { oracle: market.oracle },
    },
  ]),
};

export const GOONFI_FEATURED: FeaturedProtocol = {
  protocol: 'goonfi',
  templates: {
    'goonfi-price': goonfiOracles,
    'goonfi-reference-band': goonfiMarkets,
    'goonfi-size-impact': goonfiMarkets,
    'goonfi-vault-balance': goonfiVaults,
  },
  aiContext: () =>
    [
      'Featured GoonFi accounts available in Studio:',
      ...GOONFI_FEATURED_MARKETS.map(
        (market) =>
          `- ${market.label}: market ${market.market}; oracle ${market.oracle}; ` +
          `${market.baseSymbol} vault ${market.baseVault}; ` +
          `${market.quoteSymbol} vault ${market.quoteVault}.`
      ),
    ].join('\n'),
};
