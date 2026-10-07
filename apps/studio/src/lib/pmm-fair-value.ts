import { PublicKey } from '@solana/web3.js';
import { truncateAddress } from './address-utils';
import { HUMIDIFI_FEATURED_MARKETS } from './humidifi-markets';
import { serializeScenarioJson, toScenarioNumber } from './scenarios-api';

export const PmmProtocols = {
  HumidiFi: 'humidifi',
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
const TWO_POW_48 = BigInt(2) ** BigInt(48);
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

export function humidifiFairValue(price: string, baseDecimals: number, quoteDecimals: number): bigint {
  const { digits, scale } = parseDecimalPrice(price);
  const decimalsGap = baseDecimals - quoteDecimals;
  const numerator = digits * TWO_POW_48 * TEN ** BigInt(Math.max(0, -decimalsGap));
  const denominator = TEN ** BigInt(scale + Math.max(0, decimalsGap));
  const fairValue = numerator / denominator;
  if (fairValue === ZERO) throw new Error("Price is too small for this market's decimals");
  if (fairValue > U64_MAX) throw new Error("Price is too large for this market's decimals");
  return fairValue;
}

function readDecimals(market: PmmMarketOption, key: string): number {
  const value = market.metadata?.[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Market ${market.label} has no ${key} in its metadata`);
  }
  return value;
}

const HUMIDIFI_PROGRAM = '9H6tua7jkLhdm3w8BvgpTn5LZNU7g4ZynDmCiNN3q6Rp';
const HUMIDIFI_MARKET_SIZE = 1728;
const HUMIDIFI_MARKET_TAG = [44, 90, 19, 124, 56, 111, 47, 150];
const HUMIDIFI_SCHEMA_8 = [8, 0, 0, 0, 0, 0, 0, 0];
// HumidiFi XORs each little-endian 8-byte word of a stored pubkey with its own fixed key.
const HUMIDIFI_PUBKEY_MASK = ['fb5ce87aae443c38', '04a2178451bac3c7', '04a1178751b9c3c6', '04a0178651b8c3c5'].flatMap(
  (word) => (word.match(/../g) ?? []).reverse().map((byte) => parseInt(byte, 16))
);

const base64Bytes = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

const hasBytes = (data: Uint8Array, offset: number, expected: number[]) =>
  expected.every((byte, index) => data[offset + index] === byte);

const unmaskPubkey = (data: Uint8Array, offset: number) =>
  new PublicKey(HUMIDIFI_PUBKEY_MASK.map((mask, index) => data[offset + index] ^ mask)).toBase58();

export async function readHumidifiMarket(
  rpcUrl: string,
  address: string,
  listed: PmmMarketOption[]
): Promise<PmmMarketOption> {
  const { value } = await rpcResult<{ value: { owner: string; data: [string, string] } | null }>(
    rpcUrl,
    'getAccountInfo',
    [address, { encoding: 'base64' }]
  );
  const data = value ? base64Bytes(value.data[0]) : null;
  if (
    !value ||
    !data ||
    value.owner !== HUMIDIFI_PROGRAM ||
    data.length !== HUMIDIFI_MARKET_SIZE ||
    !hasBytes(data, 8, HUMIDIFI_MARKET_TAG) ||
    !hasBytes(data, 1720, HUMIDIFI_SCHEMA_8)
  ) {
    throw new Error(`${address} is not a HumidiFi market account`);
  }
  const [base, quote] = [416, 384].map((offset) => unmaskPubkey(data, offset));
  const mints = await rpcResult<{ value: ({ data: [string, string] } | null)[] }>(rpcUrl, 'getMultipleAccounts', [
    [base, quote],
    { encoding: 'base64' },
  ]);
  const [baseDecimals, quoteDecimals] = [base, quote].map((mint, index) => {
    const account = mints.value[index];
    if (!account) throw new Error(`Mint ${mint} of HumidiFi market ${address} was not found`);
    return base64Bytes(account.data[0])[44];
  });
  const [baseSymbol, quoteSymbol] = [base, quote].map((mint) => listedSymbol(mint, listed));
  return {
    label: `${baseSymbol} / ${quoteSymbol}`,
    value: address,
    metadata: {
      pair: `${baseSymbol}/${quoteSymbol}`,
      base_mint: base,
      quote_mint: quote,
      base_decimals: baseDecimals,
      quote_decimals: quoteDecimals,
    },
  };
}

const humidifiAdapter: PmmFairValueAdapter = {
  protocol: PmmProtocols.HumidiFi,
  label: 'HumidiFi',
  marketTemplateId: 'humidifi-price',
  markets: HUMIDIFI_FEATURED_MARKETS.map((market) => ({
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
    const fairValue = humidifiFairValue(
      price,
      readDecimals(market, 'base_decimals'),
      readDecimals(market, 'quote_decimals')
    );
    const account = { pubkey: market.value };
    return [
      {
        templateId: 'humidifi-price',
        label: 'HumidiFi fair value',
        account,
        values: { fair_value: toScenarioNumber(fairValue.toString()) },
      },
      {
        templateId: 'humidifi-freshness',
        label: 'HumidiFi fresh quote',
        account,
        values: { last_update_slot: 0, max_staleness_slots: 200 },
      },
    ];
  },
  readMarket: readHumidifiMarket,
};

export const PMM_FAIR_VALUE_ADAPTERS: Record<PmmProtocol, PmmFairValueAdapter> = {
  [PmmProtocols.HumidiFi]: humidifiAdapter,
};
