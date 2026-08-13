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
    const unixTimestamp = data?.result?.value?.data?.parsed?.info?.unixTimestamp;
    return typeof unixTimestamp === 'number' && Number.isFinite(unixTimestamp) ? unixTimestamp : null;
  } catch {
    return null;
  }
}

export function startSurfnetClockPolling(
  rpcUrl: string,
  onUpdate: (seconds: number | null) => void,
  intervalMs = 1000
): () => void {
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const poll = async () => {
    const seconds = await fetchSurfnetClockSeconds(rpcUrl);
    if (stopped) return;

    onUpdate(seconds);
    timeout = setTimeout(poll, intervalMs);
  };

  void poll();

  return () => {
    stopped = true;
    if (timeout !== undefined) clearTimeout(timeout);
  };
}
