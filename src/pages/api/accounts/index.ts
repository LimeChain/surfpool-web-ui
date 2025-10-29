import type { NextApiRequest, NextApiResponse } from 'next';

export type Account = {
  id: string;
  address?: string;
  name?: string;
  balance?: string | number;
  token_mint?: string;
  metadata?: Record<string, any>;
  source?: string;
};

export type AccountsResponse = {
  indexed_accounts: Account[];
  indexed_token_accounts: Account[];
  streamed_accounts: Account[];
  accounts?: Account[];
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse<AccountsResponse>) {
  try {
    // Fetch streamed accounts from RPC
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8899';

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'surfnet_getStreamedAccounts',
      }),
    });

    let streamedAccounts: Account[] = [];

    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      if (rpcData.result?.value?.accounts && Array.isArray(rpcData.result.value.accounts)) {
        // Fetch full account info for each streamed account
        const accountInfoPromises = rpcData.result.value.accounts.map(async (account: any) => {
          try {
            const infoResponse = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAccountInfo',
                params: [
                  account.pubkey,
                  {
                    commitment: 'confirmed',
                    encoding: 'jsonParsed'
                  }
                ],
              }),
            });

            if (infoResponse.ok) {
              const infoData = await infoResponse.json();
              if (infoData.result?.value) {
                const accountInfo = infoData.result.value;
                const lamports = accountInfo.lamports || 0;

                // Get data size from space field (jsonParsed provides this)
                let dataSize = 0;
                if (accountInfo.space !== undefined) {
                  dataSize = accountInfo.space;
                } else if (accountInfo.data && Array.isArray(accountInfo.data) && accountInfo.data[0]) {
                  dataSize = Buffer.from(accountInfo.data[0], 'base64').length;
                }

                return {
                  id: account.pubkey,
                  address: account.pubkey,
                  name: account.pubkey,
                  balance: (lamports / 1e9).toFixed(9),
                  source: 'streamed',
                  metadata: {
                    includeOwnedAccounts: account.includeOwnedAccounts,
                    dataSize,
                    executable: accountInfo.executable,
                    owner: accountInfo.owner,
                    rentEpoch: accountInfo.rentEpoch,
                  },
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching info for ${account.pubkey}:`, error);
          }

          // Fallback if fetch fails
          return {
            id: account.pubkey,
            address: account.pubkey,
            name: account.pubkey,
            balance: undefined,
            source: 'streamed',
            metadata: {
              includeOwnedAccounts: account.includeOwnedAccounts,
            },
          };
        });

        streamedAccounts = await Promise.all(accountInfoPromises);
      }
    }

    const response: AccountsResponse = {
      indexed_accounts: [],
      indexed_token_accounts: [],
      streamed_accounts: streamedAccounts,
      accounts: streamedAccounts,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    // Return empty arrays on error
    res.status(200).json({
      indexed_accounts: [],
      indexed_token_accounts: [],
      streamed_accounts: [],
      accounts: [],
    });
  }
}
