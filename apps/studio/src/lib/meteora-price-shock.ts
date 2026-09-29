import { address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
export const METEORA_POOL_STATE_TEMPLATE_ID = 'meteora-dlmm-pool-state';

export const LB_PAIR_LEN = 904;
export const LB_PAIR_DISCRIMINATOR = [0x21, 0x0b, 0x31, 0x62, 0xb5, 0x65, 0xb1, 0x0d];
export const ACTIVE_ID_OFFSET = 76;
export const BIN_STEP_OFFSET = 80;

export const BIN_ARRAY_LEN = 10136;
export const BIN_ARRAY_DISCRIMINATOR = [0x5c, 0x8e, 0x5c, 0xdc, 0x05, 0x94, 0x46, 0xb5];
const BINS_PER_ARRAY = 70;
const BINS_OFFSET = 56;
const BIN_LEN = 144;

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

export type MeteoraAccount = { owner: string; data: Uint8Array };

type MeteoraPriceShockPlan = Awaited<ReturnType<typeof planMeteoraPriceShock>>;

const hasPrefix = (data: Uint8Array, prefix: number[]) => prefix.every((byte, index) => data[index] === byte);

const binArrayIndex = (activeId: number) => Math.floor(activeId / BINS_PER_ARRAY);

export function validatePriceFactor(priceFactor: number) {
  if (!Number.isFinite(priceFactor)) throw new Error('price factor must be a finite number');
  if (priceFactor <= 0) throw new Error('price factor must be greater than zero');
  if (priceFactor === 1) throw new Error('price factor of 1 would leave the pool unchanged');
}

function activeIdDelta(priceFactor: number, binStep: number): number {
  const ratio = Math.log(priceFactor) / Math.log(1 + binStep / 10000);
  // Rust's f64::round takes halves away from zero; Math.round takes them towards +infinity.
  const delta = Math.sign(ratio) * Math.round(Math.abs(ratio));
  if (!Number.isFinite(delta) || delta < I32_MIN || delta > I32_MAX) {
    throw new Error(`price factor moves the active bin by ${delta}, outside what an i32 bin id can hold`);
  }
  return delta;
}

async function binArrayAddress(pool: string, index: number): Promise<string> {
  const indexBytes = new Uint8Array(8);
  new DataView(indexBytes.buffer).setBigInt64(0, BigInt(index), true);
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(METEORA_DLMM_PROGRAM_ID),
    seeds: ['bin_array', getAddressEncoder().encode(address(pool)), indexBytes],
  });
  return pda;
}

export async function planMeteoraPriceShock(pool: string, account: MeteoraAccount, priceFactor: number) {
  validatePriceFactor(priceFactor);
  const { owner, data } = account;
  if (owner !== METEORA_DLMM_PROGRAM_ID) {
    throw new Error(`${pool} is owned by ${owner}, not the Meteora DLMM program ${METEORA_DLMM_PROGRAM_ID}`);
  }
  if (data.length !== LB_PAIR_LEN) {
    throw new Error(`${pool} is ${data.length} bytes, not the ${LB_PAIR_LEN} bytes of an LbPair`);
  }
  if (!hasPrefix(data, LB_PAIR_DISCRIMINATOR)) throw new Error('account does not carry the LbPair discriminator');

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const binStep = view.getUint16(BIN_STEP_OFFSET, true);
  if (binStep === 0) throw new Error('pool declares a bin step of zero');
  const oldActiveId = view.getInt32(ACTIVE_ID_OFFSET, true);

  const delta = activeIdDelta(priceFactor, binStep);
  if (delta === 0) {
    const oneBin = 1 + binStep / 10000;
    throw new Error(
      `price factor ${priceFactor} moves the price by less than half a bin, so the active bin would not change. ` +
        `With a bin step of ${binStep / 100}%, use at least ${Math.sqrt(oneBin).toFixed(6)} or at most ${(1 / Math.sqrt(oneBin)).toFixed(6)}.`
    );
  }
  const newActiveId = oldActiveId + delta;
  if (newActiveId < I32_MIN || newActiveId > I32_MAX) throw new Error('shocked active bin id overflows an i32');
  const index = binArrayIndex(newActiveId);
  const binArray = await binArrayAddress(pool, index);

  return { pool, priceFactor, binStep, oldActiveId, newActiveId, binArray, binArrayIndex: index };
}

