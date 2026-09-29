import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const RAYDIUM_CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
export const RAYDIUM_CLMM_POOL_STATE_TEMPLATE_ID = 'raydium-clmm-pool-state';

// PoolState is a packed C layout; offsets include the 8-byte discriminator (bundled amm_v3 IDL).
const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70];
const POOL_STATE_LEN = 1544;
const TICK_SPACING_OFFSET = 235;
const LIQUIDITY_OFFSET = 237;
const SQRT_PRICE_X64_OFFSET = 253;
const TICK_CURRENT_OFFSET = 269;

const TICK_ARRAY_SIZE = 60;
const TICK_ARRAY_LEN = 10240;
// TickArrayState: discriminator 8, pool_id 32, start_tick_index 4, then 60 ticks of 168 bytes
// (tick 4, liquidity_net 16, liquidity_gross 16, fee and reward growths, padding).
const TICKS_OFFSET = 44;
const TICK_LEN = 168;

const MIN_TICK = -443636;
const MAX_TICK = 443636;
const MIN_SQRT_PRICE_X64 = BigInt('4295048016');
const MAX_SQRT_PRICE_X64 = BigInt('79226673521066979257578248091');

const Q64 = 18446744073709551616;
const TICK_BASE = 1.0001;

export type RaydiumClmmAccount = { owner: string; data: Uint8Array };

type RaydiumClmmPriceShockPlan = ReturnType<typeof planPriceShock>;

export function validatePriceFactor(priceFactor: number): void {
  if (!Number.isFinite(priceFactor)) throw new Error('price factor must be a finite number');
  if (priceFactor <= 0) throw new Error('price factor must be greater than zero');
  if (priceFactor === 1) throw new Error('price factor of 1 would leave the pool unchanged');
}

function shockedSqrtPriceX64(sqrtPriceX64: bigint, priceFactor: number): bigint {
  const shocked = Math.round(Number(sqrtPriceX64) * Math.sqrt(priceFactor));
  if (!Number.isFinite(shocked)) throw new Error('shocked price is not a finite number');
  if (shocked < Number(MIN_SQRT_PRICE_X64) || shocked >= Number(MAX_SQRT_PRICE_X64)) {
    throw new Error(`sqrt_price_x64 ${BigInt(shocked)} is outside [${MIN_SQRT_PRICE_X64}, ${MAX_SQRT_PRICE_X64})`);
  }
  return BigInt(shocked);
}

function tickAtSqrtPriceX64(sqrtPriceX64: bigint): number {
  const tick = Math.floor((2 * Math.log(Number(sqrtPriceX64) / Q64)) / Math.log(TICK_BASE));
  if (!Number.isFinite(tick) || tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error(`shocked price lands on tick ${tick}, outside [${MIN_TICK}, ${MAX_TICK}]`);
  }
  return tick;
}

export function tickArrayStartIndex(tick: number, tickSpacing: number): number {
  const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
  return Math.floor(tick / ticksInArray) * ticksInArray;
}

export async function tickArrayAddress(pool: string, startIndex: number): Promise<string> {
  const startIndexBytes = new Uint8Array(4);
  new DataView(startIndexBytes.buffer).setInt32(0, startIndex, false);
  const [tickArray] = await getProgramDerivedAddress({
    programAddress: address(RAYDIUM_CLMM_PROGRAM_ID),
    seeds: ['tick_array', getAddressEncoder().encode(address(pool)), startIndexBytes],
  });
  return tickArray;
}

export function planPriceShock(pool: string, { owner, data }: RaydiumClmmAccount, priceFactor: number) {
  validatePriceFactor(priceFactor);
  if (owner !== RAYDIUM_CLMM_PROGRAM_ID) throw new Error(`${pool} is owned by ${owner}, not the CLMM program`);
  if (data.length !== POOL_STATE_LEN) throw new Error(`${pool} is ${data.length} bytes, not a PoolState`);
  if (POOL_STATE_DISCRIMINATOR.some((byte, i) => data[i] !== byte)) throw new Error(`${pool} is not a PoolState`);

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tickSpacing = view.getUint16(TICK_SPACING_OFFSET, true);
  if (tickSpacing === 0) throw new Error('pool declares a tick spacing of zero');
  const oldSqrtPriceX64 =
    (view.getBigUint64(SQRT_PRICE_X64_OFFSET + 8, true) << BigInt(64)) | view.getBigUint64(SQRT_PRICE_X64_OFFSET, true);
  const newSqrtPriceX64 = shockedSqrtPriceX64(oldSqrtPriceX64, priceFactor);
  const newTickCurrent = tickAtSqrtPriceX64(newSqrtPriceX64);
  const oldTickCurrent = view.getInt32(TICK_CURRENT_OFFSET, true);

  // Every array from the current one to the destination, in the direction of the move.
  const destinationStart = tickArrayStartIndex(newTickCurrent, tickSpacing);
  const step = newTickCurrent >= oldTickCurrent ? TICK_ARRAY_SIZE * tickSpacing : -TICK_ARRAY_SIZE * tickSpacing;
  const pathStartIndexes = [tickArrayStartIndex(oldTickCurrent, tickSpacing)];
  while (pathStartIndexes[pathStartIndexes.length - 1] !== destinationStart) {
    pathStartIndexes.push(pathStartIndexes[pathStartIndexes.length - 1] + step);
  }

  return {
    pool,
    priceFactor,
    tickSpacing,
    oldSqrtPriceX64,
    newSqrtPriceX64,
    oldTickCurrent,
    oldLiquidity:
      (view.getBigUint64(LIQUIDITY_OFFSET + 8, true) << BigInt(64)) | view.getBigUint64(LIQUIDITY_OFFSET, true),
    newTickCurrent,
    tickArrayStartIndex: destinationStart,
    pathStartIndexes,
  };
}

