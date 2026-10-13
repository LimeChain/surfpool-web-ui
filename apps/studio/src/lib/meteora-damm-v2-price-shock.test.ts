import { stringify } from 'lossless-json';
import { describe, expect, it } from 'vitest';
import {
  buildDammV2FeeScenario,
  buildDammV2PriceShockScenario,
  METEORA_DAMM_V2_PROGRAM_ID,
  planDammV2Fee,
  planDammV2PriceShock,
} from './meteora-damm-v2-price-shock';

const POOL = '8Pm2kZpnxD3hoMmt4bjStX2Pw2Z9abpbHzZxMPqxPmie';

function poolAccount({
  mode = 0,
  liquidity = BigInt(0),
  sqrtMin = BigInt(0),
  sqrtMax = BigInt(0),
  sqrtPrice = BigInt(0),
  tokenA = BigInt(0),
  tokenB = BigInt(0),
}) {
  const data = new Uint8Array(1112);
  data.set([241, 154, 109, 4, 17, 177, 109, 188]);
  const view = new DataView(data.buffer);
  const setU128 = (offset: number, value: bigint) => {
    view.setBigUint64(offset, value & ((BigInt(1) << BigInt(64)) - BigInt(1)), true);
    view.setBigUint64(offset + 8, value >> BigInt(64), true);
  };
  setU128(360, liquidity);
  setU128(424, sqrtMin);
  setU128(440, sqrtMax);
  setU128(456, sqrtPrice);
  data[484] = mode;
  view.setBigUint64(680, tokenA, true);
  view.setBigUint64(688, tokenB, true);
  return { owner: METEORA_DAMM_V2_PROGRAM_ID, data };
}

// The SOL/USDC pool's live range, liquidity and price, as read on mainnet.
const CONCENTRATED = poolAccount({
  liquidity: BigInt('127179428291588464169616526569305'),
  sqrtMin: BigInt('4880549731789001291'),
  sqrtMax: BigInt('12236185739241331242'),
  sqrtPrice: BigInt('6258945984289128889'),
});

describe('meteora damm v2 price shock', () => {
  it('moves a concentrated pool and derives both tracked reserves from its liquidity', () => {
    expect(planDammV2PriceShock(POOL, CONCENTRATED, 1.1)).toMatchObject({
      sqrtPrice: BigInt('6564437928541476710'),
      tokenA: BigInt('8980286113728'),
      tokenB: BigInt('629347738785'),
    });
    expect(() => planDammV2PriceShock(POOL, CONCENTRATED, 0.25)).toThrow("leaves the pool's price range");
  });

  it('moves a compounding pool along x * y = k and derives its price', () => {
    const pool = poolAccount({ mode: 2, tokenA: BigInt(27_134_832), tokenB: BigInt(232_490_568) });
    expect(planDammV2PriceShock(POOL, pool, 4)).toMatchObject({
      sqrtPrice: BigInt('107991312342960095158'),
      tokenA: BigInt(13_567_416),
      tokenB: BigInt(464_981_136),
    });
  });

  it('refuses accounts that are not DAMM v2 pools', () => {
    expect(() => planDammV2PriceShock(POOL, { ...CONCENTRATED, owner: 'other' }, 2)).toThrow('not the DAMM v2 program');
    expect(() => planDammV2PriceShock(POOL, { ...CONCENTRATED, data: new Uint8Array(904) }, 2)).toThrow(
      'not a DAMM v2 Pool'
    );
  });

  it('names the pool and overrides it through the given template', () => {
    const scenario = buildDammV2PriceShockScenario(planDammV2PriceShock(POOL, CONCENTRATED, 1.1), 'template');
    expect(scenario.name).toBe('Meteora DAMM v2 Price Shock (8Pm2kZ…)');
    expect(scenario.overrides[0]).toMatchObject({ templateId: 'template', account: { pubkey: POOL } });
  });

  it('posts the price as a string and the reserves as exact JSON numbers', () => {
    const plan = planDammV2PriceShock(POOL, CONCENTRATED, 1.1);
    const values = buildDammV2PriceShockScenario(plan, 'template').overrides[0].values;
    expect(stringify(values)).toBe(
      '{"sqrt_price":"6564437928541476710","token_a_amount":8980286113728,"token_b_amount":629347738785,' +
        '"pool_fees.dynamic_fee.sqrt_price_reference":"6564437928541476710"}'
    );
  });
});

describe('meteora damm v2 fee', () => {
  it('holds the base fee flat at the given basis points', () => {
    const plan = planDammV2Fee(POOL, CONCENTRATED, 500);
    expect(plan.cliffFeeNumerator).toBe(50_000_000);

    const scenario = buildDammV2FeeScenario(plan, 'meteora-damm-v2-pool-fees');
    expect(scenario.name).toBe('Meteora DAMM v2 Fee (8Pm2kZ…)');
    expect(scenario.overrides[0]).toMatchObject({
      templateId: 'meteora-damm-v2-pool-fees',
      values: {
        'pool_fees.base_fee.base_fee_info.cliff_fee_numerator': 50_000_000,
        'pool_fees.base_fee.base_fee_info.reduction_factor': 0,
      },
      scenarioRelativeSlot: 0,
      fetchBeforeUse: true,
      account: { pubkey: POOL },
    });
  });

  it('refuses a pool on the deprecated rate limiter', () => {
    const rateLimited = poolAccount({});
    rateLimited.data[16] = 2;
    expect(() => planDammV2Fee(POOL, rateLimited, 500)).toThrow('deprecated rate limiter');
  });

  it('refuses fees outside 1 to 5000 whole basis points', () => {
    for (const bps of [0, 5001, 2.5, Number.NaN]) {
      expect(() => planDammV2Fee(POOL, CONCENTRATED, bps)).toThrow('whole number of basis points');
    }
  });
});
