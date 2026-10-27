import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const WHIRLPOOL_DISCRIMINATOR = [63, 149, 209, 12, 225, 128, 99, 9];
export const POOL_STATE_LEN = 653;
export const TICK_SPACING_OFFSET = 41;
export const LIQUIDITY_OFFSET = 49;
export const SQRT_PRICE_OFFSET = 65;
export const TICK_CURRENT_INDEX_OFFSET = 81;
export const TICK_ARRAY_DISCRIMINATOR = [69, 97, 189, 190, 110, 7, 66, 187];
export const TICK_ARRAY_LEN = 9988;
// Fixed TickArray: discriminator 8, start_tick_index 4, then 88 ticks of 113 bytes each
// (initialized 1, liquidity_net 16, liquidity_gross 16, fee and reward growths 80).
export const TICKS_OFFSET = 12;
export const TICK_LEN = 113;
export const DYNAMIC_TICK_ARRAY_DISCRIMINATOR = [17, 216, 246, 142, 225, 199, 218, 56];
// DynamicTickArray: discriminator 8, start_tick_index 4, whirlpool 32, tick_bitmap 16, then per tick a
// tag byte (1 = initialized) followed by the same 112 bytes of tick data only when initialized.
export const DYNAMIC_TICK_BITMAP_OFFSET = 44;
export const DYNAMIC_TICKS_OFFSET = 60;
// fee_rate is capped at 60000 hundredths of a bp (6%), so plain bps stop at 600.
export const MAX_WHIRLPOOL_FEE_BPS = 600;

const TICK_ARRAY_SIZE = 88;
const MAX_TICK = 443636;
// 500 arrays are five getMultipleAccounts batches; at tick spacing 1 that still allows an 80x move.
export const MAX_PATH_TICK_ARRAYS = 500;
const MIN_SQRT_PRICE_X64 = BigInt('4295048016');
const MAX_SQRT_PRICE_X64 = BigInt('79226673515401279992447579055');
const Q64 = 18446744073709551616;
const TICK_BASE = 1.0001;

export type WhirlpoolAccount = { owner: string; data: Uint8Array };

export type WhirlpoolPriceShockPlan = {
  priceFactor: number;
  tickSpacing: number;
  oldTickCurrentIndex: number;
  oldLiquidity: bigint;
  newSqrtPrice: bigint;
  newTickCurrentIndex: number;
  tickArray: string;
  tickArrayStartIndex: number;
  /** Every tick array from the current one to the destination, in the direction of the move. */
  pathTickArrays: { address: string; startIndex: number }[];
};

export function assertWhirlpoolAccount(pool: string, account: WhirlpoolAccount): void {
  const { owner, data } = account;
  if (owner !== WHIRLPOOL_PROGRAM_ID) {
    throw new Error(`${pool} is owned by ${owner}, not the Whirlpool program ${WHIRLPOOL_PROGRAM_ID}`);
  }
  if (data.length !== POOL_STATE_LEN) {
    throw new Error(`${pool} is ${data.length} bytes, not the ${POOL_STATE_LEN} bytes of a Whirlpool account`);
  }
  if (WHIRLPOOL_DISCRIMINATOR.some((byte, index) => data[index] !== byte)) {
    throw new Error('account does not carry the Whirlpool discriminator declared by the bundled IDL');
  }
}

function tickArrayStartIndex(tick: number, tickSpacing: number): number {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
  return Math.floor(tick / ticksInArray) * ticksInArray;
}

