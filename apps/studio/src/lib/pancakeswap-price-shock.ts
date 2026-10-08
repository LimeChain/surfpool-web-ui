import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const PANCAKESWAP_CLMM_PROGRAM_ID = 'HpNfyc2Saw7RKkQd8nEL4khUcuPhQ7WwY1B2qjx8jxFq';

// PoolState is a packed C struct; these offsets include the 8-byte discriminator (from v1/idl.json).
export const POOL_STATE_LEN = 1544;
export const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70];
export const TICK_SPACING_OFFSET = 235;
export const LIQUIDITY_OFFSET = 237;
export const SQRT_PRICE_X64_OFFSET = 253;
export const TICK_CURRENT_OFFSET = 269;
export const TICK_ARRAY_LEN = 10240;
// TickArrayState: discriminator 8, pool_id 32, start_tick_index 4, then 60 ticks of 168 bytes
// (tick 4, liquidity_net 16, liquidity_gross 16, fee and reward growths, padding).
export const TICKS_OFFSET = 44;
export const TICK_LEN = 168;

const TICK_ARRAY_SIZE = 60;
const MIN_TICK = -443636;
const MAX_TICK = 443636;
const MIN_SQRT_PRICE_X64 = BigInt('4295048016');
const MAX_SQRT_PRICE_X64 = BigInt('79226673521066979257578248091');
const Q64 = 18446744073709551616;
const TICK_BASE = 1.0001;

export type PoolAccount = { owner: string; data: Uint8Array };

export function validatePriceFactor(priceFactor: number): void {
  if (!Number.isFinite(priceFactor)) throw new Error('price factor must be a finite number');
  if (priceFactor <= 0) throw new Error('price factor must be greater than zero');
  if (priceFactor === 1) throw new Error('price factor of 1 would leave the pool unchanged');
}

function checkAccount(name: string, account: PoolAccount, length: number, kind: string): void {
  if (account.owner !== PANCAKESWAP_CLMM_PROGRAM_ID) {
    throw new Error(`${name} is owned by ${account.owner}, not the CLMM program ${PANCAKESWAP_CLMM_PROGRAM_ID}`);
  }
  if (account.data.length !== length) {
    throw new Error(`${name} is ${account.data.length} bytes, not the ${length} bytes of a ${kind}`);
  }
}

export const tickArrayStartIndex = (tick: number, tickSpacing: number) =>
  Math.floor(tick / (TICK_ARRAY_SIZE * tickSpacing)) * TICK_ARRAY_SIZE * tickSpacing;

export async function tickArrayAddress(pool: string, startTickIndex: number): Promise<string> {
  const startIndexBytes = new Uint8Array(4);
  new DataView(startIndexBytes.buffer).setInt32(0, startTickIndex, false);
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(PANCAKESWAP_CLMM_PROGRAM_ID),
    seeds: ['tick_array', getAddressEncoder().encode(address(pool)), startIndexBytes],
  });
  return pda;
}

export async function planPancakeswapPriceShock(pool: string, account: PoolAccount, priceFactor: number) {
  validatePriceFactor(priceFactor);
  checkAccount(pool, account, POOL_STATE_LEN, 'PoolState');
  if (POOL_STATE_DISCRIMINATOR.some((byte, index) => account.data[index] !== byte)) {
    throw new Error('account does not carry the PoolState discriminator declared by the bundled IDL');
  }

  const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
  const tickSpacing = view.getUint16(TICK_SPACING_OFFSET, true);
  if (tickSpacing === 0) throw new Error('pool declares a tick spacing of zero');
  const sqrtPriceX64 =
    view.getBigUint64(SQRT_PRICE_X64_OFFSET, true) | (view.getBigUint64(SQRT_PRICE_X64_OFFSET + 8, true) << BigInt(64));

  const shocked = Math.round(Number(sqrtPriceX64) * Math.sqrt(priceFactor));
  if (shocked < Number(MIN_SQRT_PRICE_X64) || shocked >= Number(MAX_SQRT_PRICE_X64)) {
    throw new Error(
      `price factor moves sqrt_price_x64 to ${BigInt(shocked)}, outside the range the program accepts [${MIN_SQRT_PRICE_X64}, ${MAX_SQRT_PRICE_X64})`
    );
  }
  const newTickCurrent = Math.floor((2 * Math.log(shocked / Q64)) / Math.log(TICK_BASE));
  if (newTickCurrent < MIN_TICK || newTickCurrent > MAX_TICK) {
    throw new Error(`shocked price lands on tick ${newTickCurrent}, outside [${MIN_TICK}, ${MAX_TICK}]`);
  }
  const oldTickCurrent = view.getInt32(TICK_CURRENT_OFFSET, true);
  const startIndex = tickArrayStartIndex(newTickCurrent, tickSpacing);
  // Every array from the current one to the destination, in the direction of the move.
  const step = newTickCurrent >= oldTickCurrent ? TICK_ARRAY_SIZE * tickSpacing : -TICK_ARRAY_SIZE * tickSpacing;
  const pathStarts = [tickArrayStartIndex(oldTickCurrent, tickSpacing)];
  while (pathStarts[pathStarts.length - 1] !== startIndex) pathStarts.push(pathStarts[pathStarts.length - 1] + step);
  const pathTickArrays = await Promise.all(
    pathStarts.map(async (start) => ({ address: await tickArrayAddress(pool, start), startIndex: start }))
  );

  return {
    pool,
    priceFactor,
    tickSpacing,
    oldTickCurrent,
    newSqrtPriceX64: BigInt(shocked),
    newTickCurrent,
    oldLiquidity:
      view.getBigUint64(LIQUIDITY_OFFSET, true) | (view.getBigUint64(LIQUIDITY_OFFSET + 8, true) << BigInt(64)),
    tickArray: pathTickArrays[pathTickArrays.length - 1].address,
    tickArrayStartIndex: startIndex,
    pathTickArrays,
  };
}

