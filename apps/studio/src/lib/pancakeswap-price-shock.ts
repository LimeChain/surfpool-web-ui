import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const PANCAKESWAP_CLMM_PROGRAM_ID = 'HpNfyc2Saw7RKkQd8nEL4khUcuPhQ7WwY1B2qjx8jxFq';

// PoolState is a packed C struct; these offsets include the 8-byte discriminator (from v1/idl.json).
export const POOL_STATE_LEN = 1544;
export const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70];
export const TICK_SPACING_OFFSET = 235;
export const SQRT_PRICE_X64_OFFSET = 253;
export const TICK_CURRENT_OFFSET = 269;
export const TICK_ARRAY_LEN = 10240;

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
  const startIndex = tickArrayStartIndex(newTickCurrent, tickSpacing);

  return {
    pool,
    priceFactor,
    tickSpacing,
    oldTickCurrent: view.getInt32(TICK_CURRENT_OFFSET, true),
    newSqrtPriceX64: BigInt(shocked),
    newTickCurrent,
    tickArray: await tickArrayAddress(pool, startIndex),
    tickArrayStartIndex: startIndex,
  };
}

export function pancakeswapScenario(name: string, description: string, override: object, tags: string[]) {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    // Unset fields (liquidity, vaults, fee growth) must come from the live account.
    overrides: [{ id: crypto.randomUUID(), enabled: true, fetchBeforeUse: true, ...override }],
    tags,
  };
}

type PancakeswapPriceShockPlan = Awaited<ReturnType<typeof planPancakeswapPriceShock>>;

export function buildPancakeswapPriceShockScenario(plan: PancakeswapPriceShockPlan, tickArray: PoolAccount | null) {
  if (!tickArray) {
    const { oldTickCurrent, tickSpacing, priceFactor } = plan;
    const start = tickArrayStartIndex(oldTickCurrent, tickSpacing);
    const end = start + TICK_ARRAY_SIZE * tickSpacing - 1;
    const [bound, adjective] = priceFactor > 1 ? [end, 'largest'] : [start, 'smallest'];
    const safeFactor = (TICK_BASE ** (bound - oldTickCurrent)).toFixed(6);
    throw new Error(
      `tick array ${plan.tickArray} (start index ${plan.tickArrayStartIndex}) does not exist, so a swap could not resume from tick ${plan.newTickCurrent}. ` +
        `The ${adjective} factor that stays on the pool's current tick array [${start}, ${end}] is ${safeFactor}.`
    );
  }
  checkAccount(`tick array ${plan.tickArray}`, tickArray, TICK_ARRAY_LEN, 'TickArrayState');

  return pancakeswapScenario(
    'PancakeSwap CLMM Price Shock',
    `Move PancakeSwap CLMM pool ${plan.pool} to ${plan.priceFactor}x its price, onto tick ${plan.newTickCurrent} of the tick array starting at ${plan.tickArrayStartIndex}.`,
    {
      templateId: 'pancakeswap-clmm-pool-state',
      values: { sqrt_price_x64: plan.newSqrtPriceX64.toString(), tick_current: plan.newTickCurrent },
      scenarioRelativeSlot: 1,
      label: `CLMM price x${plan.priceFactor}`,
      account: { pubkey: plan.pool },
    },
    ['pancakeswap', 'clmm', 'price-shock']
  );
}
