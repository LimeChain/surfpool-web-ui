import { describe, expect, it } from 'vitest';
import {
  checkTickArray,
  liquidityAfterShock,
  planPriceShock,
  RAYDIUM_CLMM_PROGRAM_ID,
  tickArrayStartIndex,
  validatePriceFactor,
} from './raydium-price-shock';

const POOL = '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv';
const SQRT_PRICE_ONE = BigInt('18446744073709551616');

function poolAccount(tickSpacing = 1) {
  const data = new Uint8Array(1544);
  data.set([247, 237, 227, 245, 215, 195, 222, 70]);
  const view = new DataView(data.buffer);
  view.setUint16(235, tickSpacing, true);
  view.setBigUint64(261, SQRT_PRICE_ONE >> BigInt(64), true);
  view.setBigUint64(237, BigInt(1000), true);
  return { owner: RAYDIUM_CLMM_PROGRAM_ID, data };
}

function tickArray(startIndex: number, ticks: Record<number, bigint>, tickSpacing = 1) {
  const data = new Uint8Array(10240);
  const view = new DataView(data.buffer);
  view.setInt32(40, startIndex, true);
  for (let slot = 0; slot < 60; slot++) view.setInt32(44 + slot * 168, startIndex + slot * tickSpacing, true);
  for (const [slot, liquidityNet] of Object.entries(ticks)) {
    const offset = 44 + Number(slot) * 168;
    view.setBigInt64(offset + 4, BigInt.asIntN(64, liquidityNet), true);
    view.setBigInt64(offset + 12, liquidityNet < BigInt(0) ? BigInt(-1) : BigInt(0), true);
    view.setBigUint64(offset + 20, BigInt(1), true);
  }
  return { owner: RAYDIUM_CLMM_PROGRAM_ID, data };
}

describe('raydium price shock', () => {
  it('reads the IDL offsets and rejects a wrong discriminator', () => {
    const plan = planPriceShock(POOL, poolAccount(), 4);
    expect(plan).toMatchObject({ tickSpacing: 1, oldSqrtPriceX64: SQRT_PRICE_ONE, oldTickCurrent: 0 });

    const bad = poolAccount();
    bad.data[0] ^= 0xff;
    expect(() => planPriceShock(POOL, bad, 4)).toThrow('is not a PoolState');
  });

  it.each([
    [0.5, '13043817825332783104', -6932],
    [4, '36893488147419103232', 13863],
  ])('moves price 1 by x%s onto the program sqrt price and tick', (factor, sqrt, tick) => {
    const plan = planPriceShock(POOL, poolAccount(), factor);
    expect(plan.newSqrtPriceX64.toString()).toBe(sqrt);
    expect(plan.newTickCurrent).toBe(tick);
  });

  it.each([
    [-600, 15, -900],
    [-1, 60, -3600],
    [600, 10, 600],
  ])('tick %s with spacing %s starts its array at %s', (tick, spacing, start) => {
    expect(tickArrayStartIndex(tick, spacing)).toBe(start);
  });

  it('rejects factors that are not positive, finite and different from 1', () => {
    for (const factor of [0, -1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validatePriceFactor(factor)).toThrow('price factor');
    }
  });

  it('names the missing array, its start index and the safe factor', () => {
    const plan = planPriceShock(POOL, poolAccount(), 4);
    expect(() => checkTickArray(plan, 'MissingTickArray', null)).toThrow(
      "tick array MissingTickArray (start index 13860) does not exist, so a swap could not resume from tick 13863. The largest factor that stays on the pool's current tick array [0, 59] is 1.005917."
    );
    // Rounded toward the inside of the array, the suggestion lands on it.
    expect(planPriceShock(POOL, poolAccount(), 1.005917).tickArrayStartIndex).toBe(0);
    expect(() => checkTickArray(planPriceShock(POOL, poolAccount(), 0.5), 'MissingTickArray', null)).toThrow(
      'already sits on the edge of its current tick array [0, 59]'
    );
  });

  it('carries the liquidity of every initialized tick the move crosses', () => {
    // Up to tick 30: crosses ticks 5 and 20 (added), not 45 which is past the destination.
    const up = planPriceShock(POOL, poolAccount(), 1.0001 ** 30.5);
    expect(up.newTickCurrent).toBe(30);
    expect(liquidityAfterShock(up, [tickArray(0, { 5: BigInt(200), 20: BigInt(-300), 45: BigInt(7) })])).toBe(BigInt(900));

    // Down to tick -70: crosses -3 and -60 (subtracted), not -70 itself.
    const down = planPriceShock(POOL, poolAccount(), 1.0001 ** -69.5);
    expect(down.pathStartIndexes).toEqual([0, -60, -120]);
    const lower = tickArray(-60, { 57: BigInt(-50), 0: BigInt(400) });
    expect(liquidityAfterShock(down, [tickArray(0, {}), lower, tickArray(-120, { 50: BigInt(1) })])).toBe(BigInt(650));
    expect(liquidityAfterShock(down, [null, lower, null])).toBe(BigInt(650));

    expect(() => liquidityAfterShock(up, [tickArray(0, { 5: BigInt(-2000) })])).toThrow('negative active liquidity');
  });
});
