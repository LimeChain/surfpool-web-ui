"use client"

import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { Dialog, DialogBody, DialogTitle } from '@/components/catalyst/dialog';
import { useTransactionStream, formatSignature, getTransactionStatus, getTransactionPrograms } from '@/lib/solana-transaction-stream';
import { useAppConfig } from '@/hooks/use-app-config';
import { useState } from 'react';

interface TransactionStreamProps {
  rpcUrl?: string;
  wsUrl?: string;
  maxTransactions?: number;
  autoStart?: boolean;
  filterByProgram?: string;
  filterByAccount?: string;
}

export default function TransactionStream({ 
  rpcUrl: propRpcUrl,
  wsUrl: propWsUrl,
  maxTransactions = 50,
  autoStart = true,
  filterByProgram,
  filterByAccount
}: TransactionStreamProps) {
  const { rpcUrl: configRpcUrl, wsUrl: configWsUrl } = useAppConfig();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionProfile, setTransactionProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // Use props if provided, otherwise use config values
  const rpcUrl = propRpcUrl || configRpcUrl;
  const wsUrl = propWsUrl || configWsUrl;
  const {
    transactions,
    isStreaming,
    error,
    stats,
    toggleStreaming,
    clearTransactions
  } = useTransactionStream({
    rpcUrl,
    wsUrl,
    maxTransactions,
    autoStart,
    filterByProgram,
    filterByAccount
  });

  const fetchTransactionProfile = async (signature: string) => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      setTransactionProfile(null);
      
      console.log('🔍 Fetching transaction profile for signature:', signature);
      
      const requestBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'surfnet_getTransactionProfile',
        params: [signature]
      };
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('📊 Transaction profile response:', data);
      
      if (data.result) {
        setTransactionProfile(data.result);
      } else if (data.error) {
        setProfileError(`RPC Error: ${data.error.message || 'Unknown error'}`);
      } else {
        setProfileError('No result or error in response');
      }
    } catch (error) {
      console.error('❌ Error fetching transaction profile:', error);
      setProfileError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleTransactionClick = (tx: any) => {
    try {
      console.log('🖱️ Transaction clicked:', tx);
      setSelectedTransaction(tx);
      setTransactionDialogOpen(true);
      
      // Fetch transaction profile if we have a signature
      if (tx.transaction?.signatures?.[0]) {
        fetchTransactionProfile(tx.transaction.signatures[0]);
      }
    } catch (error) {
      console.error('❌ Error handling transaction click:', error);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 flex flex-col gap-4">
      <div className="mb-0">
        <h2 className="text-sm font-medium text-white uppercase tracking-wide">Transaction Logs</h2>
      </div>
      
      <div className='rounded-lg'>
        {/* Controls and Stats */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={toggleStreaming}
              color={isStreaming ? 'red' : 'green'}
            >
              {isStreaming ? 'Stop Stream' : 'Start Stream'}
            </Button>
            
            <Button
              onClick={clearTransactions}
              color="zinc"
            >
              Clear
            </Button>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-300">
            <div>Total: {stats.totalReceived}</div>
            <div className="text-green-400">Success: {stats.successful}</div>
            <div className="text-red-400">Failed: {stats.failed}</div>
            <div>Last: {stats.lastUpdate.toLocaleTimeString()}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Connection Status */}
        <div className="mb-4 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            stats.connectionStatus === 'connected' ? 'bg-green-400' : 
            stats.connectionStatus === 'connecting' ? 'bg-yellow-400' :
            stats.connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'
          }`} />
          <span className="text-sm text-gray-300">
            {stats.connectionStatus === 'connected' ? 'Connected' : 
             stats.connectionStatus === 'connecting' ? 'Connecting' :
             stats.connectionStatus === 'error' ? 'Error' : 'Disconnected'} - {rpcUrl}
          </span>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isStreaming ? 'Waiting for transactions...' : 'No transactions received'}
            </div>
          ) : (
            transactions.map((tx, index) => {
              const status = getTransactionStatus(tx);
              const statusColors = {
                success: 'border-l-[3px] border-[#60d695]',
                failed: 'border-l-[3px] border-[#ff6b6b]',
                pending: 'border-l-[3px] border-[#606060]'
              };
              
              const badgeColors = {
                success: 'green',
                failed: 'red',
                pending: 'zinc'
              };

              return (
                <div 
                  key={`${tx.transaction.signatures[0]}-${index}`} 
                  className={`bg-zinc-800 p-4 ${statusColors[status as keyof typeof statusColors]} cursor-pointer hover:bg-zinc-700 transition-colors`}
                  onClick={() => handleTransactionClick(tx)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge color={badgeColors[status as keyof typeof badgeColors] as any} className="text-xs">
                        {status.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-300 font-mono">
                        {formatSignature(tx.transaction.signatures[0])}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Slot: {tx.slot}</div>
                    {tx.meta && (
                      <>
                        <div>Fee: {tx.meta.fee} lamports</div>
                        <div>Compute Units: {tx.meta.computeUnitsConsumed}</div>
                      </>
                    )}
                    {tx.meta?.err && (
                      <div className="text-red-400">
                        Error: {String(tx.meta.err)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Transaction Details Dialog */}
      <Dialog open={transactionDialogOpen} onClose={() => setTransactionDialogOpen(false)} size="5xl">
        <DialogBody>
          {selectedTransaction ? (
            <div className="space-y-6">
              {/* Basic Transaction Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">Status</div>
                  <Badge 
                    color={getTransactionStatus(selectedTransaction) === 'success' ? 'green' : 
                           getTransactionStatus(selectedTransaction) === 'failed' ? 'red' : 'zinc'} 
                    className="text-sm"
                  >
                    {getTransactionStatus(selectedTransaction).toUpperCase()}
                  </Badge>
                </div>
                
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">Compute Units Consumed</div>
                  <div className="text-sm font-mono">{selectedTransaction.meta.computeUnitsConsumed || 'Unknown'}</div>
                </div>
                
                {selectedTransaction.meta ? (
                  <div className="bg-zinc-800/50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">Fee</div>
                    <div className="text-sm font-mono">{selectedTransaction.meta.fee || 0} lamports</div>
                  </div>
                ) : (
                  <div className="bg-zinc-800/50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">Fee</div>
                    <div className="text-sm font-mono">0 lamports</div>
                  </div>
                )}
              </div>

              {/* Transaction Header */}
              {selectedTransaction.transaction?.message?.header && (
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">Transaction Header</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Required Signatures</div>
                      <div className="font-mono">{selectedTransaction.transaction.message.header.numRequiredSignatures}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Readonly Signed</div>
                      <div className="font-mono">{selectedTransaction.transaction.message.header.numReadonlySignedAccounts}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Readonly Unsigned</div>
                      <div className="font-mono">{selectedTransaction.transaction.message.header.numReadonlyUnsignedAccounts}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedTransaction.meta?.err && (
                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                  <div className="text-xs text-red-400 mb-2">Error Details</div>
                  <div className="text-sm text-red-300">
                    {String(selectedTransaction.meta.err)}
                  </div>
                </div>
                              )}

              <div className="text-sm font-semibold text-zinc-200 mb-3">INSTRUCTIONS</div>
              {selectedTransaction.transaction?.message?.instructions && (
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">
                    Instructions ({selectedTransaction.transaction.message.instructions.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-3">
                    {selectedTransaction.transaction.message.instructions.map((instruction: any, index: number) => (
                      <div key={index} className="border-l-2 border-zinc-600 pl-3">
                        <div className="text-xs font-mono text-gray-300 mb-1">
                          <span className="text-gray-500">#{index}:</span> {instruction.programId || 'Unknown Program'}
                        </div>
                        {instruction.accounts && instruction.accounts.length > 0 && (
                          <div className="text-xs text-gray-400 ml-4">
                            <div className="text-gray-500 mb-1">Accounts:</div>
                            <div className="space-y-1">
                              {instruction.accounts.map((acc: any, accIndex: number) => (
                                <div key={accIndex} className="flex items-start gap-2">
                                  <span className="text-gray-500 w-6">{accIndex}:</span>
                                  <span className="break-all">
                                    {typeof acc === 'object' && acc !== null 
                                      ? JSON.stringify(acc) 
                                      : String(acc)
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {instruction.data && (
                          <div className="text-xs text-gray-400 ml-4 mt-1">
                            <div className="text-gray-500 mb-1">Data:</div>
                            <div className="font-mono break-all bg-zinc-900/50 p-2 rounded">
                              {instruction.data}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

                            <div className="text-sm font-semibold text-zinc-200 mb-3">STATE CHANGES</div>
              {transactionProfile?.value?.state && (
                  <div className="bg-zinc-800/50 p-4 rounded-lg">
                    <div className="space-y-3">
                    {Object.entries(transactionProfile.value.state.preExecution).map(([address, preData]) => {
                      const postData = transactionProfile.value.state.postExecution[address];
                      const lamportsChanged = preData && postData && (preData as any).lamports !== (postData as any).lamports;
                      const ownerChanged = preData && postData && (preData as any).owner !== (postData as any).owner;
                      const executableChanged = preData && postData && (preData as any).executable !== (postData as any).executable;
                      const spaceChanged = preData && postData && (preData as any).space !== (postData as any).space;
                      const rentEpochChanged = preData && postData && (preData as any).rentEpoch !== (postData as any).rentEpoch;
                      
                      return (
                        <div key={address}>
                          <div className="text-xs text-gray-500 mb-2">
                            Account {address}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Pre Execution */}
                            <div>
                              <div className="text-xs text-gray-400 mb-1 font-semibold">Before</div>
                              {preData ? (
                                <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded">
                                  <div className="text-gray-300 text-xs">
                                    <div className={lamportsChanged ? 'text-red-300 bg-red-900/30 px-1 rounded' : ''}>
                                      Lamports: {(preData as any).lamports}
                                    </div>
                                    {(preData as any).owner && (
                                      <div className={ownerChanged ? 'text-red-300 bg-red-900/30 px-1 rounded' : ''}>
                                        Owner: {(preData as any).owner}
                                      </div>
                                    )}
                                    {(preData as any).executable !== undefined && (
                                      <div className={executableChanged ? 'text-red-300 bg-red-900/30 px-1 rounded' : ''}>
                                        Executable: {(preData as any).executable ? 'Yes' : 'No'}
                                      </div>
                                    )}
                                    {(preData as any).space !== undefined && (
                                      <div className={spaceChanged ? 'text-red-300 bg-red-900/30 px-1 rounded' : ''}>
                                        Space: {(preData as any).space}
                                      </div>
                                    )}
                                    {(preData as any).rentEpoch !== undefined && (
                                      <div className={rentEpochChanged ? 'text-red-300 bg-red-900/30 px-1 rounded' : ''}>
                                        Rent Epoch: {(preData as any).rentEpoch}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded text-gray-400 text-xs">
                                  Account not found
                                </div>
                              )}
                            </div>

                            {/* Post Execution */}
                            <div>
                              <div className="text-xs text-gray-400 mb-1 font-semibold">After</div>
                              {postData ? (
                                <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded">
                                  <div className="text-gray-300 text-xs">
                                    <div className={lamportsChanged ? 'text-green-300 bg-green-900/30 px-1 rounded' : ''}>
                                      Lamports: {(postData as any).lamports}
                                    </div>
                                    {(postData as any).owner && (
                                      <div className={ownerChanged ? 'text-green-300 bg-green-900/30 px-1 rounded' : ''}>
                                        Owner: {(postData as any).owner}
                                      </div>
                                    )}
                                    {(postData as any).executable !== undefined && (
                                      <div className={executableChanged ? 'text-green-300 bg-green-900/30 px-1 rounded' : ''}>
                                        Executable: {(postData as any).executable ? 'Yes' : 'No'}
                                      </div>
                                    )}
                                    {(postData as any).space !== undefined && (
                                      <div className={spaceChanged ? 'text-green-300 bg-green-900/30 px-1 rounded' : ''}>
                                        Space: {(postData as any).space}
                                      </div>
                                    )}
                                    {(postData as any).rentEpoch !== undefined && (
                                      <div className={rentEpochChanged ? 'text-green-300 bg-green-900/30 px-1 rounded' : ''}>
                                        Rent Epoch: {(postData as any).rentEpoch}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded text-gray-400 text-xs">
                                  Account not found
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-sm font-semibold text-zinc-200 mb-3">TRANSACTION LOGS</div>
              {selectedTransaction.meta?.logMessages && selectedTransaction.meta.logMessages.length > 0 && (
                <div className="bg-black/80 border border-gray-600 rounded-md p-3 font-mono text-xs">
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedTransaction.meta.logMessages.map((log: string, index: number) => (
                      <div key={index} className="text-green-400">
                        <span className="text-gray-500">[{index.toString().padStart(3, '0')}]</span> {log}
                      </div>
                    ))}
                  </div>
                </div>
            )}
            </div>

          ) : (
            <div className="text-center py-8 text-gray-500">
              No transaction selected
            </div>
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
} 