/**
 * The active liquidity at the new tick. A real swap adds each crossed tick's liquidity_net when the
 * price rises and subtracts it when it falls; writing only the price would keep the old range's
 * liquidity. `pathAccounts` follows `plan.pathStartIndexes`; a missing array holds no initialized ticks.
 */
export function liquidityAfterShock(plan: RaydiumClmmPriceShockPlan, pathAccounts: (RaydiumClmmAccount | null)[]): bigint {
  const [low, high] = [Math.min(plan.oldTickCurrent, plan.newTickCurrent), Math.max(plan.oldTickCurrent, plan.newTickCurrent)];
  let crossed = BigInt(0);
  plan.pathStartIndexes.forEach((startIndex, index) => {
    const account = pathAccounts[index];
    if (!account) return;
    assertTickArrayAccount(`at start index ${startIndex}`, account);
    const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
    for (let slot = 0; slot < TICK_ARRAY_SIZE; slot++) {
      const offset = TICKS_OFFSET + slot * TICK_LEN;
      const tick = view.getInt32(offset, true);
      const gross = (view.getBigUint64(offset + 28, true) << BigInt(64)) | view.getBigUint64(offset + 20, true);
      if (gross === BigInt(0) || tick <= low || tick > high) continue;
      crossed += (view.getBigInt64(offset + 12, true) << BigInt(64)) | view.getBigUint64(offset + 4, true);
    }
  });
  const liquidity = plan.newTickCurrent > plan.oldTickCurrent ? plan.oldLiquidity + crossed : plan.oldLiquidity - crossed;
  if (liquidity < BigInt(0)) {
    throw new Error(`the crossed ticks leave a negative active liquidity (${liquidity}); the pool's tick arrays are inconsistent`);
  }
  return liquidity;
}

/** A swap resumes from the array covering the new tick, so a missing one is rejected here rather than at swap time. */
export function checkTickArray(plan: RaydiumClmmPriceShockPlan, tickArray: string, account: RaydiumClmmAccount | null) {
  if (!account) {
    const currentStart = tickArrayStartIndex(plan.oldTickCurrent, plan.tickSpacing);
    const currentEnd = currentStart + TICK_ARRAY_SIZE * plan.tickSpacing - 1;
    const isRaise = plan.priceFactor > 1;
    const edgeTick = isRaise ? currentEnd : currentStart;
    const missing = `tick array ${tickArray} (start index ${plan.tickArrayStartIndex}) does not exist, so a swap could not resume from tick ${plan.newTickCurrent}.`;
    if (edgeTick === plan.oldTickCurrent) {
      throw new Error(`${missing} The pool already sits on the edge of its current tick array [${currentStart}, ${currentEnd}].`);
    }
    // Rounded toward the array's interior, so the suggestion itself lands inside it.
    const exact = Math.pow(TICK_BASE, edgeTick - plan.oldTickCurrent) * 1e6;
    const safeFactor = (isRaise ? Math.floor(exact) : Math.ceil(exact)) / 1e6;
    throw new Error(
      `${missing} The ${isRaise ? 'largest' : 'smallest'} factor that stays on the pool's current tick array [${currentStart}, ${currentEnd}] is ${safeFactor.toFixed(6)}.`
    );
  }
  assertTickArrayAccount(tickArray, account);
}

function assertTickArrayAccount(tickArray: string, account: RaydiumClmmAccount) {
  if (account.owner !== RAYDIUM_CLMM_PROGRAM_ID) throw new Error(`tick array ${tickArray} is not owned by CLMM`);
  if (account.data.length !== TICK_ARRAY_LEN) throw new Error(`tick array ${tickArray} is not a TickArrayState`);
}

export function buildPriceShockScenario(plan: RaydiumClmmPriceShockPlan, liquidity: bigint) {
  return {
    id: crypto.randomUUID(),
    name: 'Raydium CLMM Price Shock',
    description: `Move Raydium CLMM pool ${plan.pool} to ${plan.priceFactor}x its price, onto tick ${plan.newTickCurrent} of the tick array starting at ${plan.tickArrayStartIndex}.`,
    overrides: [
      {
        id: crypto.randomUUID(),
        templateId: RAYDIUM_CLMM_POOL_STATE_TEMPLATE_ID,
        values: {
          sqrt_price_x64: plan.newSqrtPriceX64.toString(),
          tick_current: plan.newTickCurrent,
          liquidity: liquidity.toString(),
        },
        scenarioRelativeSlot: 1,
        label: `CLMM price x${plan.priceFactor}`,
        enabled: true,
        fetchBeforeUse: true,
        account: { pubkey: plan.pool },
      },
    ],
    tags: ['raydium', 'clmm', 'price-shock'],
  };
}
