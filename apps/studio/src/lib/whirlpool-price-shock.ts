import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const WHIRLPOOL_DISCRIMINATOR = [63, 149, 209, 12, 225, 128, 99, 9];
export const POOL_STATE_LEN = 653;
export const TICK_SPACING_OFFSET = 41;
export const LIQUIDITY_OFFSET = 49;
export const SQRT_PRICE_OFFSET = 65;
export const TICK_CURRENT_INDEX_OFFSET = 81;
export const TICK_ARRAY_LEN = 9988;
// Fixed TickArray: discriminator 8, start_tick_index 4, then 88 ticks of 113 bytes each
// (initialized 1, liquidity_net 16, liquidity_gross 16, fee and reward growths 80).
export const TICKS_OFFSET = 12;
export const TICK_LEN = 113;

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
  oldLiquidity: bigint;
  newSqrtPrice: bigint;
  newTickCurrentIndex: number;
  tickArray: string;
  tickArrayStartIndex: number;
  /** Every tick array from the current one to the destination, in the direction of the move. */
  pathTickArrays: { address: string; startIndex: number }[];
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

  const oldTickCurrentIndex = view.getInt32(TICK_CURRENT_INDEX_OFFSET, true);
  const span = TICK_ARRAY_SIZE * tickSpacing;
  const step = newTickCurrentIndex >= oldTickCurrentIndex ? span : -span;
  const pathStarts = [tickArrayStartIndex(oldTickCurrentIndex, tickSpacing)];
  while (pathStarts[pathStarts.length - 1] !== tickArrayStartIndex(newTickCurrentIndex, tickSpacing)) {
    pathStarts.push(pathStarts[pathStarts.length - 1] + step);
  }
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
    newSqrtPrice: BigInt(shocked),
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
    assertTickArrayAccount(tickArray, account);
    const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
    for (let slot = 0; slot < TICK_ARRAY_SIZE; slot++) {
      const offset = TICKS_OFFSET + slot * TICK_LEN;
      const tick = startIndex + slot * plan.tickSpacing;
      if (account.data[offset] !== 1 || tick <= low || tick > high) continue;
      crossed += view.getBigUint64(offset + 1, true) | (view.getBigInt64(offset + 9, true) << BigInt(64));
    }
  });
  const liquidity = plan.newTickCurrentIndex > plan.oldTickCurrentIndex ? plan.oldLiquidity + crossed : plan.oldLiquidity - crossed;
  if (liquidity < BigInt(0)) {
    throw new Error(`the crossed ticks leave a negative active liquidity (${liquidity}); the pool's tick arrays are inconsistent`);
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
      throw new Error(`${missing} The pool already sits on the edge of its current tick array [${currentStart}, ${currentEnd}].`);
    }
    // Rounded toward the array's interior, so the suggestion itself lands inside it.
    const exact = TICK_BASE ** (edgeTick - plan.oldTickCurrentIndex) * 1e6;
    const safeFactor = (isRaise ? Math.floor(exact) : Math.ceil(exact)) / 1e6;
    throw new Error(
      `${missing} The ${isRaise ? 'largest' : 'smallest'} factor that stays on the pool's current tick array [${currentStart}, ${currentEnd}] is ${safeFactor.toFixed(6)}.`
    );
  }
  assertTickArrayAccount(plan.tickArray, tickArray);
}

function assertTickArrayAccount(address: string, tickArray: WhirlpoolAccount): void {
  if (tickArray.owner !== WHIRLPOOL_PROGRAM_ID) {
    throw new Error(`tick array ${address} is owned by ${tickArray.owner}, not the Whirlpool program`);
  }
  if (tickArray.data.length !== TICK_ARRAY_LEN) {
    throw new Error(`tick array ${address} is ${tickArray.data.length} bytes, not the ${TICK_ARRAY_LEN} bytes of a TickArray`);
  }
}
