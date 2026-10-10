import { describe, expect, it } from 'vitest';
import {
  assertTickArrayExists,
  LIQUIDITY_OFFSET,
  liquidityAfterShock,
  planWhirlpoolPriceShock,
  POOL_STATE_LEN,
  SQRT_PRICE_OFFSET,
  TICK_ARRAY_LEN,
  TICK_CURRENT_INDEX_OFFSET,
  TICK_LEN,
  TICK_SPACING_OFFSET,
  TICKS_OFFSET,
  WHIRLPOOL_DISCRIMINATOR,
  WHIRLPOOL_PROGRAM_ID,
} from './whirlpool-price-shock';

const POOL = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE';

// A tick-spacing-1 pool at sqrt price 2^64 (price 1, tick 0).
const data = new Uint8Array(POOL_STATE_LEN);
data.set(WHIRLPOOL_DISCRIMINATOR);
new DataView(data.buffer).setUint16(TICK_SPACING_OFFSET, 1, true);
new DataView(data.buffer).setBigUint64(SQRT_PRICE_OFFSET + 8, BigInt(1), true);
new DataView(data.buffer).setBigUint64(LIQUIDITY_OFFSET, BigInt(1000), true);
const poolAccount = { owner: WHIRLPOOL_PROGRAM_ID, data };

function tickArray(ticks: Record<number, bigint>) {
  const bytes = new Uint8Array(TICK_ARRAY_LEN);
  const view = new DataView(bytes.buffer);
  for (const [slot, liquidityNet] of Object.entries(ticks)) {
    const offset = TICKS_OFFSET + Number(slot) * TICK_LEN;
    bytes[offset] = 1;
    view.setBigInt64(offset + 1, BigInt.asIntN(64, liquidityNet), true);
    view.setBigInt64(offset + 9, liquidityNet < BigInt(0) ? BigInt(-1) : BigInt(0), true);
  }
  return { owner: WHIRLPOOL_PROGRAM_ID, data: bytes };
}

function suggestedFactor(plan: Awaited<ReturnType<typeof planWhirlpoolPriceShock>>): number {
  try {
    assertTickArrayExists(plan, null);
  } catch (error) {
    return Number(/is (\d+\.\d+)\.$/.exec((error as Error).message)?.[1]);
  }
  throw new Error('expected the missing tick array to be rejected');
}

describe('Whirlpool price shock', () => {
  it('reads the fields at the offsets the bundled IDL gives', () => {
    // IDL order: discriminator 8, whirlpools_config 32, whirlpool_bump 1, tick_spacing 2, fee_tier_index_seed 2,
    // fee_rate 2, protocol_fee_rate 2, liquidity 16, sqrt_price 16, tick_current_index 4.
    expect(WHIRLPOOL_DISCRIMINATOR).toEqual([63, 149, 209, 12, 225, 128, 99, 9]);
    expect(TICK_SPACING_OFFSET).toBe(8 + 32 + 1);
    expect(LIQUIDITY_OFFSET).toBe(TICK_SPACING_OFFSET + 2 + 2 + 2 + 2);
    expect(SQRT_PRICE_OFFSET).toBe(LIQUIDITY_OFFSET + 16);
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
        "The largest factor that stays on the pool's current tick array [0, 87] is 1.008737."
    );
  });

  it('rounds the suggested factor toward the inside of the current array', async () => {
    const plan = await planWhirlpoolPriceShock(POOL, poolAccount, 4);
    const followUp = await planWhirlpoolPriceShock(POOL, poolAccount, suggestedFactor(plan));
    expect(followUp.tickArrayStartIndex).toBe(0);

    const halved = await planWhirlpoolPriceShock(POOL, poolAccount, 0.5);
    expect(() => assertTickArrayExists(halved, null)).toThrow('already sits on the edge of its current tick array [0, 87]');
  });

  it('carries the liquidity of every initialized tick the move crosses', async () => {
    // Up to tick 50: crosses ticks 5 and 40 (added), not 60 which is past the destination.
    const up = await planWhirlpoolPriceShock(POOL, poolAccount, 1.0001 ** 50.5);
    expect(up.newTickCurrentIndex).toBe(50);
    expect(liquidityAfterShock(up, [tickArray({ 5: BigInt(200), 40: BigInt(-300), 60: BigInt(7) })])).toBe(BigInt(900));

    // Down to tick -100: crosses ticks -3 and -90 in the array starting at -88 and below (subtracted).
    const down = await planWhirlpoolPriceShock(POOL, poolAccount, 1.0001 ** -99.5);
    expect(down.pathTickArrays.map((array) => array.startIndex)).toEqual([0, -88, -176]);
    const lower = tickArray({ 85: BigInt(-50), 0: BigInt(400) });
    // Slot 85 of the array at -88 is tick -3; slot 0 is tick -88; slot 76 of the array at -176 is tick -100 (not crossed).
    expect(liquidityAfterShock(down, [tickArray({}), lower, tickArray({ 76: BigInt(1) })])).toBe(BigInt(650));

    // A missing array on the path holds no initialized ticks.
    expect(liquidityAfterShock(down, [null, lower, null])).toBe(BigInt(650));
  });

  it('rejects a crossing that would leave negative liquidity', async () => {
    const up = await planWhirlpoolPriceShock(POOL, poolAccount, 1.0001 ** 50.5);
    expect(() => liquidityAfterShock(up, [tickArray({ 5: BigInt(-2000) })])).toThrow('negative active liquidity');
  });
});
