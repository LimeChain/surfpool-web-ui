import { describe, expect, it } from 'vitest';
import {
  ACTIVE_ID_OFFSET,
  assertBinArray,
  BIN_ARRAY_DISCRIMINATOR,
  BIN_ARRAY_LEN,
  BIN_STEP_OFFSET,
  LB_PAIR_DISCRIMINATOR,
  LB_PAIR_LEN,
  METEORA_DLMM_PROGRAM_ID,
  planMeteoraPriceShock,
} from './meteora-price-shock';

const SOL_USDC = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';

function poolAccount() {
  const data = new Uint8Array(LB_PAIR_LEN);
  data.set(LB_PAIR_DISCRIMINATOR);
  const view = new DataView(data.buffer);
  view.setInt32(ACTIVE_ID_OFFSET, -2222, true);
  view.setUint16(BIN_STEP_OFFSET, 10, true);
  return { owner: METEORA_DLMM_PROGRAM_ID, data };
}

describe('meteora price shock', () => {
  it('uses the LbPair and BinArray layouts from the DLMM IDL', () => {
    expect([LB_PAIR_LEN, ACTIVE_ID_OFFSET, BIN_STEP_OFFSET, BIN_ARRAY_LEN]).toEqual([904, 76, 80, 10136]);
    expect(LB_PAIR_DISCRIMINATOR).toEqual([0x21, 0x0b, 0x31, 0x62, 0xb5, 0x65, 0xb1, 0x0d]);
    expect(BIN_ARRAY_DISCRIMINATOR).toEqual([0x5c, 0x8e, 0x5c, 0xdc, 0x05, 0x94, 0x46, 0xb5]);
  });

  it('moves active_id by the rounded bin count in each direction', async () => {
    expect((await planMeteoraPriceShock(SOL_USDC, poolAccount(), 0.5)).newActiveId).toBe(-2222 - 693);
    expect((await planMeteoraPriceShock(SOL_USDC, poolAccount(), 4)).newActiveId).toBe(-2222 + 1387);
  });

  it('derives the SOL/USDC bin arrays that exist on mainnet', async () => {
    const rows: Array<[number, number, string]> = [
      [0.99, -32, 'A3SKQ8z881LAcgFJ1eWyGv8LGYKoEvkuPtguVkfvYU8T'],
      [1.1, -31, '28WnLxAM6rpjMToCVqaDys7dpiRmVUeQus1pvzGVR4G2'],
      [0.55, -41, '2QCcp5NpkXzUk8Ch9GTtWEUorviJDnDPG9FFPkQY8S4n'],
    ];
    for (const [factor, binArrayIndex, binArray] of rows) {
      expect(await planMeteoraPriceShock(SOL_USDC, poolAccount(), factor)).toMatchObject({ binArrayIndex, binArray });
    }
  });

  it('rejects factors that are not a finite price change', async () => {
    for (const factor of [0, -1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(planMeteoraPriceShock(SOL_USDC, poolAccount(), factor)).rejects.toThrow('price factor');
    }
  });

  it('names the missing bin array and the largest safe factor', async () => {
    const plan = await planMeteoraPriceShock(SOL_USDC, poolAccount(), 1.1);

    expect(() => assertBinArray(plan, null)).toThrow(
      "bin array 28WnLxAM6rpjMToCVqaDys7dpiRmVUeQus1pvzGVR4G2 (index -31) does not exist, so a swap could not resume from bin -2127. The largest factor that stays on the pool's current bin array [-2240, -2171] is 1.052296."
    );
  });
});
