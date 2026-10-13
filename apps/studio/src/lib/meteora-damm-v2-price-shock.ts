import { LosslessNumber } from 'lossless-json';
import { validatePriceFactor } from './meteora-price-shock';

export const METEORA_DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';
export const METEORA_DAMM_V2_POOL_STATE_TEMPLATE_ID = 'meteora-damm-v2-pool-state';
export const METEORA_DAMM_V2_POOL_FEES_TEMPLATE_ID = 'meteora-damm-v2-pool-fees';

// Pool is a zero-copy repr(C) layout; offsets include the 8-byte discriminator (bundled cp_amm IDL).
const POOL_DISCRIMINATOR = [241, 154, 109, 4, 17, 177, 109, 188];
const POOL_LEN = 1112;
const LIQUIDITY_OFFSET = 360;
const SQRT_MIN_PRICE_OFFSET = 424;
const SQRT_MAX_PRICE_OFFSET = 440;
const SQRT_PRICE_OFFSET = 456;
const COLLECT_FEE_MODE_OFFSET = 484;
const TOKEN_A_AMOUNT_OFFSET = 680;
const TOKEN_B_AMOUNT_OFFSET = 688;
const COMPOUNDING = 2;
// Byte 8 of the base-fee blob that opens the pool's fees: the scheduler mode.
const BASE_FEE_MODE_OFFSET = 16;
const RATE_LIMITER = 2;
const MAX_FEE_BPS = 5000;

const U64_MAX = (BigInt(1) << BigInt(64)) - BigInt(1);
const SCALE = BigInt(1_000_000_000_000);

type ProgramAccount = { owner: string; data: Uint8Array };

const ceilDiv = (a: bigint, b: bigint) => (a + b - BigInt(1)) / b;

function isqrt(n: bigint): bigint {
  if (n < BigInt(2)) return n;
  let x = BigInt(1) << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> BigInt(1);
    if (y >= x) return x;
    x = y;
  }
}

function u128At(view: DataView, offset: number): bigint {
  return (view.getBigUint64(offset + 8, true) << BigInt(64)) | view.getBigUint64(offset, true);
}

function checkedU64(value: bigint, name: string): bigint {
  if (value > U64_MAX) throw new Error(`the shock puts ${name} at ${value}, past what a u64 holds`);
  return value;
}

export function assertDammV2Pool(pool: string, { owner, data }: ProgramAccount) {
  if (owner !== METEORA_DAMM_V2_PROGRAM_ID) throw new Error(`${pool} is owned by ${owner}, not the DAMM v2 program`);
  if (data.length !== POOL_LEN) throw new Error(`${pool} is ${data.length} bytes, not a DAMM v2 Pool`);
  if (POOL_DISCRIMINATOR.some((byte, i) => data[i] !== byte)) throw new Error(`${pool} is not a DAMM v2 Pool`);
}

/**
 * The state a fee-less arbitrage swap would leave, so both trade directions see the new price.
 * Concentrated pools keep their liquidity and derive both tracked reserves from it; compounding
 * pools move the reserves along x * y = k and derive the price from them.
 */
