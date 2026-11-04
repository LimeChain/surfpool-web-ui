import type { FeaturedAccounts, FeaturedProtocol } from './featured-accounts';

/** The HumidiFi markets Studio offers as shortcuts; any other HumidiFi account can be typed instead. */
export const HUMIDIFI_FEATURED_MARKETS = [
  {
    id: 'sol-usdc',
    label: 'SOL / USDC',
    market: '8sKQHfjNhvmAw94PhfvfMcytmqW6jmxvwieYyzXCCPu',
    baseSymbol: 'SOL',
    baseMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 9,
    baseVault: 'H292B1VbSvD6GuUmSvUvfQstg1Acfzog796uQ7d1ccCw',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
    quoteVault: 'A3C9xwv4Hfx92M5HQpxUiibSqCa5pYhD2kTwnU5fEPq',
  },
  {
    id: 'hype-usdc',
    label: 'HYPE / USDC',
    market: 'H3TyE2Q3rDrvRXD8PzHYE7BS2hafGuybje4qXCtyWqMH',
    baseSymbol: 'HYPE',
    baseMint: '98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g',
    baseDecimals: 9,
    baseVault: '49pft8q7cyugVDWnJCXjMHJdb5Uji198k5MognVvA48n',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
    quoteVault: 'EKFwmKoPA9o3HpoL8AnQd8uNBxtJbaPv4w4tbxNn6iei',
  },
  {
    id: 'jup-usdc',
    label: 'JUP / USDC',
    market: 'hKgG7iEDRFNsJSwLYqz8ETHuZwzh6qMMLow8VXa8pLm',
    baseSymbol: 'JUP',
    baseMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    baseDecimals: 6,
    baseVault: 'GRLhXC9eKoZMLBNQqRnNHg62hc4NM2Wm4amm7Aiz4ts',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
    quoteVault: 'AKaBxaHDdaJEJyQSHNRdLu7yN3JbDDkSG189ssTjSGW8',
  },
  {
    id: 'pump-usdc',
    label: 'PUMP / USDC',
    market: 'HyKbc1vUxNL9xJC2Q44qdGiuKC1Ey95KNdokfHivrFnZ',
    baseSymbol: 'PUMP',
    baseMint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    baseDecimals: 6,
    baseVault: '7CdAWd32k1c9ywpyErij2xRbBDRCLFqrZAXTUjD3ziek',
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
    quoteVault: 'Cad4XrQrtXdKEhZKtWX5YAkwumUvphZKw1cqpYXYnZDr',
  },
] as const;

const humidifiMarkets: FeaturedAccounts = {
  label: 'HumidiFi market',
  description: 'Pick a featured market or type any HumidiFi market address.',
  options: HUMIDIFI_FEATURED_MARKETS.map((market) => ({
    id: market.id,
    label: market.label,
    value: market.market,
    description: 'Market account',
  })),
};

// A vault override keeps its market quoting through its `market` input, which a featured vault fills.
const humidifiVaults: FeaturedAccounts = {
  label: 'HumidiFi vault',
  description: 'Pick a featured payout vault or type any HumidiFi vault address.',
  options: HUMIDIFI_FEATURED_MARKETS.flatMap((market) => [
    {
      id: `${market.id}-base`,
      label: `${market.label} (${market.baseSymbol} vault)`,
      value: market.baseVault,
      description: 'Base payout vault',
      inputs: { market: market.market },
    },
    {
      id: `${market.id}-quote`,
      label: `${market.label} (${market.quoteSymbol} vault)`,
      value: market.quoteVault,
      description: 'Quote payout vault',
      inputs: { market: market.market },
    },
  ]),
};

export const HUMIDIFI_FEATURED: FeaturedProtocol = {
  protocol: 'humidifi',
  templates: {
    'humidifi-price': humidifiMarkets,
    'humidifi-spread': humidifiMarkets,
    'humidifi-vault-balance': humidifiVaults,
  },
  aiContext: () =>
    [
      'Featured HumidiFi accounts available in Studio:',
      ...HUMIDIFI_FEATURED_MARKETS.map(
        (market) =>
          `- ${market.label}: market ${market.market}; ` +
          `${market.baseSymbol} vault ${market.baseVault}; ` +
          `${market.quoteSymbol} vault ${market.quoteVault}.`
      ),
    ].join('\n'),
};