export function assertBinArray(plan: MeteoraPriceShockPlan, binArrayAccount: MeteoraAccount | null) {
  const { binArray, binArrayIndex: index, binStep, newActiveId, oldActiveId, priceFactor } = plan;
  if (!binArrayAccount) {
    const start = binArrayIndex(oldActiveId) * BINS_PER_ARRAY;
    const end = start + BINS_PER_ARRAY - 1;
    const [bound, adjective] = priceFactor > 1 ? [end, 'largest'] : [start, 'smallest'];
    const missing = `bin array ${binArray} (index ${index}) does not exist, so a swap could not resume from bin ${newActiveId}.`;
    if (bound === oldActiveId) {
      throw new Error(`${missing} The pool already sits on the edge of its current bin array [${start}, ${end}].`);
    }
    const safeFactor = ((1 + binStep / 10000) ** (bound - oldActiveId)).toFixed(6);
    throw new Error(`${missing} The ${adjective} factor that stays on the pool's current bin array [${start}, ${end}] is ${safeFactor}.`);
  }
  const { owner, data } = binArrayAccount;
  if (owner !== METEORA_DLMM_PROGRAM_ID) {
    throw new Error(`bin array ${binArray} is owned by ${owner}, not the Meteora DLMM program`);
  }
  if (data.length !== BIN_ARRAY_LEN) {
    throw new Error(`bin array ${binArray} is ${data.length} bytes, not the ${BIN_ARRAY_LEN} bytes of a BinArray`);
  }
  if (!hasPrefix(data, BIN_ARRAY_DISCRIMINATOR)) {
    throw new Error(`bin array ${binArray} does not carry the BinArray discriminator`);
  }
  // A rise is felt by buys, which take token X out of the new bin; a drop by sells, which take Y.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const binOffset = BINS_OFFSET + (newActiveId - index * BINS_PER_ARRAY) * BIN_LEN;
  const [amount, token, side] =
    priceFactor > 1 ? [view.getBigUint64(binOffset, true), 'X', 'buy'] : [view.getBigUint64(binOffset + 8, true), 'Y', 'sell'];
  if (amount === BigInt(0)) {
    throw new Error(`bin ${newActiveId} holds no token ${token}, so a ${side} could not fill at the shocked price.`);
  }
}

export function buildMeteoraPriceShockScenario(plan: MeteoraPriceShockPlan, templateId: string) {
  return {
    id: crypto.randomUUID(),
    name: 'Meteora DLMM Price Shock',
    // Only active_id moves, so the skipped bins keep the token they held: after a rise buys fill at
    // the new price while sells fall back to the old one, and the reverse after a drop.
    description: `Move Meteora DLMM pool ${plan.pool} to ${plan.priceFactor}x its price, onto bin ${plan.newActiveId} of the bin array at index ${plan.binArrayIndex}. ${plan.priceFactor > 1 ? 'Buys' : 'Sells'} of the base token see the new price; ${plan.priceFactor > 1 ? 'sells' : 'buys'} still fill at the old one.`,
    overrides: [
      {
        id: crypto.randomUUID(),
        templateId,
        values: { active_id: plan.newActiveId },
        scenarioRelativeSlot: 1,
        label: `DLMM price x${plan.priceFactor}`,
        enabled: true,
        fetchBeforeUse: true,
        account: { pubkey: plan.pool },
      },
    ],
    tags: ['meteora', 'dlmm', 'price-shock'],
  };
}
