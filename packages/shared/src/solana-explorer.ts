/**
 * Generates a Solana Explorer URL with custom RPC configuration
 * @param rpcUrl - The custom RPC endpoint URL
 * @param path - Optional path (e.g., 'address/...', 'tx/...') - defaults to root
 * @returns The complete explorer URL
 */
export function getSolanaExplorerUrl(rpcUrl: string, path?: string): string {
  const baseUrl = 'https://explorer.solana.com';
  const customUrl = `?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;

  if (path) {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}/${cleanPath}${customUrl}`;
  }

  return `${baseUrl}/${customUrl}`;
}

/**
 * Generates a Solana Explorer URL for a specific address
 * @param address - The Solana address
 * @param rpcUrl - The custom RPC endpoint URL
 * @returns The complete explorer URL for the address
 */
export function getAddressExplorerUrl(address: string, rpcUrl: string): string {
  return getSolanaExplorerUrl(rpcUrl, `address/${address}`);
}

/**
 * Generates a Solana Explorer URL for a specific transaction
 * @param signature - The transaction signature
 * @param rpcUrl - The custom RPC endpoint URL
 * @returns The complete explorer URL for the transaction
 */
export function getTransactionExplorerUrl(signature: string, rpcUrl: string): string {
  return getSolanaExplorerUrl(rpcUrl, `tx/${signature}`);
}