export async function planWhirlpoolPriceShock(
  pool: string,
  account: WhirlpoolAccount,
  priceFactor: number
): Promise<WhirlpoolPriceShockPlan> {
  if (!Number.isFinite(priceFactor)) throw new Error('price factor must be a finite number');
  if (priceFactor <= 0) throw new Error('price factor must be greater than zero');
  if (priceFactor === 1) throw new Error('price factor of 1 would leave the pool unchanged');
  assertWhirlpoolAccount(pool, account);

  const { data } = account;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tickSpacing = view.getUint16(TICK_SPACING_OFFSET, true);
  if (tickSpacing === 0) throw new Error('pool declares a tick spacing of zero');
  const sqrtPrice =
    view.getBigUint64(SQRT_PRICE_OFFSET, true) | (view.getBigUint64(SQRT_PRICE_OFFSET + 8, true) << BigInt(64));

  // The tick comes from an f64 log and can be one off right at a tick boundary, so the price is
  // taken from the tick instead, at the middle of its range, where f64 error cannot cross a boundary.
  const shocked = Number(sqrtPrice) * Math.sqrt(priceFactor);
  const newTickCurrentIndex = Math.floor((2 * Math.log(shocked / Q64)) / Math.log(TICK_BASE));
  if (!Number.isFinite(newTickCurrentIndex) || Math.abs(newTickCurrentIndex) > MAX_TICK) {
    throw new Error(`shocked price lands on tick ${newTickCurrentIndex}, outside [-${MAX_TICK}, ${MAX_TICK}]`);
  }
  const newSqrtPrice = BigInt(Math.round(Q64 * TICK_BASE ** ((newTickCurrentIndex + 0.5) / 2)));
  if (newSqrtPrice < MIN_SQRT_PRICE_X64 || newSqrtPrice >= MAX_SQRT_PRICE_X64) {
    throw new Error(
      `price factor moves sqrt_price to ${newSqrtPrice}, outside the range the program accepts [${MIN_SQRT_PRICE_X64}, ${MAX_SQRT_PRICE_X64})`
    );
  }

  const oldTickCurrentIndex = view.getInt32(TICK_CURRENT_INDEX_OFFSET, true);
  const span = TICK_ARRAY_SIZE * tickSpacing;
  const step = newTickCurrentIndex >= oldTickCurrentIndex ? span : -span;
  const firstStart = tickArrayStartIndex(oldTickCurrentIndex, tickSpacing);
  const lastStart = tickArrayStartIndex(newTickCurrentIndex, tickSpacing);
  const pathLength = Math.abs(lastStart - firstStart) / span + 1;
  if (pathLength > MAX_PATH_TICK_ARRAYS) {
    throw new Error(
      `the move from tick ${oldTickCurrentIndex} to tick ${newTickCurrentIndex} crosses ${pathLength} tick arrays, more than the ${MAX_PATH_TICK_ARRAYS} this preset reads; use a factor closer to 1`
    );
  }
  const pathStarts = Array.from({ length: pathLength }, (_, index) => firstStart + index * step);
  const pathTickArrays = await Promise.all(
    pathStarts.map(async (startIndex) => ({ address: await tickArrayAddress(pool, startIndex), startIndex }))
  );
  const destination = pathTickArrays[pathTickArrays.length - 1];

  return {
    priceFactor,
    tickSpacing,
    oldTickCurrentIndex,
    oldLiquidity:
      view.getBigUint64(LIQUIDITY_OFFSET, true) | (view.getBigUint64(LIQUIDITY_OFFSET + 8, true) << BigInt(64)),
    newSqrtPrice,
    newTickCurrentIndex,
    tickArray: destination.address,
    tickArrayStartIndex: destination.startIndex,
    pathTickArrays,
  };
}

async function tickArrayAddress(pool: string, startIndex: number): Promise<string> {
  const [tickArray] = await getProgramDerivedAddress({
    programAddress: address(WHIRLPOOL_PROGRAM_ID),
    seeds: ['tick_array', getAddressEncoder().encode(address(pool)), startIndex.toString()],
  });
  return tickArray;
}

/**
 * The active liquidity at the new tick. A real swap adds each crossed tick's liquidity_net when the
 * price rises and subtracts it when it falls; writing only the price would keep the old range's
 * liquidity. A missing array on the path holds no initialized ticks.
 */
export function liquidityAfterShock(plan: WhirlpoolPriceShockPlan, pathAccounts: (WhirlpoolAccount | null)[]): bigint {
  const [low, high] = [
    Math.min(plan.oldTickCurrentIndex, plan.newTickCurrentIndex),
    Math.max(plan.oldTickCurrentIndex, plan.newTickCurrentIndex),
  ];
  let crossed = BigInt(0);
  plan.pathTickArrays.forEach(({ address: tickArray, startIndex }, index) => {
    const account = pathAccounts[index];
    if (!account) return;
    initializedTickLiquidityNets(tickArray, account).forEach((liquidityNet, slot) => {
      const tick = startIndex + slot * plan.tickSpacing;
      if (tick > low && tick <= high) crossed += liquidityNet;
    });
  });
  const liquidity =
    plan.newTickCurrentIndex > plan.oldTickCurrentIndex ? plan.oldLiquidity + crossed : plan.oldLiquidity - crossed;
  if (liquidity < BigInt(0)) {
    throw new Error(
      `the crossed ticks leave a negative active liquidity (${liquidity}); the pool's tick arrays are inconsistent`
    );
  }
  return liquidity;
}

