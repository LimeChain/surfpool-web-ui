'use client';

import { Badge } from '@/components/catalyst/badge';
import { Link } from '@/components/catalyst/link';
import { Navbar, NavbarItem, NavbarSection } from '@/components/catalyst/navbar';
import { Switch } from '@/components/catalyst/switch';
import { useAppConfig } from '@/hooks/use-app-config';
import { ArrowTopRightOnSquareIcon, CheckIcon, ClipboardIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import CollapsibleSearch from './collapsible-search';
import IndexingGrid from './indexing-grid';

const GraphQLExplorer = dynamic(() => import('@/app/accounts/graphql-explorer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-white dark:bg-zinc-900">
      <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading GraphQL Explorer...</div>
    </div>
  ),
});

type Account = {
  id: string;
  address?: string;
  name?: string;
  balance?: string | number;
  token_mint?: string;
  metadata?: Record<string, any>;
  source?: 'indexed' | 'indexed_token' | 'streamed' | string;
};

type Collection = {
  name: string;
  description?: string;
  count: number;
  lastIndexed?: string | undefined;
  ingestRate?: number | undefined; // items per minute (optional)
};

export default function AccountsBento(): JSX.Element {
  const { config } = useAppConfig();
  const graphqlUrl =
    config?.graphql_query_route_url || (config?.studio_url ? `${config.studio_url}/gql/v1/graphql` : '');

  const [indexedAccounts, setIndexedAccounts] = useState<Account[]>([]);
  const [indexedTokenAccounts, setIndexedTokenAccounts] = useState<Account[]>([]);
  const [streamedAccounts, setStreamedAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionTab, setCollectionTab] = useState<'overview' | 'query'>('overview');
  const [isCollectionExpanded, setIsCollectionExpanded] = useState(false);
  const [indexers, setIndexers] = useState<any[]>([]);
  const [searchResultAccount, setSearchResultAccount] = useState<Account | null>(null);
  const [fetchingSearch, setFetchingSearch] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [streamedAccountIds, setStreamedAccountIds] = useState<Set<string>>(new Set());

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';
        const workspaceUrl = config?.studio_url || 'http://127.0.0.1:18488';

        // Fetch streamed accounts from RPC
        let streamedAccounts: Account[] = [];
        try {
          const rpcResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'surfnet_getStreamedAccounts',
            }),
          });

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
                          encoding: 'jsonParsed',
                        },
                      ],
                    }),
                  });

                  if (infoResponse.ok) {
                    const infoData = await infoResponse.json();
                    if (infoData.result?.value) {
                      const accountInfo = infoData.result.value;
                      const lamports = accountInfo.lamports || 0;

                      // Get data size from space field
                      let dataSize = 0;
                      if (accountInfo.space !== undefined) {
                        dataSize = accountInfo.space;
                      } else if (accountInfo.data && Array.isArray(accountInfo.data) && accountInfo.data[0]) {
                        // Calculate from base64 length
                        dataSize = Math.floor((accountInfo.data[0].length * 3) / 4);
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
        } catch (err) {
          console.error('Error fetching streamed accounts:', err);
        }

        setIndexedAccounts([]);
        setIndexedTokenAccounts([]);
        setStreamedAccounts(streamedAccounts);

        // Fetch indexers from workspace API
        try {
          const indexersRes = await fetch(`${workspaceUrl}/workspace/v1/indexers`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (indexersRes.ok) {
            const indexersData = await indexersRes.json();
            setIndexers(Array.isArray(indexersData) ? indexersData : []);
          }
        } catch (err) {
          console.error('Error fetching indexers:', err);
        }
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [config]);

  // Initialize streamed accounts set
  useEffect(() => {
    const streamedIds = new Set(streamedAccounts.map((a) => a.address || a.id));
    setStreamedAccountIds(streamedIds);
  }, [streamedAccounts]);

  const query = searchQuery.trim().toLowerCase();

  const filterFn = (a: Account) => {
    if (!query) return true;
    const name = String(a.name || '').toLowerCase();
    const address = String(a.address || a.id || '').toLowerCase();
    const mint = String(a.token_mint || '').toLowerCase();
    return name.includes(query) || address.includes(query) || mint.includes(query);
  };

  const filteredIndexed = useMemo(() => indexedAccounts.filter(filterFn), [indexedAccounts, query]);
  const filteredIndexedToken = useMemo(() => indexedTokenAccounts.filter(filterFn), [indexedTokenAccounts, query]);
  const filteredStreamed = useMemo(() => streamedAccounts.filter(filterFn), [streamedAccounts, query]);

  const filteredIndexedCombined = useMemo(
    () => [...filteredIndexed, ...filteredIndexedToken],
    [filteredIndexed, filteredIndexedToken]
  );

  // Build collections from indexers
  const collections = useMemo<Collection[]>(() => {
    if (indexers.length === 0) {
      // Return empty array to show empty state
      return [];
    }

    return indexers.map((indexer) => ({
      name: indexer.name || 'Unnamed Indexer',
      description: indexer.description || undefined,
      count: Math.floor(Math.random() * 100), // TODO: Replace with actual row count from table
      lastIndexed: undefined, // TODO: Add if available
      ingestRate: undefined, // TODO: Add if available
    }));
  }, [indexers]);

  const totalIndexedCount = useMemo(() => collections.reduce((s, c) => s + c.count, 0), [collections]);

  const EMPTY_VIDEO_URL = 'https://www.youtube.com/watch?v=obDiHVQggYk&list=PL0FMgRjJMRzO1FdunpMS-aUS4GNkgyr3T&index=9';

  const formatBalance = (b?: string | number) => (b === undefined || b === null ? '—' : String(b));

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleStreamAccount = async (accountAddress: string) => {
    if (streamedAccountIds.has(accountAddress)) {
      // Already streamed, don't allow disabling
      return;
    }

    try {
      const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 123,
          method: 'surfnet_streamAccount',
          params: [accountAddress],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Stream account response:', data);

        // Add to streamed accounts set
        setStreamedAccountIds((prev) => new Set(prev).add(accountAddress));

        // Refresh the accounts list to show the newly streamed account
        const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';
        const rpcResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'surfnet_getStreamedAccounts',
          }),
        });

        if (rpcResponse.ok) {
          const rpcData = await rpcResponse.json();
          if (rpcData.result?.value?.accounts && Array.isArray(rpcData.result.value.accounts)) {
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
                        encoding: 'jsonParsed',
                      },
                    ],
                  }),
                });

                if (infoResponse.ok) {
                  const infoData = await infoResponse.json();
                  if (infoData.result?.value) {
                    const accountInfo = infoData.result.value;
                    const lamports = accountInfo.lamports || 0;

                    let dataSize = 0;
                    if (accountInfo.space !== undefined) {
                      dataSize = accountInfo.space;
                    } else if (accountInfo.data && Array.isArray(accountInfo.data) && accountInfo.data[0]) {
                      dataSize = Math.floor((accountInfo.data[0].length * 3) / 4);
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

            const sa = await Promise.all(accountInfoPromises);
            setStreamedAccounts(sa);
          }
        }
      } else {
        console.error('Failed to stream account:', response.status);
      }
    } catch (error) {
      console.error('Error streaming account:', error);
    }
  };

  const handleResetAccount = async (accountAddress: string) => {
    try {
      const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 123,
          method: 'surfnet_resetAccount',
          params: [accountAddress],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Reset account response:', data);

        // Remove from search results and close detail pane
        setSearchResultAccount(null);
        setSelectedAccount(null);
      } else {
        console.error('Failed to reset account:', response.status);
      }
    } catch (error) {
      console.error('Error resetting account:', error);
    }
  };

  const handleRefreshAccount = async (accountAddress: string) => {
    try {
      const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';

      // First reset the account
      const resetResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 123,
          method: 'surfnet_resetAccount',
          params: [accountAddress],
        }),
      });

      if (!resetResponse.ok) {
        console.error('Failed to reset account:', resetResponse.status);
        return;
      }

      console.log('Reset account response:', await resetResponse.json());

      // Then fetch fresh account info
      const infoResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            accountAddress,
            {
              commitment: 'confirmed',
              encoding: 'jsonParsed',
            },
          ],
        }),
      });

      if (infoResponse.ok) {
        const data = await infoResponse.json();
        console.log('Refreshed account info:', data);

        if (data.result?.value) {
          const accountInfo = data.result.value;
          const lamports = accountInfo.lamports || 0;

          let dataSize = 0;
          if (accountInfo.space !== undefined) {
            dataSize = accountInfo.space;
          } else if (accountInfo.data) {
            if (Array.isArray(accountInfo.data) && accountInfo.data[0]) {
              dataSize = Math.floor((accountInfo.data[0].length * 3) / 4);
            } else if (typeof accountInfo.data === 'object' && accountInfo.data.parsed) {
              dataSize = accountInfo.data.space || 0;
            }
          }

          const accountResult = {
            id: accountAddress,
            address: accountAddress,
            name: accountAddress,
            balance: (lamports / 1e9).toFixed(9),
            source: 'search',
            metadata: {
              dataSize,
              executable: accountInfo.executable,
              owner: accountInfo.owner,
              rentEpoch: accountInfo.rentEpoch,
            },
          };

          setSearchResultAccount(accountResult);
          setSelectedAccount(accountResult);
        }
      }
    } catch (error) {
      console.error('Error refreshing account:', error);
    }
  };

  // Collection tile: similar to network card
  const renderCollectionCard = (c: Collection, onClick?: () => void) => {
    const isActive = c.count > 0;
    return (
      <div key={c.name} className="group relative h-full cursor-pointer" onClick={onClick}>
        {/* Background layer with hover effect */}
        <div className="absolute inset-0 rounded-2xl bg-zinc-50 transition-colors duration-200 group-hover:bg-zinc-100 dark:bg-zinc-900 dark:group-hover:bg-zinc-800" />

        {/* Content layer */}
        <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.2xl)+1px)] border border-zinc-200/40 transition-colors duration-200 group-hover:border-zinc-300/60 dark:border-zinc-700/30 dark:group-hover:border-zinc-600/50">
          {/* Header Section */}
          <div className="p-6 pb-4">
            <div className="mb-3">
              <h3 className="text-md truncate font-semibold text-zinc-950 dark:text-zinc-50">{c.name}</h3>
            </div>
            {c.description && <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">{c.description}</p>}
          </div>

          {/* Indexing Grid Section */}
          <div className="px-6 pb-4">
            <IndexingGrid isActive={isActive} accountCount={c.count} />
          </div>

          {/* Footer Section */}
          <div className="mt-auto border-t border-zinc-200/40 bg-zinc-100/50 px-6 py-4 dark:border-zinc-700/30 dark:bg-zinc-950/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                {c.lastIndexed ? `Updated ${c.lastIndexed}` : 'Collection data'}
              </span>
              {isActive ? <Badge color="emerald">Active</Badge> : <Badge color="zinc">Empty</Badge>}
            </div>
          </div>
        </div>

        {/* Shadow layer with ring effects */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-lg ring-1 shadow-zinc-950/[0.03] ring-zinc-950/5 transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-zinc-950/[0.05] dark:shadow-zinc-950/50 dark:ring-zinc-50/10 dark:group-hover:shadow-zinc-950/70" />
      </div>
    );
  };

  const renderAccountCard = (a: Account) => {
    const dataSize = a.metadata?.dataSize;
    const solBalance = a.balance !== undefined && a.balance !== null ? parseFloat(String(a.balance)) : null;
    const isStreamed = a.source === 'streamed';
    const isCached = a.source === 'search';

    return (
      <div
        key={a.id}
        className="group relative h-full cursor-pointer"
        onClick={() => {
          setSelectedAccount(a);
          setSelectedCollection(null);
        }}
      >
        {/* Background layer with hover effect */}
        <div className="absolute inset-0 rounded-2xl bg-zinc-50 transition-colors duration-200 group-hover:bg-zinc-100 dark:bg-zinc-900 dark:group-hover:bg-zinc-800" />

        {/* Content layer */}
        <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.2xl)+1px)] border border-zinc-200/40 transition-colors duration-200 group-hover:border-zinc-300/60 dark:border-zinc-700/30 dark:group-hover:border-zinc-600/50">
          {/* Main content */}
          <div className="p-6 pb-4">
            <div className="mb-3">
              <h3 className="font-mono text-sm font-semibold break-all text-zinc-950 dark:text-zinc-50">
                {a.address || a.name || a.id}
              </h3>
            </div>

            {/* Show data size only for cached accounts */}
            {isCached && dataSize !== undefined && (
              <div className="mt-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Data Size</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {dataSize.toLocaleString()} bytes
                </div>
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className="mt-auto border-t border-zinc-200/40 bg-zinc-100/50 px-6 py-4 dark:border-zinc-700/30 dark:bg-zinc-950/50">
            <div className="flex items-center justify-between">
              {isCached && solBalance !== null ? (
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Balance</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {solBalance.toFixed(4)} SOL
                  </div>
                </div>
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : 'Account data'}
                </span>
              )}
              <div>
                {a.source === 'indexed' && <Badge color="zinc">Indexed PDA</Badge>}
                {a.source === 'indexed_token' && <Badge color="emerald">Indexed ATA</Badge>}
                {isStreamed && <Badge color="pink">Streamed</Badge>}
                {isCached && <Badge color="purple">Cached</Badge>}
              </div>
            </div>
          </div>
        </div>

        {/* Shadow layer with ring effects */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-lg ring-1 shadow-zinc-950/[0.03] ring-zinc-950/5 transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-zinc-950/[0.05] dark:shadow-zinc-950/50 dark:ring-zinc-50/10 dark:group-hover:shadow-zinc-950/70" />
      </div>
    );
  };

  // Get accounts belonging to a collection
  const getCollectionAccounts = (collectionName: string): Account[] => {
    return filteredIndexedCombined.filter((a) => {
      const meta = a.metadata || {};
      const key = meta.collection || (a.token_mint ? 'Token Accounts' : undefined);
      if (key) return String(key) === collectionName;
      const name = String(a.name || '').toLowerCase();
      if (collectionName.toLowerCase() === 'vaults' && name.includes('vault')) return true;
      return collectionName === 'Accounts';
    });
  };

  // Reset collection selection when user types search
  useEffect(() => {
    if (query) setSelectedCollection(null);
  }, [query]);

  // Close detail pane on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAccount(null);
        setSelectedCollection(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch account data when a valid pubkey is entered
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    // Check if it looks like a valid Solana pubkey (base58, 32-44 chars)
    const isPubkey = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedQuery);

    if (!isPubkey) {
      setSearchResultAccount(null);
      return;
    }

    const fetchAccountData = async () => {
      setFetchingSearch(true);
      try {
        const rpcUrl = config?.rpc_url || 'http://127.0.0.1:8899';

        console.log('Fetching account info for:', trimmedQuery);

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [
              trimmedQuery,
              {
                commitment: 'confirmed',
                encoding: 'jsonParsed',
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('RPC response:', data);

          if (data.result?.value) {
            const accountInfo = data.result.value;
            const lamports = accountInfo.lamports || 0;

            // Get data size from the space field (jsonParsed provides this directly)
            let dataSize = 0;
            if (accountInfo.space !== undefined) {
              dataSize = accountInfo.space;
            } else if (accountInfo.data) {
              // Fallback: if data is an array [base64, encoding], calculate from base64
              if (Array.isArray(accountInfo.data) && accountInfo.data[0]) {
                dataSize = Math.floor((accountInfo.data[0].length * 3) / 4);
              } else if (typeof accountInfo.data === 'object' && accountInfo.data.parsed) {
                // jsonParsed format - might have space info
                dataSize = accountInfo.data.space || 0;
              }
            }

            const accountResult = {
              id: trimmedQuery,
              address: trimmedQuery,
              name: trimmedQuery,
              balance: (lamports / 1e9).toFixed(9),
              source: 'search',
              metadata: {
                dataSize,
                executable: accountInfo.executable,
                owner: accountInfo.owner,
                rentEpoch: accountInfo.rentEpoch,
              },
            };

            console.log('Setting search result account:', accountResult);
            setSearchResultAccount(accountResult);
          } else {
            console.log('No account found for:', trimmedQuery);
            setSearchResultAccount(null);
          }
        } else {
          console.error('RPC request failed:', response.status);
          setSearchResultAccount(null);
        }
      } catch (error) {
        console.error('Error fetching account:', error);
        setSearchResultAccount(null);
      } finally {
        setFetchingSearch(false);
      }
    };

    const timeoutId = setTimeout(fetchAccountData, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, config]);

  if (!mounted || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[100vh] flex-col lg:h-[calc(100vh-120px)]">
      <div
        className={`overflow-auto ${
          selectedAccount || selectedCollection
            ? isCollectionExpanded && selectedCollection
              ? 'h-[12.5%]'
              : 'h-1/2'
            : 'h-full'
        } transition-all duration-300 ease-in-out`}
      >
        <div className="mx-auto max-w-7xl px-6 pt-4 pb-1 sm:px-6 sm:pt-2 lg:px-8">
          {/* Search */}
          <div className="mb-6">
            <CollapsibleSearch placeholder="Search accounts" value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {/* Search Results Section */}
            {searchQuery.trim() && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Search Result</h2>
                  {fetchingSearch && <span className="text-xs text-zinc-500 dark:text-zinc-400">Loading...</span>}
                </div>
                {searchResultAccount ? (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{renderAccountCard(searchResultAccount)}</div>
                ) : !fetchingSearch ? (
                  <div className="rounded-lg border border-zinc-200/40 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700/30 dark:bg-zinc-900 dark:text-zinc-400">
                    No account found for this pubkey
                  </div>
                ) : null}
              </section>
            )}

            {/* Only show these sections when NOT searching */}
            {!searchQuery.trim() && (
              <>
                <section>
                  <div className="mb-1">
                    <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">IDL-to-SQL Indexers</h2>
                  </div>

                  {collections.length > 0 && (
                    <p className="pt-2 pb-4 text-xs text-zinc-500 dark:text-zinc-400">
                      Surfpool collects IDL data from your project and actively indexes insertions/updates.{' '}
                      <Link href={EMPTY_VIDEO_URL} className="text-[#E034AE]" target="_blank">
                        Watch introduction to data indexing
                      </Link>
                      .
                    </p>
                  )}

                  {collections.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="max-w-md">
                        <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <InformationCircleIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
                        </div>
                        <h3 className="mb-1 text-base font-medium text-zinc-900 dark:text-zinc-50">
                          No indexed accounts yet
                        </h3>
                        <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-400">
                          Indexed accounts from your projects will appear here.
                        </p>
                        <div className="flex items-center justify-center">
                          <a
                            href={EMPTY_VIDEO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                          >
                            Watch Surfpool 101
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {collections.map((c) =>
                        renderCollectionCard(c, () => {
                          setSelectedCollection(c);
                          setSelectedAccount(null);
                          setCollectionTab('overview');
                          setIsCollectionExpanded(false);
                        })
                      )}
                    </div>
                  )}
                </section>

                {streamedAccounts.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Streamed Accounts</h2>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {filteredStreamed.length} accounts
                      </span>
                    </div>

                    {filteredStreamed.length === 0 ? (
                      <div className="rounded-lg border border-zinc-200/40 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700/30 dark:bg-zinc-900 dark:text-zinc-400">
                        No streamed accounts match your search
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {filteredStreamed.map((a) => renderAccountCard(a))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Pane */}
      {selectedAccount && (
        <div className="-mr-5 -ml-5 flex h-1/2 flex-col border-t-2 border-zinc-200 bg-zinc-50 transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-1 items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-base font-semibold break-all text-zinc-950 dark:text-zinc-50">
                    {selectedAccount.address || selectedAccount.name || selectedAccount.id}
                  </h2>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(selectedAccount.address || selectedAccount.id, `detail-${selectedAccount.id}`);
                    }}
                    aria-label="Copy address"
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {copiedStates[`detail-${selectedAccount.id}`] ? (
                      <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <ClipboardIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const explorerUrl = `https://explorer.solana.com/address/${selectedAccount.address || selectedAccount.id}?cluster=custom&customUrl=${encodeURIComponent(config?.rpc_url || 'http://127.0.0.1:8899')}`;
                      window.open(explorerUrl, '_blank');
                    }}
                    aria-label="Open in Solana Explorer"
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="ml-4 flex items-center gap-4">
              {selectedAccount.source === 'search' && (
                <>
                  <button
                    onClick={() => handleRefreshAccount(selectedAccount.address || selectedAccount.id)}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    title="Refresh account"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleResetAccount(selectedAccount.address || selectedAccount.id)}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                    title="Delete cached account"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-600 dark:text-zinc-400">Stream</label>
                <Switch
                  checked={streamedAccountIds.has(selectedAccount.address || selectedAccount.id)}
                  onChange={(checked) => {
                    if (checked) {
                      handleStreamAccount(selectedAccount.address || selectedAccount.id);
                    }
                  }}
                  color="pink"
                  disabled={streamedAccountIds.has(selectedAccount.address || selectedAccount.id)}
                />
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Close details"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="border-b border-zinc-200/40 pl-5 dark:border-zinc-700/30">
            <div className="flex gap-2 px-6">
              <button
                onClick={() => {
                  setSelectedAccount(selectedAccount);
                }}
                className={`px-4 py-3 text-sm ${'overview' === 'overview' ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  /* no-op: details tab kept for parity */
                }}
                className={`px-4 py-3 text-sm ${'details' === 'details' ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}
              >
                Details
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="space-y-6">
                {!streamedAccountIds.has(selectedAccount.address || selectedAccount.id) ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Address / ID
                        </h3>
                        <p className="text-sm text-zinc-950 dark:text-zinc-50">
                          {selectedAccount.address || selectedAccount.id}
                        </p>
                      </div>
                      {selectedAccount.token_mint && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Token Mint
                          </h3>
                          <p className="text-sm text-zinc-950 dark:text-zinc-50">{selectedAccount.token_mint}</p>
                        </div>
                      )}
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Balance
                        </h3>
                        <p className="text-sm text-zinc-950 dark:text-zinc-50">
                          {formatBalance(selectedAccount.balance)}
                        </p>
                        <a
                          href={`https://explorer.solana.com/address/${selectedAccount.address || selectedAccount.id}?cluster=custom&customUrl=${encodeURIComponent(config?.rpc_url || 'http://127.0.0.1:8899')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Display in explorer
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Source
                        </h3>
                        <p className="text-sm text-zinc-950 capitalize dark:text-zinc-50">{selectedAccount.source}</p>
                      </div>
                      {selectedAccount.metadata && Object.keys(selectedAccount.metadata).length > 0 && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Metadata
                          </h3>
                          <div className="space-y-1 text-sm text-zinc-950 dark:text-zinc-50">
                            {Object.entries(selectedAccount.metadata).map(([k, v]) => (
                              <div key={k}>
                                <span className="font-medium">{k}:</span> {String(v)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      This account is being streamed. Balance and metadata are not available.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Detail Pane */}
      {selectedCollection && (
        <div
          className={`${
            isCollectionExpanded ? 'h-[87.5%]' : 'h-1/2'
          } -mr-5 -ml-5 flex flex-col border-t-2 border-zinc-200 bg-zinc-50 transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900`}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-1 items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedCollection.name}
                </h2>
                {selectedCollection.description && (
                  <div className="mt-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{selectedCollection.description}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedCollection.count > 0 ? (
                  <Badge color="emerald">Active</Badge>
                ) : (
                  <Badge color="zinc">Empty</Badge>
                )}
              </div>
            </div>

            <div className="ml-4 flex items-center gap-2">
              <button
                onClick={() => setSelectedCollection(null)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Close details"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="border-b border-zinc-200/40 pl-5 dark:border-zinc-700/30">
            <Navbar>
              <NavbarSection>
                <NavbarItem
                  current={collectionTab === 'overview'}
                  onClick={() => {
                    setCollectionTab('overview');
                    setIsCollectionExpanded(false);
                  }}
                  className="cursor-pointer"
                >
                  Overview
                </NavbarItem>
                <NavbarItem
                  current={collectionTab === 'query'}
                  onClick={() => {
                    setCollectionTab('query');
                    setIsCollectionExpanded(true);
                  }}
                  className="cursor-pointer"
                >
                  Query Editor
                </NavbarItem>
              </NavbarSection>
            </Navbar>
          </div>

          {collectionTab === 'query' ? (
            <div className="h-full flex-1 overflow-hidden">
              <GraphQLExplorer />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      {selectedCollection.description && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Description
                          </h3>
                          <p className="text-sm text-zinc-950 dark:text-zinc-50">{selectedCollection.description}</p>
                        </div>
                      )}
                      {selectedCollection.lastIndexed && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Last Indexed
                          </h3>
                          <p className="text-sm text-zinc-950 dark:text-zinc-50">{selectedCollection.lastIndexed}</p>
                        </div>
                      )}
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          GraphQL URL
                        </h3>
                        <p className="font-mono text-sm break-all text-zinc-900 dark:text-zinc-100">{graphqlUrl}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedCollection.ingestRate !== undefined && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Ingest Rate
                          </h3>
                          <p className="text-sm text-zinc-950 dark:text-zinc-50">
                            {selectedCollection.ingestRate} items/min
                          </p>
                        </div>
                      )}
                      <div>
                        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Status
                        </h3>
                        <p className="text-sm text-zinc-950 capitalize dark:text-zinc-50">
                          {selectedCollection.count > 0 ? 'Active' : 'Empty'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="pb-8">
                    <div className="rounded-lg border border-zinc-200/40 bg-zinc-50/50 p-6 dark:border-zinc-700/30 dark:bg-zinc-800/50">
                      <h3 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                        About Indexing
                      </h3>
                      <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                        <p>
                          Surfpool Studio automatically indexes updates (creation and modifications) made to{' '}
                          <span className="font-medium text-zinc-950 dark:text-zinc-50">
                            Associated Token Accounts (ATA)
                          </span>{' '}
                          and{' '}
                          <span className="font-medium text-zinc-950 dark:text-zinc-50">
                            Program Derived Addresses (PDA)
                          </span>{' '}
                          as transactions are received locally.
                        </p>
                        <p>
                          Deploying these indexers to Mainnet requires minimal effort thanks to our{' '}
                          <span className="font-medium text-zinc-950 dark:text-zinc-50">infrastructure as code</span>{' '}
                          approach. Developers can reproduce this deployment to a scalable serverless infrastructure and
                          access comprehensive dashboards through{' '}
                          <span className="font-medium text-zinc-950 dark:text-zinc-50">Surfpool Cloud</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