export function planDammV2PriceShock(pool: string, account: ProgramAccount, priceFactor: number) {
  validatePriceFactor(priceFactor);
  assertDammV2Pool(pool, account);
  const { data } = account;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const mode = data[COLLECT_FEE_MODE_OFFSET];
  const factor = BigInt(Math.round(priceFactor * Number(SCALE)));
  if (factor === BigInt(0)) throw new Error(`price factor ${priceFactor} is too small`);

  if (mode === COMPOUNDING) {
    const sqrtFactor = BigInt(Math.round(Math.sqrt(priceFactor) * Number(SCALE)));
    const tokenA = (view.getBigUint64(TOKEN_A_AMOUNT_OFFSET, true) * SCALE) / sqrtFactor;
    const tokenB = (view.getBigUint64(TOKEN_B_AMOUNT_OFFSET, true) * sqrtFactor) / SCALE;
    if (tokenA === BigInt(0) || tokenB === BigInt(0)) throw new Error(`price factor ${priceFactor} empties a reserve`);
    return {
      pool,
      priceFactor,
      mode,
      sqrtPrice: isqrt((tokenB << BigInt(128)) / tokenA),
      tokenA: checkedU64(tokenA, 'token_a_amount'),
      tokenB: checkedU64(tokenB, 'token_b_amount'),
    };
  }
  if (mode > COMPOUNDING) throw new Error(`${pool} uses collect_fee_mode ${mode}, which this shock does not know`);

  const liquidity = u128At(view, LIQUIDITY_OFFSET);
  const sqrtMin = u128At(view, SQRT_MIN_PRICE_OFFSET);
  const sqrtMax = u128At(view, SQRT_MAX_PRICE_OFFSET);
  const current = u128At(view, SQRT_PRICE_OFFSET);
  const sqrtPrice = isqrt((current * current * factor) / SCALE);
  if (sqrtPrice < sqrtMin || sqrtPrice > sqrtMax) {
    throw new Error(
      `price factor ${priceFactor} leaves the pool's price range; a swap would fail with PriceRangeViolation`
    );
  }
  return {
    pool,
    priceFactor,
    mode,
    sqrtPrice,
    tokenA: checkedU64(ceilDiv(liquidity * (sqrtMax - sqrtPrice), sqrtPrice * sqrtMax), 'token_a_amount'),
    tokenB: checkedU64(ceilDiv(liquidity * (sqrtPrice - sqrtMin), BigInt(1) << BigInt(128)), 'token_b_amount'),
  };
}

export function buildDammV2PriceShockScenario(plan: ReturnType<typeof planDammV2PriceShock>, templateId: string) {
  return {
    id: crypto.randomUUID(),
    name: `Meteora DAMM v2 Price Shock (${plan.pool.slice(0, 6)}…)`,
    description: `Move Meteora DAMM v2 pool ${plan.pool} to ${plan.priceFactor}x its price.`,
    overrides: [
      {
        id: crypto.randomUUID(),
        templateId,
        values: {
          sqrt_price: plan.sqrtPrice.toString(),
          token_a_amount: new LosslessNumber(plan.tokenA.toString()),
          token_b_amount: new LosslessNumber(plan.tokenB.toString()),
          'pool_fees.dynamic_fee.sqrt_price_reference': plan.sqrtPrice.toString(),
        },
        scenarioRelativeSlot: 1,
        label: `DAMM v2 price x${plan.priceFactor}`,
        enabled: true,
        fetchBeforeUse: true,
        account: { pubkey: plan.pool },
      },
    ],
    tags: ['meteora', 'damm-v2', 'price-shock'],
  };
}

export function validateDammV2FeeBps(feeBps: number) {
  if (!Number.isInteger(feeBps) || feeBps < 1 || feeBps > MAX_FEE_BPS) {
    throw new Error(`fee must be a whole number of basis points from 1 to ${MAX_FEE_BPS}`);
  }
}

/** A flat base fee: the cliff fee with no reduction, out of 1,000,000,000 (1 bps is 100,000). */
export function planDammV2Fee(pool: string, account: ProgramAccount, feeBps: number) {
  validateDammV2FeeBps(feeBps);
  assertDammV2Pool(pool, account);
  if (account.data[BASE_FEE_MODE_OFFSET] === RATE_LIMITER) {
    throw new Error(`${pool} uses the deprecated rate limiter, whose base-fee bytes hold other fields`);
  }
  return { pool, feeBps, cliffFeeNumerator: feeBps * 100_000 };
}

export function buildDammV2FeeScenario(plan: ReturnType<typeof planDammV2Fee>, templateId: string) {
  return {
    id: crypto.randomUUID(),
    name: `Meteora DAMM v2 Fee (${plan.pool.slice(0, 6)}…)`,
    description: `Hold Meteora DAMM v2 pool ${plan.pool} at a flat ${plan.feeBps} bps base fee.`,
    overrides: [
      {
        id: crypto.randomUUID(),
        templateId,
        values: {
          'pool_fees.base_fee.base_fee_info.cliff_fee_numerator': plan.cliffFeeNumerator,
          'pool_fees.base_fee.base_fee_info.reduction_factor': 0,
        },
        scenarioRelativeSlot: 0,
        label: `DAMM v2 fee ${plan.feeBps} bps`,
        enabled: true,
        fetchBeforeUse: true,
        account: { pubkey: plan.pool },
      },
    ],
    tags: ['meteora', 'damm-v2', 'fee'],
  };
}