/** A missing array is rejected here rather than left to fail later at swap time. */
export function assertTickArrayExists(plan: WhirlpoolPriceShockPlan, tickArray: WhirlpoolAccount | null): void {
  if (!tickArray) {
    const currentStart = tickArrayStartIndex(plan.oldTickCurrentIndex, plan.tickSpacing);
    const currentEnd = currentStart + TICK_ARRAY_SIZE * plan.tickSpacing - 1;
    const isRaise = plan.priceFactor > 1;
    const edgeTick = isRaise ? currentEnd : currentStart;
    const missing = `tick array ${plan.tickArray} (start index ${plan.tickArrayStartIndex}) does not exist, so a swap could not resume from tick ${plan.newTickCurrentIndex}.`;
    if (edgeTick === plan.oldTickCurrentIndex) {
      throw new Error(
        `${missing} The pool already sits on the edge of its current tick array [${currentStart}, ${currentEnd}].`
      );
    }
    // Six significant digits, rounded toward the array's interior so the suggestion itself lands inside it.
    const exact = TICK_BASE ** (edgeTick - plan.oldTickCurrentIndex);
    const scale = 10 ** (5 - Math.floor(Math.log10(exact)));
    const safeFactor = (isRaise ? Math.floor(exact * scale) : Math.ceil(exact * scale)) / scale;
    throw new Error(
      `${missing} The ${isRaise ? 'largest' : 'smallest'} factor that stays on the pool's current tick array [${currentStart}, ${currentEnd}] is ${safeFactor.toPrecision(6)}.`
    );
  }
}

/** liquidity_net of every initialized tick, keyed by its slot in the array. */
function initializedTickLiquidityNets(address: string, tickArray: WhirlpoolAccount): Map<number, bigint> {
  const { owner, data } = tickArray;
  if (owner !== WHIRLPOOL_PROGRAM_ID) {
    throw new Error(`tick array ${address} is owned by ${owner}, not the Whirlpool program`);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const readI128 = (offset: number) =>
    view.getBigUint64(offset, true) | (view.getBigInt64(offset + 8, true) << BigInt(64));
  const hasDiscriminator = (discriminator: number[]) => discriminator.every((byte, index) => data[index] === byte);
  const liquidityNets = new Map<number, bigint>();

  if (hasDiscriminator(TICK_ARRAY_DISCRIMINATOR) && data.length === TICK_ARRAY_LEN) {
    for (let slot = 0; slot < TICK_ARRAY_SIZE; slot++) {
      const offset = TICKS_OFFSET + slot * TICK_LEN;
      if (data[offset] === 1) liquidityNets.set(slot, readI128(offset + 1));
    }
    return liquidityNets;
  }
  if (hasDiscriminator(DYNAMIC_TICK_ARRAY_DISCRIMINATOR) && data.length >= DYNAMIC_TICKS_OFFSET + TICK_ARRAY_SIZE) {
    const bitmap = readI128(DYNAMIC_TICK_BITMAP_OFFSET);
    let offset = DYNAMIC_TICKS_OFFSET;
    for (let slot = 0; slot < TICK_ARRAY_SIZE; slot++) {
      const isInitialized = ((bitmap >> BigInt(slot)) & BigInt(1)) === BigInt(1);
      if (offset + (isInitialized ? TICK_LEN : 1) > data.length) {
        throw new Error(
          `dynamic tick array ${address} (${data.length} bytes) ends before the ticks its bitmap declares`
        );
      }
      // The program locates ticks by the bitmap, so a tag that disagrees means we would read the wrong bytes.
      if (data[offset] !== (isInitialized ? 1 : 0)) {
        throw new Error(
          `dynamic tick array ${address} has a tick tag at byte ${offset} that disagrees with its bitmap`
        );
      }
      if (isInitialized) liquidityNets.set(slot, readI128(offset + 1));
      offset += isInitialized ? TICK_LEN : 1;
    }
    return liquidityNets;
  }
  throw new Error(
    `tick array ${address} (${data.length} bytes) is neither a ${TICK_ARRAY_LEN}-byte TickArray nor a DynamicTickArray`
  );
}
