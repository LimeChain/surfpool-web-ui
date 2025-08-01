"use client"

import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { Dialog, DialogBody, DialogTitle } from '@/components/catalyst/dialog';
import { useTransactionStream, formatSignature, getTransactionStatus, getTransactionPrograms } from '@/lib/solana-transaction-stream';
import { useAppConfig } from '@/hooks/use-app-config';
import { useState } from 'react';
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import * as jsonDiff from 'json-diff';

interface TransactionStreamProps {
  rpcUrl?: string;
  wsUrl?: string;
  maxTransactions?: number;
  autoStart?: boolean;
  filterByProgram?: string;
  filterByAccount?: string;
}

let json = {
  "slot": 123,
  "key": "0c2441a4-85b4-4eed-802e-855a66da721d",
  "instructionProfiles": [
    {
      "accountStates": {
        "1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM": {
          "type": "writable",
          "accountChange": {
            "type": "create",
            "data": {
              "lamports": 100,
              "data": {
                "program": "custom-program",
                "parsed": {
                  "field1": "value1",
                  "field2": "value2"
                },
                "space": 50
              },
              "owner": "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh",
              "executable": false,
              "rentEpoch": 0,
              "space": 100
            }
          }
        },
        "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh": {
          "type": "readonly"
        }
      },
      "computeUnitsConsumed": 100,
      "logMessages": [
        "Log message: Creating Account",
        "Log message: Account created"
      ],
      "errorMessage": null
    },
    {
      "accountStates": {
        "1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM": {
          "type": "writable",
          "accountChange": {
            "type": "update",
            "data": [
              {
                "lamports": 100,
                "data": {
                  "program": "custom-program",
                  "parsed": {
                    "field1": "value1",
                    "field2": "value2"
                  },
                  "space": 50
                },
                "owner": "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh",
                "executable": false,
                "rentEpoch": 0,
                "space": 100
              },
              {
                "lamports": 90,
                "data": {
                  "program": "custom-program",
                  "parsed": {
                    "field1": "updated-value1",
                    "field2": "updated-value2"
                  },
                  "space": 50
                },
                "owner": "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh",
                "executable": false,
                "rentEpoch": 0,
                "space": 100
              }
            ]
          }
        },
        "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh": {
          "type": "readonly"
        }
      },
      "computeUnitsConsumed": 100,
      "logMessages": [
        "Log message: Updating Account",
        "Log message: Account updated"
      ],
      "errorMessage": null
    },
    {
      "accountStates": {
        "1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM": {
          "type": "writable",
          "accountChange": {
            "type": "delete",
            "data": {
              "lamports": 100,
              "data": {
                "program": "custom-program",
                "parsed": {
                  "field1": "updated-value1",
                  "field2": "updated-value2"
                },
                "space": 50
              },
              "owner": "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh",
              "executable": false,
              "rentEpoch": 0,
              "space": 100
            }
          }
        },
        "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh": {
          "type": "readonly"
        }
      },
      "computeUnitsConsumed": 100,
      "logMessages": [
        "Log message: Deleting Account",
        "Log message: Account deleted"
      ],
      "errorMessage": null
    }
  ],
  "transactionProfile": {
    "accountStates": {
      "1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM": {
        "type": "writable",
        "accountChange": {
          "type": "unchanged"
        }
      },
      "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh": {
        "type": "readonly"
      }
    },
    "computeUnitsConsumed": 300,
    "logMessages": [
      "Log message: Creating Account",
      "Log message: Account created",
      "Log message: Updating Account",
      "Log message: Account updated",
      "Log message: Deleting Account",
      "Log message: Account deleted"
    ],
    "errorMessage": null
  },
  "readonlyAccountStates": {
    "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh": {
      "lamports": 100,
      "data": [
        "ABCDEFG",
        "base64"
      ],
      "owner": "1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh",
      "executable": false,
      "rentEpoch": 0,
      "space": 100
    }
  }
};

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
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set());
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
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

  const toggleAccountExpansion = (instructionIndex: number, address: string) => {
    const key = `${instructionIndex}:${address}`;
    setExpandedAccounts(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(key);
      newMap.set(key, !currentState);
      return newMap;
    });
  };

  const isAccountExpanded = (instructionIndex: number, address: string, hasChanges: boolean) => {
    const key = `${instructionIndex}:${address}`;
    // Default: readonly accounts collapsed, readwrite accounts expanded
    const defaultExpanded = hasChanges;
    // If the address has been explicitly set, use that value, otherwise use the default
    return expandedAccounts.has(key) ? expandedAccounts.get(key)! : defaultExpanded;
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

  const toggleInstructionExpansion = (index: number) => {
    setExpandedInstructions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}⋯${address.slice(-8)}`;
  };

  const truncateOwnerAddress = (address: string) => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}⋯${address.slice(-4)}`;
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
      
      // Pretty print JSON objects
      try {
        return JSON.stringify(data, null, 2);
      } catch (error) {
        return JSON.stringify(data);
      }
    }
    const stringValue = String(data);
    return stringValue === '' || stringValue === 'null' || stringValue === 'undefined' ? '<none>' : stringValue;
  };

  // Helper function to highlight character differences
  const highlightDifferences = (beforeValue: any, afterValue: any, isRed: boolean) => {
    // Convert values to strings for comparison
    const beforeStr = String(beforeValue);
    const afterStr = String(afterValue);
    
    // If values are identical, return the appropriate value without highlighting
    if (beforeStr === afterStr) {
      return <span>{isRed ? beforeStr : afterStr}</span>;
    }
    
    console.log(`🔍 highlightDifferences: "${beforeStr}" vs "${afterStr}", isRed: ${isRed}`);
    
    // Find the first difference and highlight from there to the end
    const maxLength = Math.max(beforeStr.length, afterStr.length);
    let firstDiffIndex = -1;
    
    // Find the first character that's different
    for (let i = 0; i < maxLength; i++) {
      const beforeChar = beforeStr[i] || '';
      const afterChar = afterStr[i] || '';
      if (beforeChar !== afterChar) {
        firstDiffIndex = i;
        break;
      }
    }
    
    if (firstDiffIndex === -1) {
      // No differences found
      return <span>{isRed ? beforeStr : afterStr}</span>;
    }
    
    // Split the string into normal and highlighted parts
    const valueToShow = isRed ? beforeStr : afterStr;
    const normalPart = valueToShow.substring(0, firstDiffIndex);
    const highlightedPart = valueToShow.substring(firstDiffIndex);
    
    const colorClass = isRed ? 'text-red-500 font-bold bg-red-900/30' : 'text-green-500 font-bold bg-green-900/30';
    
    console.log(`✅ Result: normal="${normalPart}", highlighted="${highlightedPart}"`);
    
    return (
      <>
        {normalPart && <span>{normalPart}</span>}
        {highlightedPart && <span className={colorClass}>{highlightedPart}</span>}
      </>
    );
  };

  // Helper function to render JSON diff with proper color coding
  const renderJsonDiff = (beforeJson: any, afterJson: any, isRed: boolean) => {
    try {
      // Ensure we're working with actual objects, not strings
      const beforeObj = typeof beforeJson === 'string' ? JSON.parse(beforeJson) : beforeJson;
      const afterObj = typeof afterJson === 'string' ? JSON.parse(afterJson) : afterJson;
      
      // Get the JSON to display (before or after)
      const jsonToShow = isRed ? beforeObj : afterObj;
      const jsonString = JSON.stringify(jsonToShow, null, 2);
      
      // Use json-diff to get the diff string and parse it to find changed paths
      const diffString = jsonDiff.diffString(beforeObj, afterObj);
      
      // Extract changed field names from the diff string
      const changedFields = new Set<string>();
      const lines = diffString.split('\n');
      lines.forEach(line => {
        if (line.startsWith('-') || line.startsWith('+')) {
          // Extract field name from lines like: -    field1: "value1"
          const match = line.match(/^\s*[-+]\s*(\w+):/);
          if (match) {
            changedFields.add(match[1]);
          }
        }
      });
      
      console.log('Changed fields:', Array.from(changedFields));
      console.log('Diff string:', diffString);
      
      // Split into lines and process each line
      const jsonLines = jsonString.split('\n');
      const processedLines = jsonLines.map((line, index) => {
        const trimmedLine = line.trim();
        
        // Check if this line contains a changed field
        const hasChangedValue = Array.from(changedFields).some(field => {
          return trimmedLine.includes(`"${field}"`);
        });
        
        if (hasChangedValue) {
          const colorClass = isRed ? 'text-red-500 bg-red-900/30 font-bold' : 'text-green-500 bg-green-900/30 font-bold';
          return (
            <div key={index} className={colorClass}>
              {line}
            </div>
          );
        } else {
          // Unchanged line
          return (
            <div key={index} className="text-gray-300">
              {line}
            </div>
          );
        }
      });

      return <div className="font-mono text-xs">{processedLines}</div>;
    } catch (error) {
      console.error('Error rendering JSON diff:', error);
      // Fallback to simple string comparison
      const jsonToShow = isRed ? beforeJson : afterJson;
      return <pre className="text-gray-300">{JSON.stringify(jsonToShow, null, 2)}</pre>;
    }
  };

  const fetchTransactionProfile = async (signature: string) => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      setTransactionProfile(null);
      
      console.log('🔍 Fetching transaction profile for signature:', signature);
      
      // Mock response using the provided JSON
      const mockResponse = json;
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('📊 Mock transaction profile response:', mockResponse);
      setTransactionProfile(mockResponse);
      
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
                  <div className="text-sm font-mono">
                    {transactionProfile && transactionProfile.instructionProfiles 
                      ? transactionProfile.instructionProfiles.reduce((sum: number, profile: any) => sum + (profile.computeUnitsConsumed || 0), 0)
                      : selectedTransaction.meta.computeUnitsConsumed || 'Unknown'
                    }
                  </div>
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

              {/* Transaction Profile - New Detailed View */}
              {transactionProfile && (
                <>
                  <div className="text-sm font-semibold text-zinc-200 mb-3">TRANSACTION PROFILE</div>
                  
                  {/* Compute Units Stack Bar */}
                  {transactionProfile.instructionProfiles && transactionProfile.instructionProfiles.length > 0 && (
                    <div className="mb-8">
                      <div className="text-xs text-gray-500 mb-3">Compute Units Distribution</div>
                      <div className="flex h-6 rounded-md overflow-hidden border border-zinc-600">
                        {transactionProfile.instructionProfiles.map((profile: any, index: number) => {
                          const cu = profile.computeUnitsConsumed || 0;
                          const totalCu = transactionProfile.computeUnitsConsumed || 1;
                          const percentage = (cu / totalCu) * 100;
                          
                          // macOS-style colors for different instruction types
                          const colors = [
                            'bg-blue-500',    // Blue
                            'bg-green-500',   // Green  
                            'bg-orange-500',  // Orange
                            'bg-purple-500',  // Purple
                            'bg-red-500',     // Red
                            'bg-yellow-500',  // Yellow
                            'bg-pink-500',    // Pink
                            'bg-indigo-500',  // Indigo
                          ];
                          const colorClass = colors[index % colors.length];
                          
                          return (
                            <div
                              key={index}
                              className={`${colorClass} relative group cursor-pointer transition-all duration-200 hover:brightness-110`}
                              style={{ width: `${percentage}%` }}
                              title={`Instruction ${index}: ${cu} CU (${percentage.toFixed(1)}%)`}
                            >
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                Instruction {index}: {cu} CU
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        {transactionProfile.instructionProfiles.map((profile: any, index: number) => {
                          const cu = profile.computeUnitsConsumed || 0;
                          
                          const colors = [
                            'bg-blue-500',
                            'bg-green-500', 
                            'bg-orange-500',
                            'bg-purple-500',
                            'bg-red-500',
                            'bg-yellow-500',
                            'bg-pink-500',
                            'bg-indigo-500',
                          ];
                          const colorClass = colors[index % colors.length];
                          
                          return (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <div className={`w-3 h-3 rounded ${colorClass}`}></div>
                              <span className="text-gray-300">Instruction #{index}:</span>
                              <span className="text-gray-400">{cu} CU</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  


                  {/* Instruction Profiles */}
                  <div className="space-y-4">
                    {transactionProfile.instructionProfiles?.map((profile: any, index: number) => {
                      // macOS-style colors for different instruction types
                      const colors = [
                        'bg-blue-500',    // Blue
                        'bg-green-500',   // Green  
                        'bg-orange-500',  // Orange
                        'bg-purple-500',  // Purple
                        'bg-red-500',     // Red
                        'bg-yellow-500',  // Yellow
                        'bg-pink-500',    // Pink
                        'bg-indigo-500',  // Indigo
                      ];
                      
                      return (
                        <div key={index} className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
                        {/* Instruction Header */}
                        <div 
                          className="bg-zinc-900/50 p-3 border-b border-zinc-700 cursor-pointer hover:bg-zinc-900/70 transition-colors"
                          onClick={() => toggleInstructionExpansion(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`mr-2 ${colors[index % colors.length] === 'bg-blue-500' ? 'text-blue-500' : 
                                                  colors[index % colors.length] === 'bg-green-500' ? 'text-green-500' :
                                                  colors[index % colors.length] === 'bg-orange-500' ? 'text-orange-500' :
                                                  colors[index % colors.length] === 'bg-purple-500' ? 'text-purple-500' :
                                                  colors[index % colors.length] === 'bg-red-500' ? 'text-red-500' :
                                                  colors[index % colors.length] === 'bg-yellow-500' ? 'text-yellow-500' :
                                                  colors[index % colors.length] === 'bg-pink-500' ? 'text-pink-500' :
                                                  colors[index % colors.length] === 'bg-indigo-500' ? 'text-indigo-500' : 'text-gray-500'}`}>
                                  {expandedInstructions.has(index) ? '▼' : '▶'}
                                </span>
                                <div className="text-sm font-semibold text-zinc-200">
                                  Instruction #{index}
                                </div>
                              </div>

                              {profile.errorMessage && (
                                <Badge color="red" className="text-xs">
                                  ERROR
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-green-400 font-mono font-semibold">
                              {profile.computeUnitsConsumed || 0} CU
                            </div>
                          </div>
                        </div>

                        {/* Instruction Content */}
                        {expandedInstructions.has(index) && (
                          <div className="p-4 space-y-4">
                            {/* Account States */}
                            {profile.accountStates && (
                              <div>
                                <div className="text-xs text-gray-500 mb-2 font-semibold">ACCOUNT STATES</div>
                                <div className="space-y-3">
                                  {Object.entries(profile.accountStates).map(([address, accountState]: [string, any]) => {
                                    const isWritable = accountState.type === 'writable';
                                    const hasChanges = accountState.accountChange && accountState.accountChange.type !== 'unchanged';
                                    
                                    return (
                                      <div key={address} className="bg-zinc-900/30 border border-zinc-600 rounded p-3">
                                        <div 
                                          className="text-xs text-gray-400 mb-0 font-mono cursor-pointer hover:bg-gray-700/20 py-1 px-2 rounded transition-colors flex items-center justify-between"
                                          onClick={() => toggleAccountExpansion(index, address)}
                                        >
                                          <div className="flex items-center">
                                            <span className="text-gray-500 mr-2">
                                              {isAccountExpanded(index, address, hasChanges) ? '▼' : '▶'}
                                            </span>
                                            <span className="text-gray-500">Account</span> 
                                            <span className="text-gray-300 font-semibold ml-1">
                                              <span className="hidden sm:inline">{address}</span>
                                              <span className="sm:hidden">{truncateAddress(address)}</span>
                                            </span>
                                            <button
                                              onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                copyToClipboard(address, `account-${address}`);
                                              }}
                                              aria-label={`Copy account address ${address}`}
                                              className="sm:hidden flex h-4 w-4 items-center justify-center ml-1 text-gray-400 hover:text-gray-300 transition-colors"
                                            >
                                              {copiedStates[`account-${address}`] ? (
                                                <CheckIcon className="h-2.5 w-2.5 text-green-500" />
                                              ) : (
                                                <ClipboardIcon className="h-2.5 w-2.5" />
                                              )}
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                                                                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isWritable ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30' : 'bg-gray-700/30 text-gray-300 border border-gray-500/30'}`}>
                                                        {isWritable ? 'WRITABLE' : 'READONLY'}
                                                      </span>
                                            {hasChanges && (
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                accountState.accountChange.type === 'create' ? 'bg-green-900/30 text-green-300 border border-green-500/30' :
                                                accountState.accountChange.type === 'update' ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30' :
                                                accountState.accountChange.type === 'delete' ? 'bg-red-900/30 text-red-300 border border-red-500/30' :
                                                'bg-gray-700/30 text-gray-300 border border-gray-500/30'
                                              }`}>
                                                <span className="hidden sm:inline">
                                                  {accountState.accountChange.type === 'create' ? 'ACCOUNT CREATION' :
                                                   accountState.accountChange.type === 'update' ? 'ACCOUNT UPDATE' :
                                                   accountState.accountChange.type === 'delete' ? 'ACCOUNT DELETION' :
                                                   accountState.accountChange.type.toUpperCase()}
                                                </span>
                                                <span className="sm:hidden">
                                                  {accountState.accountChange.type === 'create' ? 'CREATION' :
                                                   accountState.accountChange.type === 'update' ? 'UPDATE' :
                                                   accountState.accountChange.type === 'delete' ? 'DELETION' :
                                                   accountState.accountChange.type.toUpperCase()}
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {isAccountExpanded(index, address, hasChanges) && (
                                          <div className="space-y-3">
                                            {hasChanges && accountState.accountChange.type === 'create' && (
                                              <div className="mt-3">
                                                <div className="bg-green-900/20 border border-green-500/30 p-2 rounded">
                                                  <div className="text-gray-300 text-xs space-y-1">
                                                    <div className="flex justify-between items-center">
                                                      <span className="inline-block w-16 text-left">Lamports:</span>
                                                      <span className="text-right">{accountState.accountChange.data.lamports}</span>
                                                    </div>
                                                    {accountState.accountChange.data.owner && (
                                                      <div className="flex justify-between items-center">
                                                        <span className="inline-block w-16 text-left">Owner:</span>
                                                        <div className="flex items-center gap-1">
                                                          <button
                                                            onClick={(e: React.MouseEvent) => {
                                                              e.stopPropagation();
                                                              copyToClipboard(accountState.accountChange.data.owner, `owner-${accountState.accountChange.data.owner}`);
                                                            }}
                                                            aria-label={`Copy owner address ${accountState.accountChange.data.owner}`}
                                                            className="sm:hidden flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
                                                          >
                                                            {copiedStates[`owner-${accountState.accountChange.data.owner}`] ? (
                                                              <CheckIcon className="h-2.5 w-2.5 text-green-500" />
                                                            ) : (
                                                              <ClipboardIcon className="h-2.5 w-2.5" />
                                                            )}
                                                          </button>
                                                          <span className="text-right">
                                                            <span className="hidden sm:inline">{accountState.accountChange.data.owner}</span>
                                                            <span className="sm:hidden">{truncateOwnerAddress(accountState.accountChange.data.owner)}</span>
                                                          </span>
                                                        </div>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <div className="inline-block w-16 text-left">Data:</div>
                                                      {getAccountViewMode(address) === 'parsed' 
                                                        ? (
                                                          <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                            {extractProgramData(accountState.accountChange.data.data)}
                                                          </div>
                                                        )
                                                        : (
                                                          <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                            {getHexData(accountState.accountChange.data.data)}
                                                          </div>
                                                        )
                                                      }
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {hasChanges && accountState.accountChange.type === 'update' && (
                                              <div className="mt-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                  <div>
                                                    <div className="text-xs text-gray-400 mb-1">PRE-EXECUTION</div>
                                                    <div className="bg-gray-900/20 border border-gray-500/30 p-2 rounded">
                                                                                                                                                                      <div className="text-gray-300 text-xs space-y-1">
                                                           <div className={`${accountState.accountChange.data[0].lamports !== accountState.accountChange.data[1].lamports ? 'text-red-200 bg-red-900/40 rounded' : ''} px-1 flex justify-between items-center`}>
                                                             <span className="inline-block w-16 text-left">Lamports:</span> <span className="text-right">{highlightDifferences(accountState.accountChange.data[0].lamports, accountState.accountChange.data[1].lamports, true)}</span>
                                                           </div>
                                                                                                                                                                                   {accountState.accountChange.data[0].owner && (
                                                             <div className={`${accountState.accountChange.data[0].owner !== accountState.accountChange.data[1].owner ? 'text-red-200 bg-red-900/40 rounded' : ''} px-1 flex justify-between items-center`}>
                                                               <span className="inline-block w-16 text-left">Owner:</span> 
                                                               <div className="flex items-center gap-1">
                                                                 <button
                                                                   onClick={(e: React.MouseEvent) => {
                                                                     e.stopPropagation();
                                                                     copyToClipboard(accountState.accountChange.data[0].owner, `owner-pre-${accountState.accountChange.data[0].owner}`);
                                                                   }}
                                                                   aria-label={`Copy owner address ${accountState.accountChange.data[0].owner}`}
                                                                   className="sm:hidden flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
                                                                 >
                                                                   {copiedStates[`owner-pre-${accountState.accountChange.data[0].owner}`] ? (
                                                                     <CheckIcon className="h-2.5 w-2.5 text-green-500" />
                                                                   ) : (
                                                                     <ClipboardIcon className="h-2.5 w-2.5" />
                                                                   )}
                                                                 </button>
                                                                 <span className="text-right">
                                                                   <span className="hidden sm:inline">{highlightDifferences(accountState.accountChange.data[0].owner, accountState.accountChange.data[1].owner, true)}</span>
                                                                   <span className="sm:hidden">{truncateOwnerAddress(accountState.accountChange.data[0].owner)}</span>
                                                                 </span>
                                                               </div>
                                                             </div>
                                                           )}
                                                           <div>
                                                             <div className="inline-block w-16 text-left">Data:</div>
                                                             {getAccountViewMode(address) === 'parsed' 
                                                               ? (
                                                                 <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                                   {renderJsonDiff(extractProgramData(accountState.accountChange.data[0].data), extractProgramData(accountState.accountChange.data[1].data), true)}
                                                                 </div>
                                                               )
                                                               : (
                                                                 <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                                   {highlightDifferences(getHexData(accountState.accountChange.data[0].data), getHexData(accountState.accountChange.data[1].data), true)}
                                                                 </div>
                                                               )
                                                             }
                                                           </div>
                                                         </div>
                                                    </div>
                                                  </div>
                                                  <div>
                                                    <div className="text-xs text-gray-400 mb-1 flex justify-between items-center">
                                                      POST-EXECUTION
                                                      <div className="hidden sm:flex text-xs gap-2">
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
                                                    <div className="bg-gray-900/20 border border-gray-500/30 p-2 rounded">
                                                                                                                                                                      <div className="text-gray-300 text-xs space-y-1">
                                                           <div className={`${accountState.accountChange.data[0].lamports !== accountState.accountChange.data[1].lamports ? 'text-green-200 bg-green-900/40 rounded' : ''} px-1 flex justify-between items-center`}>
                                                             <span className="inline-block w-16 text-left">Lamports:</span> <span className="text-right">{highlightDifferences(accountState.accountChange.data[0].lamports, accountState.accountChange.data[1].lamports, false)}</span>
                                                           </div>
                                                                                                                                                                                   {accountState.accountChange.data[1].owner && (
                                                             <div className={`${accountState.accountChange.data[0].owner !== accountState.accountChange.data[1].owner ? 'text-green-200 bg-green-900/40 rounded' : ''} px-1 flex justify-between items-center`}>
                                                               <span className="inline-block w-16 text-left">Owner:</span> 
                                                               <div className="flex items-center gap-1">
                                                                 <button
                                                                   onClick={(e: React.MouseEvent) => {
                                                                     e.stopPropagation();
                                                                     copyToClipboard(accountState.accountChange.data[1].owner, `owner-post-${accountState.accountChange.data[1].owner}`);
                                                                   }}
                                                                   aria-label={`Copy owner address ${accountState.accountChange.data[1].owner}`}
                                                                   className="sm:hidden flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
                                                                 >
                                                                   {copiedStates[`owner-post-${accountState.accountChange.data[1].owner}`] ? (
                                                                     <CheckIcon className="h-2.5 w-2.5 text-green-500" />
                                                                   ) : (
                                                                     <ClipboardIcon className="h-2.5 w-2.5" />
                                                                   )}
                                                                 </button>
                                                                 <span className="text-right">
                                                                   <span className="hidden sm:inline">{highlightDifferences(accountState.accountChange.data[0].owner, accountState.accountChange.data[1].owner, false)}</span>
                                                                   <span className="sm:hidden">{truncateOwnerAddress(accountState.accountChange.data[1].owner)}</span>
                                                                 </span>
                                                               </div>
                                                             </div>
                                                           )}
                                                           <div>
                                                             <div className="inline-block w-16 text-left">Data:</div>
                                                             {getAccountViewMode(address) === 'parsed' 
                                                               ? (
                                                                 <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                                   {renderJsonDiff(extractProgramData(accountState.accountChange.data[0].data), extractProgramData(accountState.accountChange.data[1].data), false)}
                                                                 </div>
                                                               )
                                                               : (
                                                                 <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                                   {highlightDifferences(getHexData(accountState.accountChange.data[0].data), getHexData(accountState.accountChange.data[1].data), false)}
                                                                 </div>
                                                               )
                                                             }
                                                           </div>
                                                         </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {hasChanges && accountState.accountChange.type === 'delete' && (
                                              <div className="mt-3">
                                                <div className="bg-red-900/20 border border-red-500/30 p-2 rounded">
                                                  <div className="text-gray-300 text-xs space-y-1">
                                                    <div className="flex justify-between items-center">
                                                      <span className="inline-block w-16 text-left">Lamports:</span>
                                                      <span className="text-right">{accountState.accountChange.data.lamports}</span>
                                                    </div>
                                                    {accountState.accountChange.data.owner && (
                                                      <div className="flex justify-between items-center">
                                                        <span className="inline-block w-16 text-left">Owner:</span>
                                                        <div className="flex items-center gap-1">
                                                          <button
                                                            onClick={(e: React.MouseEvent) => {
                                                              e.stopPropagation();
                                                              copyToClipboard(accountState.accountChange.data.owner, `owner-${accountState.accountChange.data.owner}`);
                                                            }}
                                                            aria-label={`Copy owner address ${accountState.accountChange.data.owner}`}
                                                            className="sm:hidden flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
                                                          >
                                                            {copiedStates[`owner-${accountState.accountChange.data.owner}`] ? (
                                                              <CheckIcon className="h-2.5 w-2.5 text-green-500" />
                                                            ) : (
                                                              <ClipboardIcon className="h-2.5 w-2.5" />
                                                            )}
                                                          </button>
                                                          <span className="text-right">
                                                            <span className="hidden sm:inline">{accountState.accountChange.data.owner}</span>
                                                            <span className="sm:hidden">{truncateOwnerAddress(accountState.accountChange.data.owner)}</span>
                                                          </span>
                                                        </div>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <div className="inline-block w-16 text-left">Data:</div>
                                                      {getAccountViewMode(address) === 'parsed' 
                                                        ? (
                                                          <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                            {extractProgramData(accountState.accountChange.data.data)}
                                                          </div>
                                                        )
                                                        : (
                                                          <div className="font-mono text-xs bg-black/20 p-2 rounded border border-gray-600/30 whitespace-pre overflow-x-auto mt-0.5 w-full">
                                                            {getHexData(accountState.accountChange.data.data)}
                                                          </div>
                                                        )
                                                      }
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {!hasChanges && (
                                              <div className="bg-gray-700/20 border border-gray-500/30 p-2 rounded text-gray-400 text-xs">
                                                No changes to this account
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Log Messages */}
                            {profile.logMessages && profile.logMessages.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-500 mb-2 font-semibold">LOGS</div>
                                <div className="bg-black/80 border border-gray-600 rounded p-3 font-mono text-xs max-h-32 overflow-y-auto">
                                  <div className="space-y-1">
                                    {profile.logMessages.map((log: string, logIndex: number) => (
                                      <div key={logIndex} className="text-green-400">
                                        <span className="text-gray-500">[{logIndex.toString().padStart(3, '0')}]</span> {log}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Error Message */}
                            {profile.errorMessage && (
                              <div>
                                <div className="text-xs text-red-400 mb-2 font-semibold">ERROR</div>
                                <div className="bg-red-900/20 border border-red-500/30 p-3 rounded text-red-300 text-xs">
                                  {profile.errorMessage}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </>
              )}

              {/* Legacy Instructions View (fallback) */}
              {!transactionProfile && selectedTransaction.transaction?.message?.instructions && (
                <>
                  <div className="text-sm font-semibold text-zinc-200 mb-3">INSTRUCTIONS</div>
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
                </>
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