import { getAddressDecoder, getBase58Decoder, getBase64Encoder } from '@solana/kit';
import { truncateAddress } from './address-utils';
import { serializeScenarioJson } from './scenarios-api';

export type MarketMoveMarket = {
  label: string;
  /** The address the market is listed and typed by. */
  value: string;
  /** The account the override writes: the one the protocol reads its price from. */
  account: string;
};

export type MarketMoveOverride = {
  templateId: string;
  label: string;
  account: { pubkey: string };
  values: Record<string, unknown>;
};

/** A price move as the exact fraction numerator / denominator of the current price. */
export type MarketMove = { label: string; numerator: bigint; denominator: bigint };

export type TokenSymbols = Map<string, string>;

export type MarketMoveAdapter = {
  protocol: string;
  label: string;
  /** Template the surfnet must serve for this adapter to be offered. */
  templateId: string;
  fetchBeforeUse: boolean;
  listMarkets: (rpcUrl: string, symbols: TokenSymbols) => Promise<MarketMoveMarket[]>;
  /** Reads a typed address the list does not offer, refusing one that is not a market. */
  readMarket: (rpcUrl: string, address: string, symbols: TokenSymbols) => Promise<MarketMoveMarket>;
  buildOverrides: (rpcUrl: string, market: MarketMoveMarket, move: MarketMove) => Promise<MarketMoveOverride[]>;
};

export type ServedTemplate = {
  id: string;
  constants?: Record<string, { options?: { value: string; metadata?: Record<string, unknown> }[] }>;
};

export type RpcAccount = { owner: string; data: Uint8Array };

export type AccountKind = { name: string; owner: string; discriminator: number[]; minLength: number };

type Slice = { offset: number; length: number };
type Encoded = { owner: string; data: [string, string] };

const ZERO = BigInt(0);
const MOVE_PATTERN = /^([+-]?)(\d+)(?:\.(\d{1,4}))?$/;
const U64_MAX = BigInt('18446744073709551615');
export const I64_MAX = BigInt('9223372036854775807');
export const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111';

/** Parses a move in percent, negative for down. 0 and anything at or below -100% are refused. */
export function parseMarketMove(text: string): MarketMove | null {
  const match = MOVE_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const denominator = BigInt(100) * BigInt(10) ** BigInt(fraction.length);
  const delta = BigInt(`${sign === '-' ? '-' : ''}${whole}${fraction}`);
  const numerator = denominator + delta;
  if (delta === ZERO || numerator <= ZERO) return null;
  const percent = `${BigInt(whole)}${fraction ? `.${fraction}` : ''}`;
  return { label: `${delta < ZERO ? '-' : '+'}${percent}%`, numerator, denominator };
}

/** The value moved by the percentage and rounded half up, refused when it falls to zero or passes `max`. */
export function moveValue(value: bigint, move: MarketMove, max = U64_MAX): bigint {
  const moved = (value * move.numerator + move.denominator / BigInt(2)) / move.denominator;
  if (moved <= ZERO || moved > max) throw new Error(`A ${move.label} move takes ${value} out of range`);
  return moved;
}

/** Mint symbols from the token catalogs the served templates already carry. */
export function knownTokenSymbols(templates: ServedTemplate[]): TokenSymbols {
  const symbols: TokenSymbols = new Map();
  for (const { constants } of templates) {
    for (const { options = [] } of Object.values(constants ?? {})) {
      for (const { value, metadata } of options) {
        if (typeof metadata?.symbol === 'string') symbols.set(value, metadata.symbol);
      }
    }
  }
  return symbols;
}

export const tokenSymbol = (mint: string, symbols: TokenSymbols) => symbols.get(mint) ?? truncateAddress(mint);

export const pubkeyAt = (data: Uint8Array, offset: number) =>
  getAddressDecoder().decode(data.subarray(offset, offset + 32));

export const dataView = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

const decodeBase64 = (data: string) => new Uint8Array(getBase64Encoder().encode(data));

async function post(url: string, body: string) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!response.ok) throw new Error((await response.text()) || `${url} answered ${response.status}`);
  return response.json();
}

async function rpcResult<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const body = await post(rpcUrl, JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
  if (body.error) throw new Error(body.error.message ?? `${method} failed`);
  return body.result as T;
}

/** Reads through the surfnet, which also loads an account it does not hold yet into the local VM. */
export async function readAccounts(rpcUrl: string, addresses: string[], dataSlice?: Slice) {
  const params = [addresses, { encoding: 'base64', dataSlice }];
  const { value } = await rpcResult<{ value: (Encoded | null)[] }>(rpcUrl, 'getMultipleAccounts', params);
  return value.map((account): RpcAccount | null => account && { ...account, data: decodeBase64(account.data[0]) });
}

export async function readProgramAccounts(rpcUrl: string, kind: AccountKind, dataSlice: Slice) {
  const filters = [{ memcmp: { offset: 0, bytes: getBase58Decoder().decode(Uint8Array.from(kind.discriminator)) } }];
  const params = [kind.owner, { encoding: 'base64', dataSlice, filters }];
  const accounts = await rpcResult<{ pubkey: string; account: Encoded }[]>(rpcUrl, 'getProgramAccounts', params);
  return accounts.map(({ pubkey, account }) => ({ address: pubkey, data: decodeBase64(account.data[0]) }));
}

export function expectAccount(account: RpcAccount | null, address: string, kind: AccountKind): Uint8Array {
  const data = account?.owner === kind.owner && account.data.length >= kind.minLength ? account.data : null;
  if (!data || kind.discriminator.some((byte, index) => data[index] !== byte)) {
    throw new Error(`${address} is not a ${kind.name} account`);
  }
  return data;
}

/** Reads an account together with the Clock sysvar, the time and slot programs see as now. */
export async function readWithClock(rpcUrl: string, address: string) {
  const [account, clock] = await readAccounts(rpcUrl, [address, CLOCK_SYSVAR]);
  if (!clock || clock.data.length < 40) throw new Error('The surfnet returned no Clock sysvar');
  const view = dataView(clock.data);
  return { account, slot: view.getBigUint64(0, true), unixTimestamp: view.getBigInt64(32, true) };
}

export async function fetchServedTemplates(studioUrl: string): Promise<ServedTemplate[]> {
  const response = await fetch(`${studioUrl}/v1/scenarios/templates`);
  if (!response.ok) throw new Error(`Failed to load scenario templates: ${response.status}`);
  return response.json();
}

export type MarketMoveScenario = ReturnType<typeof buildMarketMoveScenario>;

export function buildMarketMoveScenario(
  adapter: MarketMoveAdapter,
  market: MarketMoveMarket,
  move: MarketMove,
  overrides: MarketMoveOverride[]
) {
  return {
    id: crypto.randomUUID(),
    name: `${adapter.label} ${market.label} move ${move.label}`,
    description: `Move the ${adapter.label} ${market.label} price by ${move.label}. No trade is sent.`,
    overrides: overrides.map((override) => ({
      id: crypto.randomUUID(),
      ...override,
      scenarioRelativeSlot: 0,
      enabled: true,
      fetchBeforeUse: adapter.fetchBeforeUse,
    })),
    tags: [adapter.protocol, 'market-move'],
  };
}

export async function createMarketMoveScenario(
  studioUrl: string,
  scenario: MarketMoveScenario
): Promise<{ id: string }> {
  const result = await post(`${studioUrl}/v1/scenarios`, serializeScenarioJson(scenario));
  if (!result.id) throw new Error('Surfpool returned no scenario id');
  return { id: result.id };
}
