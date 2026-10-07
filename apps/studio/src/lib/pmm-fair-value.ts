import { PublicKey } from '@solana/web3.js';
import { truncateAddress } from './address-utils';
import { GOONFI_FEATURED_MARKETS } from './goonfi-markets';
import { serializeScenarioJson, toScenarioNumber } from './scenarios-api';

export const PmmProtocols = {
  GoonFi: 'goonfi',
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
  /** Template the surfnet must serve for this adapter to be offered. */
  marketTemplateId: string;
  /** Markets the preset offers; any other market is typed as an address and read by `readMarket`. */
  markets: PmmMarketOption[];
  buildOverrides: (market: PmmMarketOption, price: string) => PmmFairValueOverride[];
  /** Reads a typed market address the featured list does not offer, with the metadata its overrides need. */
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
  return truncateAddress(mint);
};

export type ServedTemplate = { id: string };

export async function fetchScenarioTemplates(studioUrl: string): Promise<ServedTemplate[]> {
  const response = await fetch(`${studioUrl}/v1/scenarios/templates`);
  if (!response.ok) throw new Error(`Failed to load scenario templates: ${response.status}`);
  return (await response.json()) as ServedTemplate[];
}

export async function createTemplateScenario(
  studioUrl: string,
  scenario: Record<string, unknown>
): Promise<{ id: string }> {
  const response = await fetch(`${studioUrl}/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: serializeScenarioJson(scenario),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to create scenario: ${response.status}`);
  }
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error('Surfpool returned no scenario id');
  return { id: result.id };
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
    description: `Set the ${adapter.label} ${market.label} fair value to ${normalizedPrice} and mark the quote fresh.`,
    overrides,
    tags: [adapter.protocol, 'pmm', 'fair-value'],
  };
}

export function goonfiPriceX1e6(price: string): bigint {
  const priceX1e6 = scaleDecimal(price, 6);
  if (priceX1e6 > U64_MAX) throw new Error('Price is too large for GoonFi');
  return priceX1e6;
}

function readPubkey(market: PmmMarketOption, key: string): string {
  const value = market.metadata?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Market ${market.label} has no ${key} in its metadata`);
  }
  return value;
}

const GOONFI_PROGRAM = 'goonuddtQRrWqqn5nFyczVKaie28f3kDkHWkHtURSLE';
const GOONFI_MARKET_SIZE = 2048;
const GOONFI_MARKET_TAG = [48, 188, 47, 53, 52, 88, 50, 154];

export async function readGoonfiMarket(
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
  const tagged = !!data && GOONFI_MARKET_TAG.every((byte, index) => data[index] === byte);
  if (!value || !data || value.owner !== GOONFI_PROGRAM || data.length !== GOONFI_MARKET_SIZE || !tagged) {
    throw new Error(`${address} is not a GoonFi market account`);
  }
  const [base, quote, oracle] = [80, 112, 208].map((offset) =>
    new PublicKey(data.slice(offset, offset + 32)).toBase58()
  );
  const [baseSymbol, quoteSymbol] = [base, quote].map((mint) => listedSymbol(mint, listed));
  return {
    label: `${baseSymbol} / ${quoteSymbol}`,
    value: address,
    metadata: { oracle, pair: `${baseSymbol}/${quoteSymbol}` },
  };
}

const goonfiAdapter: PmmFairValueAdapter = {
  protocol: PmmProtocols.GoonFi,
  label: 'GoonFi',
  marketTemplateId: 'goonfi-reference-band',
  markets: GOONFI_FEATURED_MARKETS.map((market) => ({
    label: market.label,
    value: market.market,
    metadata: {
      oracle: market.oracle,
      pair: `${market.baseSymbol}/${market.quoteSymbol}`,
      base_mint: market.baseMint,
      quote_mint: market.quoteMint,
    },
  })),
  buildOverrides: (market, price) => {
    const priceX1e6 = toScenarioNumber(goonfiPriceX1e6(price).toString());
    const oracle = { pubkey: readPubkey(market, 'oracle') };
    return [
      {
        templateId: 'goonfi-price',
        label: 'GoonFi fair value',
        account: oracle,
        values: { bid_price_x1e6: priceX1e6, ask_price_x1e6: priceX1e6 },
      },
      {
        templateId: 'goonfi-freshness',
        label: 'GoonFi fresh quote',
        account: oracle,
        values: { last_update_slot: 0 },
      },
      {
        templateId: 'goonfi-reference-band',
        label: 'GoonFi reference band',
        account: { pubkey: market.value },
        values: { reference_price_a_x1e6: priceX1e6, reference_price_b_x1e6: priceX1e6 },
      },
    ];
  },
  readMarket: readGoonfiMarket,
};

export const PMM_FAIR_VALUE_ADAPTERS: Record<PmmProtocol, PmmFairValueAdapter> = {
  [PmmProtocols.GoonFi]: goonfiAdapter,
};
