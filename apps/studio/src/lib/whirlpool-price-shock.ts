import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const WHIRLPOOL_DISCRIMINATOR = [63, 149, 209, 12, 225, 128, 99, 9];
export const POOL_STATE_LEN = 653;
export const TICK_SPACING_OFFSET = 41;
export const SQRT_PRICE_OFFSET = 65;
export const TICK_CURRENT_INDEX_OFFSET = 81;
export const TICK_ARRAY_LEN = 9988;

const TICK_ARRAY_SIZE = 88;
const MAX_TICK = 443636;
const MIN_SQRT_PRICE_X64 = BigInt('4295048016');
const MAX_SQRT_PRICE_X64 = BigInt('79226673515401279992447579055');
const Q64 = 18446744073709551616;
const TICK_BASE = 1.0001;

export type WhirlpoolAccount = { owner: string; data: Uint8Array };

export type WhirlpoolPriceShockPlan = {
  priceFactor: number;
  tickSpacing: number;
  oldTickCurrentIndex: number;
  newSqrtPrice: bigint;
  newTickCurrentIndex: number;
  tickArray: string;
  tickArrayStartIndex: number;
};

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

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tickSpacing = view.getUint16(TICK_SPACING_OFFSET, true);
  if (tickSpacing === 0) throw new Error('pool declares a tick spacing of zero');
  const sqrtPrice =
    view.getBigUint64(SQRT_PRICE_OFFSET, true) | (view.getBigUint64(SQRT_PRICE_OFFSET + 8, true) << BigInt(64));

  // f64 is exact to ~1e-16 here, far below the 1e-4 relative tick step.
  const shocked = Math.round(Number(sqrtPrice) * Math.sqrt(priceFactor));
  if (shocked < Number(MIN_SQRT_PRICE_X64) || shocked >= Number(MAX_SQRT_PRICE_X64)) {
    throw new Error(
      `price factor moves sqrt_price to ${BigInt(shocked)}, outside the range the program accepts [${MIN_SQRT_PRICE_X64}, ${MAX_SQRT_PRICE_X64})`
    );
  }
  const newTickCurrentIndex = Math.floor((2 * Math.log(shocked / Q64)) / Math.log(TICK_BASE));
  if (Math.abs(newTickCurrentIndex) > MAX_TICK) {
    throw new Error(`shocked price lands on tick ${newTickCurrentIndex}, outside [-${MAX_TICK}, ${MAX_TICK}]`);
  }

  const startIndex = tickArrayStartIndex(newTickCurrentIndex, tickSpacing);
  const [tickArray] = await getProgramDerivedAddress({
    programAddress: address(WHIRLPOOL_PROGRAM_ID),
    seeds: ['tick_array', getAddressEncoder().encode(address(pool)), startIndex.toString()],
  });

  return {
    priceFactor,
    tickSpacing,
    oldTickCurrentIndex: view.getInt32(TICK_CURRENT_INDEX_OFFSET, true),
    newSqrtPrice: BigInt(shocked),
    newTickCurrentIndex,
    tickArray,
    tickArrayStartIndex: startIndex,
  };
}

/** A missing array is rejected here rather than left to fail later at swap time. */
export function assertTickArrayExists(plan: WhirlpoolPriceShockPlan, tickArray: WhirlpoolAccount | null): void {
  if (!tickArray) {
    const currentStart = tickArrayStartIndex(plan.oldTickCurrentIndex, plan.tickSpacing);
    const currentEnd = currentStart + TICK_ARRAY_SIZE * plan.tickSpacing - 1;
    const isRaise = plan.priceFactor > 1;
    const safeFactor = TICK_BASE ** ((isRaise ? currentEnd : currentStart) - plan.oldTickCurrentIndex);
    throw new Error(
      `tick array ${plan.tickArray} (start index ${plan.tickArrayStartIndex}) does not exist, so a swap could not resume from tick ${plan.newTickCurrentIndex}. ` +
        `The ${isRaise ? 'largest' : 'smallest'} factor that stays on the pool's current tick array [${currentStart}, ${currentEnd}] is ${safeFactor.toFixed(6)}.`
    );
  }
  if (tickArray.owner !== WHIRLPOOL_PROGRAM_ID) {
    throw new Error(`tick array ${plan.tickArray} is owned by ${tickArray.owner}, not the Whirlpool program`);
  }
  if (tickArray.data.length !== TICK_ARRAY_LEN) {
    throw new Error(
      `tick array ${plan.tickArray} is ${tickArray.data.length} bytes, not the ${TICK_ARRAY_LEN} bytes of a TickArray`
    );
  }
}
