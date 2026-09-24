import { describe, expect, it } from 'vitest';
import {
  checkTickArray,
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
  });
});
