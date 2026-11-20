import { getAddressDecoder } from '@solana/kit';
import { LosslessNumber } from 'lossless-json';
import { validatePriceFactor } from './raydium-price-shock';

export const RAYDIUM_CPMM_PROGRAM_ID = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';

// PoolState is a packed C layout; offsets include the 8-byte discriminator (bundled raydium_cp_swap IDL).
const POOL_STATE_DISCRIMINATOR = [247, 237, 227, 245, 215, 195, 222, 70];
const POOL_STATE_LEN = 637;
const VAULT_OFFSETS = [72, 104];
// protocol_fees, fund_fees and creator_fees of each token: owed out of its vault, so not part of the reserve.
const OWED_FEE_OFFSETS = [
  [341, 357, 397],
  [349, 365, 405],
];
const TOKEN_AMOUNT_OFFSET = 64;
const U64_MAX = (BigInt(1) << BigInt(64)) - BigInt(1);
const SCALE = 1e12;

type ProgramAccount = { owner: string; data: Uint8Array };

const view = ({ data }: ProgramAccount) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** The two vault addresses of a CPMM pool, after checking the account is one. */
export function cpmmVaults(pool: string, account: ProgramAccount): string[] {
  if (account.owner !== RAYDIUM_CPMM_PROGRAM_ID)
    throw new Error(`${pool} is owned by ${account.owner}, not the CPMM program`);
  if (account.data.length !== POOL_STATE_LEN)
    throw new Error(`${pool} is ${account.data.length} bytes, not a CPMM PoolState`);
  if (POOL_STATE_DISCRIMINATOR.some((byte, i) => account.data[i] !== byte))
    throw new Error(`${pool} is not a PoolState`);
  return VAULT_OFFSETS.map((offset) => getAddressDecoder().decode(account.data.subarray(offset, offset + 32)));
}

/**
 * A swap prices off each vault minus the fees the pool still owes out of it. Moving the reserves to
 * x / sqrt(f) and y * sqrt(f) keeps x * y and multiplies token 0's price by f, as an arbitrage would.
 */
export function cpmmVaultAmountsAfterShock(
  pool: ProgramAccount,
  vaults: (ProgramAccount | null)[],
  vaultAddresses: string[],
  priceFactor: number
): bigint[] {
  validatePriceFactor(priceFactor);
  const sqrtFactor = BigInt(Math.round(Math.sqrt(priceFactor) * SCALE));
  if (sqrtFactor === BigInt(0)) throw new Error(`price factor ${priceFactor} is too small`);

  return vaultAddresses.map((vaultAddress, side) => {
    const vault = vaults[side];
    if (!vault || vault.data.length < TOKEN_AMOUNT_OFFSET + 8) throw new Error(`vault ${vaultAddress} was not found`);
    const amount = view(vault).getBigUint64(TOKEN_AMOUNT_OFFSET, true);
    const owed = OWED_FEE_OFFSETS[side].reduce((sum, offset) => sum + view(pool).getBigUint64(offset, true), BigInt(0));
    if (amount <= owed) throw new Error(`vault ${vaultAddress} holds no reserve beyond the fees the pool owes`);

    const reserve = amount - owed;
    const shocked = side === 0 ? (reserve * BigInt(SCALE)) / sqrtFactor : (reserve * sqrtFactor) / BigInt(SCALE);
    if (shocked === BigInt(0)) throw new Error(`price factor ${priceFactor} empties vault ${vaultAddress}`);
    if (shocked + owed > U64_MAX) throw new Error(`price factor ${priceFactor} overflows vault ${vaultAddress}`);
    return shocked + owed;
  });
}

export function buildCpmmPriceShockScenario(pool: string, priceFactor: number, vaults: string[], amounts: bigint[]) {
  return {
    id: crypto.randomUUID(),
    name: 'Raydium CPMM Price Shock',
    description: `Move Raydium CPMM pool ${pool} to ${priceFactor}x its price by rebalancing both vaults along x * y = k.`,
    overrides: vaults.map((vault, side) => ({
      id: crypto.randomUUID(),
      templateId: 'spl-token-account-balance',
      values: { amount: new LosslessNumber(amounts[side].toString()) },
      scenarioRelativeSlot: 1,
      label: `CPMM token ${side} vault, price x${priceFactor}`,
      enabled: true,
      fetchBeforeUse: true,
      account: { pubkey: vault },
    })),
    tags: ['raydium', 'cpmm', 'price-shock'],
  };
}
