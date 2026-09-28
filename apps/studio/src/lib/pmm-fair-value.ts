import { type ScenarioTemplate, toScenarioNumber } from './scenarios-api';

export const PmmProtocols = {
  Tessera: 'tessera',
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
  /** Template whose `constants.market` catalog lists the markets this adapter can target. */
  marketTemplateId: string;
  buildOverrides: (market: PmmMarketOption, price: string) => PmmFairValueOverride[];
};

const ZERO = BigInt(0);
const TEN = BigInt(10);
const U64_MAX = BigInt('18446744073709551615');
const TEN_POW_30 = TEN ** BigInt(30);
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
};

const humidifiAdapter: PmmFairValueAdapter = {
  protocol: PmmProtocols.HumidiFi,
  label: 'HumidiFi',
  marketTemplateId: 'humidifi-price',
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
        values: { last_update_slot: 0 },
      },
    ];
  },
};

export const PMM_FAIR_VALUE_ADAPTERS: Record<PmmProtocol, PmmFairValueAdapter> = {
  [PmmProtocols.Tessera]: tesseraAdapter,
  [PmmProtocols.HumidiFi]: humidifiAdapter,
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
