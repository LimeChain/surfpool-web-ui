import { getAddressDecoder } from '@solana/kit';
import { stringify } from 'lossless-json';
import { describe, expect, it } from 'vitest';
import {
  buildCpmmPriceShockScenario,
  cpmmVaultAmountsAfterShock,
  cpmmVaults,
  RAYDIUM_CPMM_PROGRAM_ID,
} from './raydium-cpmm-price-shock';

const POOL = 'Q2sPHPdUWFMg7M7wwrQKLrn619cAucfRsmhVJffodSp';
const VAULT_0_BYTES = new Uint8Array(32).fill(1);
const VAULT_1_BYTES = new Uint8Array(32).fill(2);
const VAULTS = [getAddressDecoder().decode(VAULT_0_BYTES), getAddressDecoder().decode(VAULT_1_BYTES)];

function poolAccount(owedFees: number[] = [0, 0, 0, 0, 0, 0]) {
  const data = new Uint8Array(637);
  data.set([247, 237, 227, 245, 215, 195, 222, 70]);
  data.set(VAULT_0_BYTES, 72);
  data.set(VAULT_1_BYTES, 104);
  const view = new DataView(data.buffer);
  [341, 349, 357, 365, 397, 405].forEach((offset, i) => view.setBigUint64(offset, BigInt(owedFees[i]), true));
  return { owner: RAYDIUM_CPMM_PROGRAM_ID, data };
}

function tokenAccount(amount: bigint) {
  const data = new Uint8Array(165);
  new DataView(data.buffer).setBigUint64(64, amount, true);
  return { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', data };
}

describe('raydium cpmm price shock', () => {
  it('reads the vaults at the IDL offsets and rejects other accounts', () => {
    expect(cpmmVaults(POOL, poolAccount())).toEqual(VAULTS);
    expect(() => cpmmVaults(POOL, { ...poolAccount(), owner: 'other' })).toThrow('not the CPMM program');
    expect(() => cpmmVaults(POOL, { ...poolAccount(), data: new Uint8Array(1544) })).toThrow('not a CPMM PoolState');
  });

  it('moves the reserves along x * y = k and keeps the owed fees in each vault', () => {
    // token 0 fees 10 + 30 + 60 = 100, token 1 fees 20 + 40 + 140 = 200
    const pool = poolAccount([10, 20, 30, 40, 60, 140]);
    const vaults = [tokenAccount(BigInt(1_000_100)), tokenAccount(BigInt(4_000_200))];

    expect(cpmmVaultAmountsAfterShock(pool, vaults, VAULTS, 4)).toEqual([BigInt(500_100), BigInt(8_000_200)]);
    expect(cpmmVaultAmountsAfterShock(pool, vaults, VAULTS, 0.25)).toEqual([BigInt(2_000_100), BigInt(2_000_200)]);
  });

  it('refuses vaults it cannot price', () => {
    const pool = poolAccount([100, 0, 0, 0, 0, 0]);
    expect(() =>
      cpmmVaultAmountsAfterShock(pool, [tokenAccount(BigInt(100)), tokenAccount(BigInt(5))], VAULTS, 2)
    ).toThrow('holds no reserve beyond the fees the pool owes');
    expect(() => cpmmVaultAmountsAfterShock(pool, [null, tokenAccount(BigInt(5))], VAULTS, 2)).toThrow('was not found');
    expect(() =>
      cpmmVaultAmountsAfterShock(poolAccount(), [tokenAccount(BigInt(1)), tokenAccount(BigInt(5))], VAULTS, 4)
    ).toThrow('empties vault');
  });

  it('posts each vault balance as an exact JSON number', () => {
    const scenario = buildCpmmPriceShockScenario(POOL, 2, VAULTS, [BigInt('18000000000000000001'), BigInt(7)]);
    expect(stringify(scenario.overrides[0].values)).toBe('{"amount":18000000000000000001}');
    expect(scenario.overrides.map((override) => override.account.pubkey)).toEqual(VAULTS);
    expect(scenario.overrides[0]).toMatchObject({ templateId: 'spl-token-account-balance', scenarioRelativeSlot: 1 });
  });
});