export function pancakeswapScenario(name: string, description: string, override: object, tags: string[]) {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    // Unset fields (vaults, fee growth) must come from the live account.
    overrides: [{ id: crypto.randomUUID(), enabled: true, fetchBeforeUse: true, ...override }],
    tags,
  };
}

type PancakeswapPriceShockPlan = Awaited<ReturnType<typeof planPancakeswapPriceShock>>;

/**
 * The active liquidity at the new tick. A real swap adds each crossed tick's liquidity_net when the
 * price rises and subtracts it when it falls; writing only the price would keep the old range's
 * liquidity. `pathAccounts` follows `plan.pathTickArrays`; a missing array holds no initialized ticks.
 */
export function liquidityAfterShock(plan: PancakeswapPriceShockPlan, pathAccounts: (PoolAccount | null)[]): bigint {
  const [low, high] = [Math.min(plan.oldTickCurrent, plan.newTickCurrent), Math.max(plan.oldTickCurrent, plan.newTickCurrent)];
  let crossed = BigInt(0);
  plan.pathTickArrays.forEach(({ address: tickArray }, index) => {
    const account = pathAccounts[index];
    if (!account) return;
    checkAccount(`tick array ${tickArray}`, account, TICK_ARRAY_LEN, 'TickArrayState');
    const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
    for (let slot = 0; slot < TICK_ARRAY_SIZE; slot++) {
      const offset = TICKS_OFFSET + slot * TICK_LEN;
      const tick = view.getInt32(offset, true);
      const gross = view.getBigUint64(offset + 20, true) | (view.getBigUint64(offset + 28, true) << BigInt(64));
      if (gross === BigInt(0) || tick <= low || tick > high) continue;
      crossed += view.getBigUint64(offset + 4, true) | (view.getBigInt64(offset + 12, true) << BigInt(64));
    }
  });
  const liquidity = plan.newTickCurrent > plan.oldTickCurrent ? plan.oldLiquidity + crossed : plan.oldLiquidity - crossed;
  if (liquidity < BigInt(0)) {
    throw new Error(`the crossed ticks leave a negative active liquidity (${liquidity}); the pool's tick arrays are inconsistent`);
  }
  return liquidity;
}

export function buildPancakeswapPriceShockScenario(plan: PancakeswapPriceShockPlan, pathAccounts: (PoolAccount | null)[]) {
  const tickArray = pathAccounts[pathAccounts.length - 1];
  if (!tickArray) {
    const { oldTickCurrent, tickSpacing, priceFactor } = plan;
    const start = tickArrayStartIndex(oldTickCurrent, tickSpacing);
    const end = start + TICK_ARRAY_SIZE * tickSpacing - 1;
    const [bound, adjective] = priceFactor > 1 ? [end, 'largest'] : [start, 'smallest'];
    const missing = `tick array ${plan.tickArray} (start index ${plan.tickArrayStartIndex}) does not exist, so a swap could not resume from tick ${plan.newTickCurrent}.`;
    if (bound === oldTickCurrent) {
      throw new Error(`${missing} The pool already sits on the edge of its current tick array [${start}, ${end}].`);
    }
    // Rounded toward the array's interior, so the suggestion itself lands inside it.
    const exact = TICK_BASE ** (bound - oldTickCurrent) * 1e6;
    const safeFactor = ((priceFactor > 1 ? Math.floor(exact) : Math.ceil(exact)) / 1e6).toFixed(6);
    throw new Error(
      `${missing} The ${adjective} factor that stays on the pool's current tick array [${start}, ${end}] is ${safeFactor}.`
    );
  }
  checkAccount(`tick array ${plan.tickArray}`, tickArray, TICK_ARRAY_LEN, 'TickArrayState');

  return pancakeswapScenario(
    'PancakeSwap CLMM Price Shock',
    `Move PancakeSwap CLMM pool ${plan.pool} to ${plan.priceFactor}x its price, onto tick ${plan.newTickCurrent} of the tick array starting at ${plan.tickArrayStartIndex}.`,
    {
      templateId: 'pancakeswap-clmm-pool-state',
      values: {
        sqrt_price_x64: plan.newSqrtPriceX64.toString(),
        tick_current: plan.newTickCurrent,
        liquidity: liquidityAfterShock(plan, pathAccounts).toString(),
      },
      scenarioRelativeSlot: 1,
      label: `CLMM price x${plan.priceFactor}`,
      account: { pubkey: plan.pool },
    },
    ['pancakeswap', 'clmm', 'price-shock']
  );
}
