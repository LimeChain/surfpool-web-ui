import { PublicKey } from '@solana/web3.js';
import { type ScenarioTemplate, toScenarioNumber } from './scenarios-api';

export const PmmProtocols = {
  Tessera: 'tessera',
} as const;

export type PmmProtocol = (typeof PmmProtocols)[keyof typeof PmmProtocols];

export type PmmMarketOption = {
  label: string;
  value: string;
  metadata?: Record<string, unknown>;
};

export type PmmFairValueOverride = {
  templateId: string;
  label: string;
  account: { pubkey: string };
  values: Record<string, unknown>;
};

export type PmmFairValueAdapter = {
  protocol: PmmProtocol;
  label: string;
  /** Template whose `constants.market` catalog lists the markets this adapter can target. */
  marketTemplateId: string;
  buildOverrides: (market: PmmMarketOption, price: string) => PmmFairValueOverride[];
  /** Reads a typed market address the catalog does not list, with the metadata its overrides need. */
  readMarket: (rpcUrl: string, address: string, listed: PmmMarketOption[]) => Promise<PmmMarketOption>;
};

const ZERO = BigInt(0);
const TEN = BigInt(10);
const U64_MAX = BigInt('18446744073709551615');
const PRICE_PATTERN = /^\d+(?:\.\d+)?$/;

export function isValidPmmPrice(price: string): boolean {
  const normalized = price.trim();
  return PRICE_PATTERN.test(normalized) && /[1-9]/.test(normalized);
}

function parseDecimalPrice(price: string): { digits: bigint; scale: number } {
  const normalized = price.trim();
  if (!isValidPmmPrice(normalized)) throw new Error('Price must be a positive decimal number');
  const [whole, fraction = ''] = normalized.split('.');
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

function scaleDecimal(price: string, exponent: number): bigint {
  const { digits, scale } = parseDecimalPrice(price);
  const shift = exponent - scale;
  if (shift >= 0) return digits * TEN ** BigInt(shift);
  const divisor = TEN ** BigInt(-shift);
  if (digits % divisor !== ZERO) {
    throw new Error(`Price has more decimals than this market supports, at most ${Math.max(exponent, 0)}`);
  }
  return digits / divisor;
}

async function rpcResult<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? `${method} failed`);
  return body.result as T;
}

const listedSymbol = (mint: string, listed: PmmMarketOption[]) => {
  for (const { metadata } of listed) {
    const [base, quote] = String(metadata?.pair ?? '').split('/');
    if (metadata?.base_mint === mint && base) return base;
    if (metadata?.quote_mint === mint && quote) return quote;
  }
  return mint.slice(0, 4);
};

export function readMarketOptions(template: ScenarioTemplate): PmmMarketOption[] {
  const options = template.constants?.market?.options;
  if (!Array.isArray(options)) return [];
  return options.filter(
    (option): option is PmmMarketOption => typeof option?.value === 'string' && typeof option?.label === 'string'
  );
}

export function marketPairLabel(market: PmmMarketOption | undefined): string {
  const pair = typeof market?.metadata?.pair === 'string' ? market.metadata.pair : market?.label;
  const [base, quote] = (pair ?? '').split('/').map((part) => part.trim());
  return base && quote ? `Price of ${base} in ${quote}` : 'Price in quote tokens';
}

export function buildPmmFairValueScenario(adapter: PmmFairValueAdapter, market: PmmMarketOption, price: string) {
  const normalizedPrice = price.trim();
  const overrides = adapter.buildOverrides(market, normalizedPrice).map((override) => ({
    id: crypto.randomUUID(),
    ...override,
    scenarioRelativeSlot: 0,
    enabled: true,
    fetchBeforeUse: true,
  }));

  return {
    id: crypto.randomUUID(),
    name: `${adapter.label} ${market.label} fair value ${normalizedPrice}`,
    description: `Set the ${adapter.label} ${market.label} fair value to ${normalizedPrice} and keep the quote fresh.`,
    overrides,
    tags: [adapter.protocol, 'pmm', 'fair-value'],
  };
}

const TEN_POW_30 = TEN ** BigInt(30);

function readDecimals(market: PmmMarketOption, key: string): number {
  const value = market.metadata?.[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Market ${market.label} has no ${key} in its catalog metadata`);
  }
  return value;
}

export function tesseraPriceRatios(
  price: string,
  baseDecimals: number,
  quoteDecimals: number
): { quoteAtomsPerBaseAtomX1e15: bigint; baseAtomsPerQuoteAtomX1e15: bigint } {
  const quoteAtomsPerBaseAtomX1e15 = scaleDecimal(price, quoteDecimals - baseDecimals + 15);
  if (quoteAtomsPerBaseAtomX1e15 === ZERO) throw new Error("Price is too small for this market's decimals");
  if (quoteAtomsPerBaseAtomX1e15 > U64_MAX) throw new Error("Price is too large for this market's decimals");

  const baseAtomsPerQuoteAtomX1e15 = TEN_POW_30 / quoteAtomsPerBaseAtomX1e15;
  if (baseAtomsPerQuoteAtomX1e15 === ZERO) throw new Error("Price is too large for this market's decimals");
  if (baseAtomsPerQuoteAtomX1e15 > U64_MAX) throw new Error("Price is too small for this market's decimals");

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

const tesseraAdapter: PmmFairValueAdapter = {
  protocol: PmmProtocols.Tessera,
  label: 'Tessera',
  marketTemplateId: 'tessera-price',
  buildOverrides: (market, price) => {
    const { quoteAtomsPerBaseAtomX1e15, baseAtomsPerQuoteAtomX1e15 } = tesseraPriceRatios(
      price,
      readDecimals(market, 'base_decimals'),
      readDecimals(market, 'quote_decimals')
    );
    const account = { pubkey: market.value };
    return [
      {
        templateId: 'tessera-price',
        label: 'Tessera fair value',
        account,
        values: {
          quote_atoms_per_base_atom_x1e15: toScenarioNumber(quoteAtomsPerBaseAtomX1e15.toString()),
          base_atoms_per_quote_atom_x1e15: toScenarioNumber(baseAtomsPerQuoteAtomX1e15.toString()),
        },
      },
      {
        templateId: 'tessera-freshness',
        label: 'Tessera fresh quote',
        account,
        values: { last_update_slot: 0 },
      },
    ];
  },
  readMarket: readTesseraMarket,
};

export const PMM_FAIR_VALUE_ADAPTERS: Record<PmmProtocol, PmmFairValueAdapter> = {
  [PmmProtocols.Tessera]: tesseraAdapter,
};
