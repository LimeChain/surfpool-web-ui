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
  const [expandedAccounts, setExpandedAccounts] = useState<Map<string, boolean>>(new Map());
  const [accountViewModes, setAccountViewModes] = useState<Map<string, 'parsed' | 'hex'>>(new Map());
  
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

  const toggleAccountExpansion = (address: string) => {
    setExpandedAccounts(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(address);
      newMap.set(address, !currentState);
      return newMap;
    });
  };

  const isAccountExpanded = (address: string, hasChanges: boolean) => {
    // Default: readonly accounts collapsed, readwrite accounts expanded
    const defaultExpanded = hasChanges;
    // If the address has been explicitly set, use that value, otherwise use the default
    return expandedAccounts.has(address) ? expandedAccounts.get(address)! : defaultExpanded;
  };

  const getAccountViewMode = (address: string) => {
    return accountViewModes.get(address) || 'parsed';
  };

  const toggleAccountViewMode = (address: string) => {
    setAccountViewModes(prev => {
      const newMap = new Map(prev);
      const currentMode = newMap.get(address) || 'parsed';
      newMap.set(address, currentMode === 'parsed' ? 'hex' : 'parsed');
      return newMap;
    });
  };

  const getHexData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      // If it's a base64 array, decode and convert to hex
      if (Array.isArray(data) && data.length === 2 && data[1] === "base64") {
        try {
          const decoded = atob(data[0]);
          return formatHexDump(decoded);
        } catch (error) {
          return data[0] || '<none>';
        }
      }
      // For other objects, convert to hex representation
      const jsonStr = JSON.stringify(data);
      return formatHexDump(jsonStr);
    }
    // For strings, convert to hex
    const str = String(data);
    if (str === '' || str === 'null' || str === 'undefined') return '<none>';
    return formatHexDump(str);
  };

  const formatHexDump = (data: string) => {
    const bytes = Array.from(data).map(char => char.charCodeAt(0));
    const lines = [];
    
    for (let i = 0; i < bytes.length; i += 16) {
      const lineBytes = bytes.slice(i, i + 16);
      
      // Hex representation
      const hexPart = lineBytes.map(byte => 
        byte.toString(16).padStart(2, '0').toUpperCase()
      ).join(' ');
      
      // ASCII representation
      const asciiPart = lineBytes.map(byte => {
        if (byte >= 32 && byte <= 126) {
          return String.fromCharCode(byte);
        } else {
          return '.';
        }
      }).join('');
      
      // Line number (offset)
      const offset = i.toString(16).padStart(4, '0').toUpperCase();
      
      // Create line with ASCII pushed to extreme right
      const hexSection = `${offset}: ${hexPart}`;
      const asciiSection = `|${asciiPart}|`;
      
      lines.push(`${hexSection.padEnd(70)}${asciiSection}`);
    }
    
    return lines.join('\n');
  };

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

                            <div className="text-sm font-semibold text-zinc-200 mb-3">STATE TRANSITIONS</div>
              {transactionProfile?.value?.state && (
                  <div className="bg-zinc-800/50 p-4 rounded-lg">
                    <div className="space-y-3">
                    {Object.entries(transactionProfile.value.state.preExecution).map(([address, preData], index) => {
                      const postData = transactionProfile.value.state.postExecution[address];
                      
                      // Check if account is readonly (no changes)
                      const lamportsChanged = preData && postData && (preData as any).lamports !== (postData as any).lamports;
                      const ownerChanged = preData && postData && (preData as any).owner !== (postData as any).owner;
                      const executableChanged = preData && postData && (preData as any).executable !== (postData as any).executable;
                      const spaceChanged = preData && postData && (preData as any).space !== (postData as any).space;
                      const rentEpochChanged = preData && postData && (preData as any).rentEpoch !== (postData as any).rentEpoch;
                      const dataChanged = preData && postData && (() => {
                        const preDataValue = (preData as any).data;
                        const postDataValue = (postData as any).data;
                        
                        // Handle different data types and encodings
                        if (preDataValue === postDataValue) return false;
                        
                        // Convert to string for comparison
                        const preStr = String(preDataValue);
                        const postStr = String(postDataValue);
                        
                        return preStr !== postStr;
                      })();
                      
                      // Check if account has changes
                      const hasChanges = lamportsChanged || ownerChanged || executableChanged || dataChanged;

                      // Helper function to extract programData from parsed data
                      const extractProgramData = (data: any) => {
                        if (typeof data === 'object' && data !== null) {
                          // Check if it has the parsed structure with programData
                          if (data.parsed && data.parsed.info && data.parsed.info.programData) {
                            return data.parsed.info.programData;
                          }
                          
                          // Check if it's a base64 array format: ["base64string", "base64"]
                          if (Array.isArray(data) && data.length === 2 && data[1] === "base64") {
                            try {
                              const decoded = atob(data[0]);
                              return decoded === '' ? '<none>' : decoded;
                            } catch (error) {
                              // If decoding fails, return the original base64 string
                              return data[0] === '' ? '<none>' : data[0];
                            }
                          }
                          
                          // Fallback to JSON.stringify for other objects
                          return JSON.stringify(data);
                        }
                        const stringValue = String(data);
                        return stringValue === '' || stringValue === 'null' || stringValue === 'undefined' ? '<none>' : stringValue;
                      };

                      // Helper function to highlight character differences
                      const highlightDifferences = (beforeValue: any, afterValue: any, isRed: boolean) => {
                        // Handle data field specifically - normalize to string representation
                        let beforeStr = String(beforeValue);
                        let afterStr = String(afterValue);
                        
                        // For data fields, try to normalize the representation
                        if (beforeValue !== null && afterValue !== null) {
                          // If they're buffers or similar, try to get consistent string representation
                          if (typeof beforeValue === 'object' && typeof afterValue === 'object') {
                            beforeStr = JSON.stringify(beforeValue);
                            afterStr = JSON.stringify(afterValue);
                          }
                        }
                        
                        const maxLength = Math.max(beforeStr.length, afterStr.length);
                        const result = [];
                        
                        for (let i = 0; i < maxLength; i++) {
                          const beforeChar = beforeStr[i] || '';
                          const afterChar = afterStr[i] || '';
                          const isDifferent = beforeChar !== afterChar;
                          
                          if (isDifferent) {
                            const colorClass = isRed ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold';
                            // For red (before), show beforeChar. For green (after), show afterChar
                            const charToShow = isRed ? beforeChar : afterChar;
                            result.push(<span key={i} className={colorClass}>{charToShow}</span>);
                          } else {
                            // For both cases, show the appropriate character
                            const charToShow = isRed ? beforeChar : afterChar;
                            result.push(<span key={i}>{charToShow}</span>);
                          }
                        }
                        
                        return result;
                      };
                      
                      return (
                        <div key={address} className={index > 0 ? 'pt-4 border-t border-gray-700/30' : ''}>
                          <div 
                            className="text-xs text-gray-400 mb-2 font-mono cursor-pointer hover:bg-gray-700/20 p-1 rounded transition-colors flex items-center justify-between"
                            onClick={() => toggleAccountExpansion(address)}
                          >
                            <div className="flex items-center">
                              <span className="text-gray-500 mr-2">
                                {isAccountExpanded(address, hasChanges) ? '▼' : '▶'}
                              </span>
                              <span className="text-gray-500">Account</span> <span className="text-gray-300 font-semibold ml-1">{address}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${hasChanges ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30' : 'bg-gray-700/30 text-gray-300 border border-gray-500/30'}`}>
                              {hasChanges ? 'readwrite' : 'readonly'}
                            </span>
                          </div>
                                                      {isAccountExpanded(address, hasChanges) && (
                              <>
                                {hasChanges ? (
                            <div className="grid grid-cols-2 gap-4">
                              {/* Pre Execution */}
                              <div>
                                <div className="text-xs text-gray-400 mb-1 font-semibold">
                                  PRE-EXECUTION
                                </div>
                                {preData ? (
                                  <div className={`${lamportsChanged || ownerChanged || spaceChanged || rentEpochChanged || dataChanged ? 'bg-red-900/20 border-red-500/30' : 'bg-gray-700/20 border-gray-500/30'} border p-2 rounded`}>
                                    <div className="text-gray-300 text-xs">
                                                                            <div className={`${lamportsChanged ? 'text-red-200 bg-red-900/40 rounded' : ''} px-1`}>
                                        Lamports: {lamportsChanged ? highlightDifferences((preData as any).lamports, (postData as any).lamports, true) : (preData as any).lamports}
                                      </div>
                                      {(preData as any).owner && (
                                        <div className={`${ownerChanged ? 'text-red-200 bg-red-900/40 rounded' : ''} px-1`}>
                                          Owner: {ownerChanged ? highlightDifferences((preData as any).owner, (postData as any).owner, true) : (preData as any).owner}
                                        </div>
                                      )}
                                      <div className={`${dataChanged ? 'text-red-200 bg-red-900/40 rounded' : ''} px-1`}>
                                        <div>Data:</div>
                                        {getAccountViewMode(address) === 'parsed' 
                                          ? (dataChanged ? highlightDifferences(extractProgramData((preData as any).data), extractProgramData((postData as any).data), true) : extractProgramData((preData as any).data))
                                          : (
                                            <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto ml-4 mt-0.5">
                                              {getHexData((preData as any).data)}
                                            </div>
                                          )
                                        }
                                      </div>
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
                                <div className="text-xs text-gray-400 mb-1 font-semibold flex justify-between items-center">
                                  POST-EXECUTION
                                  <div className="flex text-xs gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAccountViewModes(prev => {
                                          const newMap = new Map(prev);
                                          newMap.set(address, 'parsed');
                                          return newMap;
                                        });
                                      }}
                                      className={`transition-colors ${
                                        getAccountViewMode(address) === 'parsed' 
                                          ? 'text-white font-medium' 
                                          : 'text-gray-500 hover:text-gray-400'
                                      }`}
                                    >
                                      Pretty
                                    </button>
                                    <span className="text-gray-600">|</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAccountViewModes(prev => {
                                          const newMap = new Map(prev);
                                          newMap.set(address, 'hex');
                                          return newMap;
                                        });
                                      }}
                                      className={`transition-colors ${
                                        getAccountViewMode(address) === 'hex' 
                                          ? 'text-white font-medium' 
                                          : 'text-gray-500 hover:text-gray-400'
                                      }`}
                                    >
                                      Hex
                                    </button>
                                  </div>
                                </div>
                                {postData ? (
                                  <div className={`${lamportsChanged || ownerChanged || spaceChanged || rentEpochChanged || dataChanged ? 'bg-green-900/20 border-green-500/30' : 'bg-gray-700/20 border-gray-500/30'} border p-2 rounded`}>
                                    <div className="text-gray-300 text-xs">
                                                                            <div className={`${lamportsChanged ? 'text-green-200 bg-green-900/40 rounded' : ''} px-1`}>
                                        Lamports: {lamportsChanged ? highlightDifferences((preData as any).lamports, (postData as any).lamports, false) : (postData as any).lamports}
                                      </div>
                                      {(postData as any).owner && (
                                        <div className={`${ownerChanged ? 'text-green-200 bg-green-900/40 rounded' : ''} px-1`}>
                                          Owner: {ownerChanged ? highlightDifferences((preData as any).owner, (postData as any).owner, false) : (postData as any).owner}
                                        </div>
                                      )}
                                      <div className={`${dataChanged ? 'text-green-200 bg-green-900/40 rounded' : ''} px-1`}>
                                        <div>Data:</div>
                                        {getAccountViewMode(address) === 'parsed' 
                                          ? (dataChanged ? highlightDifferences(extractProgramData((preData as any).data), extractProgramData((postData as any).data), false) : extractProgramData((postData as any).data))
                                          : (
                                            <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto ml-4 mt-0.5">
                                              {getHexData((postData as any).data)}
                                            </div>
                                          )
                                        }
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded text-gray-400 text-xs">
                                    Account not found
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Readonly account - single display */
                            <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded">
                              <div className="text-xs text-gray-400 mb-1 font-semibold flex justify-between items-center">
                                <div></div>
                                <div className="flex text-xs gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAccountViewModes(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(address, 'parsed');
                                        return newMap;
                                      });
                                    }}
                                    className={`transition-colors ${
                                      getAccountViewMode(address) === 'parsed' 
                                        ? 'text-white font-medium' 
                                        : 'text-gray-500 hover:text-gray-400'
                                    }`}
                                  >
                                    Pretty
                                  </button>
                                  <span className="text-gray-600">|</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAccountViewModes(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(address, 'hex');
                                        return newMap;
                                      });
                                    }}
                                    className={`transition-colors ${
                                      getAccountViewMode(address) === 'hex' 
                                        ? 'text-white font-medium' 
                                        : 'text-gray-500 hover:text-gray-400'
                                    }`}
                                  >
                                    Hex
                                  </button>
                                </div>
                              </div>
                              <div className="text-gray-300 text-xs">
                                                                                                     {preData ? (
                                      <>
                                        <div className="px-1">Lamports: {(preData as any).lamports}</div>
                                        {(preData as any).owner && <div className="px-1">Owner: {(preData as any).owner}</div>}
                                        <div className="px-1">
                                          <div>Data:</div>
                                          {getAccountViewMode(address) === 'parsed' 
                                            ? extractProgramData((preData as any).data)
                                            : (
                                              <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto ml-4 mt-0.5">
                                                {getHexData((preData as any).data)}
                                              </div>
                                            )
                                          }
                                        </div>
                                      </>
                                    ) : (
                                  <div className="text-gray-400">Account not found</div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
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