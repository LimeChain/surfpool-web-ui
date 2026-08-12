import { SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';

export async function fetchSurfnetClockSeconds(rpcUrl: string): Promise<number | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [SYSVAR_CLOCK_PUBKEY.toBase58(), { encoding: 'jsonParsed' }],
      }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const unixTimestamp = Number(data?.result?.value?.data?.parsed?.info?.unixTimestamp);
    return Number.isFinite(unixTimestamp) ? unixTimestamp : null;
  } catch {
    return null;
  }
}
