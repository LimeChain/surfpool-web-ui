import { PublicKey } from '@solana/web3.js';
import type { FeaturedAccounts, FeaturedProtocol } from '../featured-accounts';
import type { PmmFairValueAdapter, PmmMarketOption } from '../pmm-fair-value';
import { listedSymbol, readDecimals, rpcResult, scaleDecimal, TEN, ZERO } from '../pmm-price';

/** The Tessera markets Studio offers as shortcuts; any other Tessera market can be typed instead. */
export const TESSERA_FEATURED_MARKETS = [
  {
    id: 'sol-usdc',
    label: 'SOL / USDC',
    market: 'FLckHLGMJy5gEoXWwcE68Nprde1D4araK4TGLw4pQq2n',
    baseSymbol: 'SOL',
    baseMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 9,
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
  },
  {
    id: 'cbbtc-usdc',
    label: 'cbBTC / USDC',
    market: '9NkuAWB4LgCVFV77omEkJEjXqgV5PGupwMTu3B3pBRhc',
    baseSymbol: 'cbBTC',
    baseMint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',
    baseDecimals: 8,
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
  },
  {
    id: 'jlp-sol',
    label: 'JLP / SOL',
    market: 'H3chk8rgniKXnToGTdPUFieuHGLQQfBMXVbGp6bR1uMD',
    baseSymbol: 'JLP',
    baseMint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
    baseDecimals: 6,
    quoteSymbol: 'SOL',
    quoteMint: 'So11111111111111111111111111111111111111112',
    quoteDecimals: 9,
  },
  {
    id: 'pump-usdc',
    label: 'PUMP / USDC',
    market: 'DNhfyh75AApg1L1Yig3fErvERKutYRqfWLGb496iViSZ',
    baseSymbol: 'PUMP',
    baseMint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    baseDecimals: 6,
    quoteSymbol: 'USDC',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: 6,
  },
] as const;

const tesseraMarkets: FeaturedAccounts = {
  label: 'Tessera market',
  description: 'Pick a featured market or type any Tessera market address.',
  options: TESSERA_FEATURED_MARKETS.map((market) => ({
    id: market.id,
    label: market.label,
    value: market.market,
    description: 'Market account',
  })),
};

export const TESSERA_FEATURED: FeaturedProtocol = {
  protocol: 'tessera',
  templates: {
    'tessera-price': tesseraMarkets,
    'tessera-depth': tesseraMarkets,
    'tessera-curve': tesseraMarkets,
    'tessera-halt': tesseraMarkets,
  },
  aiContext: () =>
    [
      'Featured Tessera markets available in Studio:',
      ...TESSERA_FEATURED_MARKETS.map((market) => `- ${market.label}: market ${market.market}.`),
    ].join('\n'),
};

const TEN_POW_30 = TEN ** BigInt(30);

export function tesseraPriceRatios(
  price: string,
  baseDecimals: number,
  quoteDecimals: number
): { quoteAtomsPerBaseAtomX1e15: bigint; baseAtomsPerQuoteAtomX1e15: bigint } {
  const quoteAtomsPerBaseAtomX1e15 = scaleDecimal(price, quoteDecimals - baseDecimals + 15);
  if (quoteAtomsPerBaseAtomX1e15 === ZERO) throw new Error("Price is too small for this market's decimals");

  const baseAtomsPerQuoteAtomX1e15 = TEN_POW_30 / quoteAtomsPerBaseAtomX1e15;
  if (baseAtomsPerQuoteAtomX1e15 === ZERO) throw new Error("Price is too large for this market's decimals");

  return { quoteAtomsPerBaseAtomX1e15, baseAtomsPerQuoteAtomX1e15 };
}

const TESSERA_PROGRAM = 'TessVdML9pBGgG9yGks7o4HewRaXVAMuoVj4x83GLQH';
const TESSERA_MARKET_SIZE = 1264;

export async function readTesseraMarket(
  rpcUrl: string,
  address: string,
  listed: PmmMarketOption[]
): Promise<PmmMarketOption> {
  const { value } = await rpcResult<{ value: { owner: string; data: [string, string] } | null }>(
    rpcUrl,
    'getAccountInfo',
    [address, { encoding: 'base64' }]
  );
  const data = value ? Uint8Array.from(atob(value.data[0]), (char) => char.charCodeAt(0)) : null;
  if (!value || !data || value.owner !== TESSERA_PROGRAM || data.length !== TESSERA_MARKET_SIZE || data[96] !== 5) {
    throw new Error(`${address} is not a Tessera market account`);
  }
  const [base, quote] = [24, 56].map((offset) => new PublicKey(data.slice(offset, offset + 32)).toBase58());
  const mints = await rpcResult<{ value: Array<{ data?: { parsed?: { info?: { decimals?: number } } } } | null> }>(
    rpcUrl,
    'getMultipleAccounts',
    [[base, quote], { encoding: 'jsonParsed' }]
  );
  const [baseDecimals, quoteDecimals] = mints.value.map((mint) => mint?.data?.parsed?.info?.decimals);
  if (baseDecimals === undefined || quoteDecimals === undefined) {
    throw new Error(`The mints of ${address} have no decimals on this surfnet`);
  }
  const [baseSymbol, quoteSymbol] = [base, quote].map((mint) => listedSymbol(mint, listed));
  return {
    label: `${baseSymbol} / ${quoteSymbol}`,
    value: address,
    metadata: { base_decimals: baseDecimals, quote_decimals: quoteDecimals, pair: `${baseSymbol}/${quoteSymbol}` },
  };
}

export const TESSERA_FAIR_VALUE: PmmFairValueAdapter = {
  protocol: 'tessera',
  label: 'Tessera',
  marketTemplateId: 'tessera-price',
  markets: TESSERA_FEATURED_MARKETS.map((market) => ({
    label: market.label,
    value: market.market,
    metadata: {
      pair: `${market.baseSymbol}/${market.quoteSymbol}`,
      base_mint: market.baseMint,
      quote_mint: market.quoteMint,
      base_decimals: market.baseDecimals,
      quote_decimals: market.quoteDecimals,
    },
  })),
  buildOverrides: (market, price) => {
    const { quoteAtomsPerBaseAtomX1e15, baseAtomsPerQuoteAtomX1e15 } = tesseraPriceRatios(
      price,
      readDecimals(market, 'base_decimals'),
      readDecimals(market, 'quote_decimals')
    );
    // Surfpool keeps the quote current from the slot the price plays, so the price is all it takes.
    return [
      {
        templateId: 'tessera-price',
        label: 'Tessera fair value',
        account: { pubkey: market.value },
        values: {
          quote_atoms_per_base_atom_x1e15: quoteAtomsPerBaseAtomX1e15.toString(),
          base_atoms_per_quote_atom_x1e15: baseAtomsPerQuoteAtomX1e15.toString(),
        },
      },
    ];
  },
  readMarket: readTesseraMarket,
};
