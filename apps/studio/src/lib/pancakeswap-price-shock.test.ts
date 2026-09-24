import { describe, expect, it } from 'vitest';
import {
  buildPancakeswapPriceShockScenario,
  PANCAKESWAP_CLMM_PROGRAM_ID,
  planPancakeswapPriceShock,
  POOL_STATE_DISCRIMINATOR,
  POOL_STATE_LEN,
  SQRT_PRICE_X64_OFFSET,
  TICK_CURRENT_OFFSET,
  TICK_SPACING_OFFSET,
  tickArrayStartIndex,
} from './pancakeswap-price-shock';

const POOL = 'DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ';
const SQRT_PRICE_ONE = BigInt(1) << BigInt(64);

function poolAccount(tickCurrent: number, tickSpacing = 1) {
  const data = new Uint8Array(POOL_STATE_LEN);
  data.set(POOL_STATE_DISCRIMINATOR);
  const view = new DataView(data.buffer);
  view.setUint16(TICK_SPACING_OFFSET, tickSpacing, true);
  view.setBigUint64(SQRT_PRICE_X64_OFFSET + 8, BigInt(1), true);
  view.setInt32(TICK_CURRENT_OFFSET, tickCurrent, true);
  return { owner: PANCAKESWAP_CLMM_PROGRAM_ID, data };
}

describe('PancakeSwap CLMM price shock', () => {
  it('matches the offsets and discriminator the bundled IDL gives', () => {
    expect([POOL_STATE_LEN, TICK_SPACING_OFFSET, SQRT_PRICE_X64_OFFSET, TICK_CURRENT_OFFSET]).toEqual([
      1544, 235, 253, 269,
    ]);
    expect(POOL_STATE_DISCRIMINATOR).toEqual([247, 237, 227, 245, 215, 195, 222, 70]);
  });

  it.each([
    [0.5, -6932, -6960],
    [4, 13863, 13860],
  ])('moves a factor %d shock to tick %d in the array starting at %d', async (factor, tick, start) => {
    const plan = await planPancakeswapPriceShock(POOL, poolAccount(0), factor);
    expect(Number(plan.newSqrtPriceX64) / Number(SQRT_PRICE_ONE)).toBeCloseTo(Math.sqrt(factor), 9);
    expect([plan.newTickCurrent, plan.tickArrayStartIndex]).toEqual([tick, start]);
  });

  it('matches the program tick array start index', () => {
    expect([tickArrayStartIndex(-600, 15), tickArrayStartIndex(600, 10), tickArrayStartIndex(-1, 60)]).toEqual([
      -900, 600, -3600,
    ]);
  });

  it('rejects factors that are not a real price move', async () => {
    for (const factor of [0, -1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(planPancakeswapPriceShock(POOL, poolAccount(0), factor)).rejects.toThrow('price factor');
    }
  });

  it('refuses a missing tick array and names the safe factor', async () => {
    const plan = await planPancakeswapPriceShock(POOL, poolAccount(0), 4);
    expect(() => buildPancakeswapPriceShockScenario(plan, null)).toThrow(
      `tick array ${plan.tickArray} (start index 13860) does not exist, so a swap could not resume from tick 13863. ` +
        "The largest factor that stays on the pool's current tick array [0, 59] is 1.005917."
    );
  });
});
