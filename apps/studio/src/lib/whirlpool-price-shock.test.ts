import { describe, expect, it } from 'vitest';
import {
  assertTickArrayExists,
  planWhirlpoolPriceShock,
  POOL_STATE_LEN,
  SQRT_PRICE_OFFSET,
  TICK_CURRENT_INDEX_OFFSET,
  TICK_SPACING_OFFSET,
  WHIRLPOOL_DISCRIMINATOR,
  WHIRLPOOL_PROGRAM_ID,
} from './whirlpool-price-shock';

const POOL = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE';

// A tick-spacing-1 pool at sqrt price 2^64 (price 1, tick 0).
const data = new Uint8Array(POOL_STATE_LEN);
data.set(WHIRLPOOL_DISCRIMINATOR);
new DataView(data.buffer).setUint16(TICK_SPACING_OFFSET, 1, true);
new DataView(data.buffer).setBigUint64(SQRT_PRICE_OFFSET + 8, BigInt(1), true);
const poolAccount = { owner: WHIRLPOOL_PROGRAM_ID, data };

describe('Whirlpool price shock', () => {
  it('reads the fields at the offsets the bundled IDL gives', () => {
    // IDL order: discriminator 8, whirlpools_config 32, whirlpool_bump 1, tick_spacing 2, fee_tier_index_seed 2,
    // fee_rate 2, protocol_fee_rate 2, liquidity 16, sqrt_price 16, tick_current_index 4.
    expect(WHIRLPOOL_DISCRIMINATOR).toEqual([63, 149, 209, 12, 225, 128, 99, 9]);
    expect(TICK_SPACING_OFFSET).toBe(8 + 32 + 1);
    expect(SQRT_PRICE_OFFSET).toBe(TICK_SPACING_OFFSET + 2 + 2 + 2 + 2 + 16);
    expect(TICK_CURRENT_INDEX_OFFSET).toBe(SQRT_PRICE_OFFSET + 16);
  });

  it('halves and quadruples the price', async () => {
    const halved = await planWhirlpoolPriceShock(POOL, poolAccount, 0.5);
    const quadrupled = await planWhirlpoolPriceShock(POOL, poolAccount, 4);

    expect(Number(halved.newSqrtPrice) / 2 ** 64).toBeCloseTo(Math.SQRT1_2, 9);
    expect(halved).toMatchObject({ newTickCurrentIndex: -6932, tickArrayStartIndex: -6952 });
    expect(quadrupled).toMatchObject({
      newSqrtPrice: BigInt(2) ** BigInt(65),
      newTickCurrentIndex: 13863,
      tickArrayStartIndex: 13816,
      tickArray: 'GtpuS8hUCDTzME7YENqarRQ51uxBziaXuyMjEFAMU53R',
    });
  });

  it('rejects bad factors and foreign accounts', async () => {
    for (const factor of [0, -1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(planWhirlpoolPriceShock(POOL, poolAccount, factor)).rejects.toThrow();
    }
    await expect(planWhirlpoolPriceShock(POOL, { data, owner: POOL }, 2)).rejects.toThrow('not the Whirlpool program');
  });

  it('names the missing tick array and the largest safe factor', async () => {
    const plan = await planWhirlpoolPriceShock(POOL, poolAccount, 4);

    expect(() => assertTickArrayExists(plan, null)).toThrow(
      `tick array ${plan.tickArray} (start index 13816) does not exist, so a swap could not resume from tick 13863. ` +
        "The largest factor that stays on the pool's current tick array [0, 87] is 1.008738."
    );
  });
});
