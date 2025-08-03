'use client';

import { Badge } from '@/components/catalyst/badge';
import { Dialog, DialogBody } from '@/components/catalyst/dialog';
import { useAppConfig } from '@/hooks/use-app-config';
import { formatSignature, getTransactionStatus, useTransactionStream } from '@/lib/solana-transaction-stream';
import { CheckIcon, ClipboardIcon, TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { diff } from 'fast-myers-diff';

// Enhanced diff algorithm using fast-myers-diff
const computeSmartDiff = (beforeBytes: number[], afterBytes: number[]) => {
  const diffResult = Array.from(diff(beforeBytes, afterBytes));
  const diffMap = new Map<number, { type: 'insert' | 'delete' | 'modify' | 'unchanged', value?: number, beforeValue?: number, afterValue?: number }>();
  
  // Process each diff region
  for (const [sx, ex, sy, ey] of diffResult) {
    if (sx === ex && sy !== ey) {
      // Pure insertion: no bytes deleted, new bytes inserted
      for (let i = sy; i < ey; i++) {
        diffMap.set(i, { type: 'insert', value: afterBytes[i] });
      }
    } else if (sx !== ex && sy === ey) {
      // Pure deletion: bytes deleted, no new bytes inserted
      for (let i = sx; i < ex; i++) {
        diffMap.set(i, { type: 'delete', value: beforeBytes[i] });
      }
    } else if (sx !== ex && sy !== ey) {
      // Replacement: bytes deleted and new bytes inserted
      // Mark deleted bytes
      for (let i = sx; i < ex; i++) {
        diffMap.set(i, { type: 'delete', value: beforeBytes[i] });
      }
      // Mark inserted bytes
      for (let i = sy; i < ey; i++) {
        diffMap.set(i, { type: 'insert', value: afterBytes[i] });
      }
    }
  }
  
  return diffMap;
};


// Client-side only component - will be hydrated on the client

// Shared sub-components
interface LamportsDisplayProps {
  lamports: number;
  label?: string;
  className?: string;
}

const LamportsDisplay: React.FC<LamportsDisplayProps> = ({ lamports, label, className = "" }) => {
  const formattedValue = lamports >= 1000000 
    ? `${(lamports / 1000000000).toFixed(9).replace(/\.?0+$/, '')} SOL`
    : lamports;

  return (
    <span className={`rounded px-2 py-0.5 text-[12px] font-medium border border-gray-500/30 text-gray-300 ${className}`}>
      {formattedValue}
    </span>
  );
};

interface OwnerDisplayProps {
  owner: string;
  copiedStates: Record<string, boolean>;
  copyToClipboard: (text: string, id: string) => void;
  truncateAddress: (address: string) => string;
  copyId: string;
  className?: string;
}

interface AddressDisplayProps {
  address: string;
  copiedStates: Record<string, boolean>;
  copyToClipboard: (text: string, id: string) => void;
  truncateAddress: (address: string) => string;
  copyId: string;
  className?: string;
  showCopyButton?: boolean;
  aggressiveTruncate?: boolean;
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({ 
  address, 
  copiedStates, 
  copyToClipboard, 
  truncateAddress, 
  copyId,
  className = "",
  showCopyButton = true,
  aggressiveTruncate = false
}) => {
  const { rpcUrl } = useAppConfig();
  const displayAddress = aggressiveTruncate 
    ? address.length <= 8 ? address : `${address.slice(0, 4)}⋯${address.slice(-4)}`
    : truncateAddress(address);

  const explorerUrl = `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-xs text-gray-300 font-mono">
        {aggressiveTruncate ? (
          <>
            <span className="md:hidden">
              {address.length <= 8 ? address : `${address.slice(0, 4)}⋯${address.slice(-4)}`}
            </span>
            <span className="hidden md:inline">
              {truncateAddress(address)}
            </span>
          </>
        ) : (
          displayAddress
        )}
      </span>
      {showCopyButton && (
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            copyToClipboard(address, copyId);
          }}
          aria-label={`Copy address ${address}`}
          className="flex h-4 w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-300"
        >
          {copiedStates[copyId] ? (
            <CheckIcon className="h-2.5 w-2.5 text-green-500" />
          ) : (
            <ClipboardIcon className="h-2.5 w-2.5" />
          )}
        </button>
      )}
      <button
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          window.open(explorerUrl, '_blank');
        }}
        aria-label={`Open ${address} in Solana Explorer`}
        className="flex h-4 w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-300"
      >
        <ArrowTopRightOnSquareIcon className="h-2.5 w-2.5" />
      </button>
    </div>
  );
};

const OwnerDisplay: React.FC<OwnerDisplayProps> = ({ 
  owner, 
  copiedStates, 
  copyToClipboard, 
  truncateAddress, 
  copyId,
  className = "" 
}) => {
  return (
    <AddressDisplay
      address={owner}
      copiedStates={copiedStates}
      copyToClipboard={copyToClipboard}
      truncateAddress={truncateAddress}
      copyId={copyId}
      className={className}
    />
  );
};

interface DataDisplayProps {
  data: any;
  address: string;
  context?: string;
  getAccountViewMode: (address: string, context?: string) => string;
  extractProgramData: (data: any) => any;
  getHexData: (data: any) => string;
  getHexDataResponsive: (data: any) => string;
  hasJsonData: (data: any) => boolean;
  isDragOver: Record<string, boolean>;
  droppedIdl: Record<string, any>;
  handleDragOver: (e: React.DragEvent, address: string) => void;
  handleDragLeave: (e: React.DragEvent, address: string) => void;
  handleDrop: (e: React.DragEvent, address: string) => void;
  registerIdl: (address: string) => void;
  toggleAccountViewMode: (address: string, context?: string) => void;
  className?: string;
}

const DataDisplay: React.FC<DataDisplayProps> = ({
  data,
  address,
  context,
  getAccountViewMode,
  extractProgramData,
  getHexData,
  getHexDataResponsive,
  hasJsonData,
  isDragOver,
  droppedIdl,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  registerIdl,
  toggleAccountViewMode,
  className = ""
}) => {
  return (
    <div className={`w-full overflow-x-auto bg-zinc-950 p-2 font-mono text-xs whitespace-pre ${className}`}>
      {getAccountViewMode(address, context) === 'parsed' ? (
        <div 
          ref={(el) => {
            if (el && typeof window !== 'undefined') {
              try {
                el.innerHTML = `<pretty-json expand="2" class="font-mono text-xs" style="--key-color: #60a5fa; --arrow-color: #6b7280; --brace-color: #6b7280; --bracket-color: #6b7280; --string-color: #a855f7; --number-color: #f59e0b; --null-color: #6b7280; --boolean-color: #f59e0b; --comma-color: #6b7280; --ellipsis-color: #6b7280; --indent: 1rem; --font-family: monospace; --font-size: 0.75rem;">${extractProgramData(data)}</pretty-json>`;
              } catch (error) {
                el.innerHTML = `<pre class="font-mono text-xs">${JSON.stringify(extractProgramData(data), null, 2)}</pre>`;
              }
            }
          }}
        />
      ) : (
        <div className="font-mono text-xs">
          {getHexDataResponsive(data)}
        </div>
      )}
      
      {/* IDL Drop Zone - Only show if no JSON data */}
      {!hasJsonData(data) && (
        <div
          className={`mt-2 w-full rounded border-2 border-dotted p-3 text-center transition-colors ${
            isDragOver[address] 
              ? 'border-blue-400 bg-blue-900/20' 
              : droppedIdl[address]
                ? 'border-green-400 bg-green-900/20'
                : 'border-gray-500 bg-gray-900/20'
          }`}
          onDragOver={(e) => handleDragOver(e, address)}
          onDragLeave={(e) => handleDragLeave(e, address)}
          onDrop={(e) => handleDrop(e, address)}
        >
          {droppedIdl[address] ? (
            <div className="space-y-2">
              <div className="text-xs text-green-400">
                ✓ IDL file loaded: {Object.keys(droppedIdl[address].accounts || {}).length} accounts, {Object.keys(droppedIdl[address].instructions || {}).length} instructions
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  registerIdl(address);
                }}
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                Register IDL
              </button>
            </div>
          ) : (
            <div className="text-[12px] font-medium text-gray-400 uppercase">
              DROP IDL.JSON FILE TO GET DATA DECODED
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface LamportsComparisonProps {
  beforeLamports: number;
  afterLamports: number;
}

const LamportsComparison: React.FC<LamportsComparisonProps> = ({ beforeLamports, afterLamports }) => {
  const hasChange = beforeLamports !== afterLamports;
  const smallerAmount = Math.min(beforeLamports, afterLamports);
  const largerAmount = Math.max(beforeLamports, afterLamports);
  
  return (
    <div className="flex items-center gap-1">
      {hasChange && (
        <>
          <LamportsDisplay 
            lamports={beforeLamports} 
            className={beforeLamports === smallerAmount ? "border-red-500/30 text-red-300" : "border-green-500/30 text-green-300"}
          />
          <span className="text-xs text-gray-500">→</span>
        </>
      )}
      <LamportsDisplay 
        lamports={afterLamports} 
        className={hasChange ? (afterLamports === smallerAmount ? "border-red-500/30 text-red-300" : "border-green-500/30 text-green-300") : ''}
      />
    </div>
  );
};

interface OwnerComparisonProps {
  beforeOwner: string;
  afterOwner: string;
  copiedStates: Record<string, boolean>;
  copyToClipboard: (text: string, id: string) => void;
  truncateAddress: (address: string) => string;
}

const OwnerComparison: React.FC<OwnerComparisonProps> = ({ 
  beforeOwner, 
  afterOwner, 
  copiedStates, 
  copyToClipboard, 
  truncateAddress 
}) => {
  const hasChange = beforeOwner !== afterOwner;
  
  return (
    <div className="flex items-center gap-3">
      {hasChange && (
        <>
          <AddressDisplay
            address={beforeOwner}
            copiedStates={copiedStates}
            copyToClipboard={copyToClipboard}
            truncateAddress={truncateAddress}
            copyId={`owner-pre-${beforeOwner}`}
            aggressiveTruncate={true}
          />
          <span className="text-xs text-gray-500">→</span>
        </>
      )}
      <AddressDisplay
        address={afterOwner}
        copiedStates={copiedStates}
        copyToClipboard={copyToClipboard}
        truncateAddress={truncateAddress}
        copyId={`owner-post-${afterOwner}`}
        aggressiveTruncate={true}
      />
    </div>
  );
};

interface DataComparisonProps {
  beforeData: any;
  afterData: any;
  address: string;
  context?: string;
  getAccountViewMode: (address: string, context?: string) => string;
  extractProgramData: (data: any) => any;
  getHexData: (data: any) => string;
  getHexDataForUpdates: (data: any) => string;
  hasJsonData: (data: any) => boolean;
  isDragOver: Record<string, boolean>;
  droppedIdl: Record<string, any>;
  handleDragOver: (e: React.DragEvent, address: string) => void;
  handleDragLeave: (e: React.DragEvent, address: string) => void;
  handleDrop: (e: React.DragEvent, address: string) => void;
  registerIdl: (address: string) => void;
  toggleAccountViewMode: (address: string, context?: string) => void;
  renderJsonDiff: (beforeJson: any, afterJson: any, isRed: boolean) => any;
}

const DataComparison: React.FC<DataComparisonProps> = ({
  beforeData,
  afterData,
  address,
  context,
  getAccountViewMode,
  extractProgramData,
  getHexData,
  getHexDataForUpdates,
  hasJsonData,
  isDragOver,
  droppedIdl,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  registerIdl,
  toggleAccountViewMode,
  renderJsonDiff,
}) => {
  const hasChange = getAccountViewMode(address, context) === 'parsed' 
    ? JSON.stringify(extractProgramData(beforeData)) !== JSON.stringify(extractProgramData(afterData))
    : getHexData(beforeData) !== getHexData(afterData);

  return (
    <div className="w-full overflow-x-auto border-t border-gray-600/30 bg-black/20 p-3 font-mono text-xs whitespace-pre">
      {getAccountViewMode(address, context) === 'parsed' ? (
        <div>
          {hasChange ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div>
                <div className="mb-1 text-xs text-gray-500">BEFORE</div>
                <div className="pr-0 md:pr-2">
                  {renderJsonDiff(extractProgramData(beforeData), extractProgramData(afterData), true)}
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-gray-600/30 pt-2 md:pt-0 md:pl-2 mt-2 md:mt-0">
                <div className="mb-1 text-xs text-gray-500">AFTER</div>
                <div>
                  {renderJsonDiff(extractProgramData(beforeData), extractProgramData(afterData), false)}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-xs text-gray-500">AFTER</div>
              <div>
                <div 
                  ref={(el) => {
                    if (el && typeof window !== 'undefined') {
                      try {
                        el.innerHTML = `<pretty-json expand="2" class="font-mono text-xs" style="--key-color: #60a5fa; --arrow-color: #6b7280; --brace-color: #6b7280; --bracket-color: #6b7280; --string-color: #a855f7; --number-color: #f59e0b; --null-color: #6b7280; --boolean-color: #f59e0b; --comma-color: #6b7280; --ellipsis-color: #6b7280; --indent: 1rem; --font-family: monospace; --font-size: 0.75rem;">${extractProgramData(afterData)}</pretty-json>`;
                      } catch (error) {
                        el.innerHTML = `<pre class="font-mono text-xs">${JSON.stringify(extractProgramData(afterData), null, 2)}</pre>`;
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {hasChange ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div>
                <div className="mb-1 text-xs text-gray-500">BEFORE</div>
                <div className="pr-0 md:pr-2">
                  <div 
                    className="font-mono text-xs"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        // Convert data to strings for comparison
                        const getDataString = (data: any) => {
                          if (typeof data === 'object' && data !== null) {
                            if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
                              try {
                                return atob(data[0]);
                              } catch (error) {
                                return data[0] || '';
                              }
                            }
                            return JSON.stringify(data);
                          }
                          return String(data);
                        };
                        
                                                 const beforeStr = getDataString(beforeData);
                         const afterStr = getDataString(afterData);
                         
                         // Generate hex dump with fast-myers-diff highlighting
                         const beforeBytes = Array.from(beforeStr).map((char) => (char as string).charCodeAt(0));
                         const afterBytes = Array.from(afterStr).map((char) => (char as string).charCodeAt(0));
                        const diffMap = computeSmartDiff(beforeBytes, afterBytes);
                        const lines = [];

                        for (let i = 0; i < beforeBytes.length; i += 16) {
                          const beforeLineBytes = beforeBytes.slice(i, i + 16);

                          // Hex representation with fast-myers-diff highlighting
                          const beforeHexParts = beforeLineBytes.map((byte, index) => {
                            const globalIndex = i + index;
                            const diffEntry = diffMap.get(globalIndex);
                            
                            let highlightClass = '';
                            if (diffEntry) {
                              if (diffEntry.type === 'delete') {
                                highlightClass = 'text-red-600 bg-red-900/20';
                              }
                            }
                            
                            const hex = byte.toString(16).padStart(2, '0').toUpperCase();
                            return highlightClass ? `<span class="${highlightClass}">${hex}</span>` : hex;
                          });

                          const beforeHexPart = beforeHexParts.join(' ');

                          // Line number (offset)
                          const offset = i.toString(16).padStart(4, '0').toUpperCase();

                          // Create line with only hex (no ASCII)
                          lines.push(`<span class="text-gray-500">${offset}:</span> ${beforeHexPart}`);
                        }

                        return lines.join('\n').replace(/\n/g, '<br>');
                      })()
                    }}
                  />
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-gray-600/30 pt-2 md:pt-0 md:pl-2 mt-2 md:mt-0">
                <div className="mb-1 text-xs text-gray-500">AFTER</div>
                <div>
                  <div 
                    className="font-mono text-xs"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        // Convert data to strings for comparison
                        const getDataString = (data: any) => {
                          if (typeof data === 'object' && data !== null) {
                            if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
                              try {
                                return atob(data[0]);
                              } catch (error) {
                                return data[0] || '';
                              }
                            }
                            return JSON.stringify(data);
                          }
                          return String(data);
                        };
                        
                        const beforeStr = getDataString(beforeData);
                        const afterStr = getDataString(afterData);
                        
                                                 // Generate hex dump with fast-myers-diff highlighting
                                                 const beforeBytes = Array.from(beforeStr).map((char) => (char as string).charCodeAt(0));
                         const afterBytes = Array.from(afterStr).map((char) => (char as string).charCodeAt(0));
                        const diffMap = computeSmartDiff(beforeBytes, afterBytes);
                        const lines = [];

                        for (let i = 0; i < afterBytes.length; i += 16) {
                          const afterLineBytes = afterBytes.slice(i, i + 16);

                          // Hex representation with fast-myers-diff highlighting
                          const afterHexParts = afterLineBytes.map((byte, index) => {
                            const globalIndex = i + index;
                            const diffEntry = diffMap.get(globalIndex);
                            
                            let highlightClass = '';
                            if (diffEntry) {
                              if (diffEntry.type === 'insert') {
                                highlightClass = 'text-green-600 bg-green-900/20';
                              }
                            }
                            
                            const hex = byte.toString(16).padStart(2, '0').toUpperCase();
                            return highlightClass ? `<span class="${highlightClass}">${hex}</span>` : hex;
                          });

                          const afterHexPart = afterHexParts.join(' ');

                          // Line number (offset)
                          const offset = i.toString(16).padStart(4, '0').toUpperCase();

                          // Create line with only hex (no ASCII)
                          lines.push(`<span class="text-gray-500">${offset}:</span> ${afterHexPart}`);
                        }

                        return lines.join('\n').replace(/\n/g, '<br>');
                      })()
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-xs text-gray-500">AFTER</div>
              <div>
                {getHexDataForUpdates(afterData)}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* IDL Drop Zone - Only show if no JSON data */}
      {!hasJsonData(beforeData) && !hasJsonData(afterData) && (
        <div
          className={`mt-3 w-full rounded border-2 border-dotted p-3 text-center transition-colors ${
            isDragOver[address] 
              ? 'border-blue-400 bg-blue-900/20' 
              : droppedIdl[address]
                ? 'border-green-400 bg-green-900/20'
                : 'border-gray-500 bg-gray-900/20'
          }`}
          onDragOver={(e) => handleDragOver(e, address)}
          onDragLeave={(e) => handleDragLeave(e, address)}
          onDrop={(e) => handleDrop(e, address)}
        >
          {droppedIdl[address] ? (
            <div className="space-y-2">
              <div className="text-xs text-green-400">
                ✓ IDL file loaded: {Object.keys(droppedIdl[address].accounts || {}).length} accounts, {Object.keys(droppedIdl[address].instructions || {}).length} instructions
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  registerIdl(address);
                }}
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                Register IDL
              </button>
            </div>
          ) : (
            <div className="text-[12px] font-medium text-gray-400 uppercase">
              DROP IDL.JSON FILE TO GET DATA DECODED
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Wrap external library imports in try-catch for Fast Refresh compatibility
let jsonDiff: any;
let prettyJsonCustomElement: any;

// Only load browser-specific libraries on the client side
if (typeof window !== 'undefined') {
  try {
    jsonDiff = require('json-diff');
    require('pretty-json-custom-element');
  } catch (error) {
    console.warn('Failed to load json-diff or pretty-json-custom-element:', error);
    jsonDiff = { diffString: () => '' };
  }
} else {
  // Server-side fallback
  jsonDiff = { diffString: () => '' };
}


interface TransactionStreamProps {
  rpcUrl?: string;
  wsUrl?: string;
  maxTransactions?: number;
  autoStart?: boolean;
  filterByProgram?: string;
  filterByAccount?: string;
}

interface AccountDetailsProps {
  address: string;
  accountData: any;
  accountType: 'create' | 'delete' | 'read';
  copiedStates: Record<string, boolean>;
  getAccountViewMode: (address: string, context?: string) => string;
  copyToClipboard: (text: string, id: string) => void;
  extractProgramData: (data: any) => any;
  getHexData: (data: any) => string;
  getHexDataResponsive: (data: any) => string;
  hasJsonData: (data: any) => boolean;
  truncateAddress: (address: string) => string;
  isDragOver: Record<string, boolean>;
  droppedIdl: Record<string, any>;
  handleDragOver: (e: React.DragEvent, address: string) => void;
  handleDragLeave: (e: React.DragEvent, address: string) => void;
  handleDrop: (e: React.DragEvent, address: string) => void;
  registerIdl: (address: string) => void;
  toggleAccountViewMode: (address: string, context?: string) => void;
}

interface UpdateAccountDetailsProps {
  address: string;
  accountData: any;
  copiedStates: Record<string, boolean>;
  getAccountViewMode: (address: string, context?: string) => string;
  copyToClipboard: (text: string, id: string) => void;
  extractProgramData: (data: any) => any;
  getHexData: (data: any) => string;
  getHexDataForUpdates: (data: any) => string;
  hasJsonData: (data: any) => boolean;
  truncateAddress: (address: string) => string;
  highlightDifferences: (beforeValue: any, afterValue: any, isRed: boolean) => any;
  renderJsonDiff: (beforeJson: any, afterJson: any, isRed: boolean) => any;
  isDragOver: Record<string, boolean>;
  droppedIdl: Record<string, any>;
  handleDragOver: (e: React.DragEvent, address: string) => void;
  handleDragLeave: (e: React.DragEvent, address: string) => void;
  handleDrop: (e: React.DragEvent, address: string) => void;
  registerIdl: (address: string) => void;
  toggleAccountViewMode: (address: string, context?: string) => void;
}

const AccountDetails: React.FC<AccountDetailsProps> = ({
  address,
  accountData,
  accountType,
  copiedStates,
  getAccountViewMode,
  copyToClipboard,
  extractProgramData,
  getHexData,
  getHexDataResponsive,
  hasJsonData,
  truncateAddress,
  isDragOver,
  droppedIdl,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  registerIdl,
  toggleAccountViewMode,
}) => {
  const context = accountType;
  const getLamportsLabel = () => {
    if (accountType === 'delete') return 'LAMPORTS REMOVED';
    if (accountType === 'read') return 'LAMPORTS';
    return 'LAMPORTS ADDED';
  };

  return (
    <div className="space-y-4 text-xs text-gray-400">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 px-5">{getLamportsLabel()}</span>
        <span className="text-right pr-5">
          <LamportsDisplay lamports={accountData.lamports} />
        </span>
      </div>
      {accountData.owner && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 px-5">
            <span className="hidden sm:inline">ACCOUNT OWNER</span>
            <span className="sm:hidden">OWNER</span>
          </span>
          <OwnerDisplay
            owner={accountData.owner}
            copiedStates={copiedStates}
            copyToClipboard={copyToClipboard}
            truncateAddress={truncateAddress}
            copyId={`owner-${accountData.owner}`}
            className="mr-5"
          />
        </div>
      )}
      <div className="space-y-0">
        <div className="flex items-center justify-between px-5 pb-2">
          <div className="text-xs font-semibold text-gray-500">DATA</div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountViewMode(address, context);
              }}
              className={`transition-colors ${
                getAccountViewMode(address, context) === 'parsed'
                  ? 'font-medium text-white'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              Pretty
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountViewMode(address, context);
              }}
              className={`transition-colors ${
                getAccountViewMode(address, context) === 'hex'
                  ? 'font-medium text-white'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              Hex
            </button>
          </div>
        </div>
        <DataDisplay
          data={accountData.data}
          address={address}
          context={context}
          getAccountViewMode={getAccountViewMode}
          extractProgramData={extractProgramData}
          getHexData={getHexData}
          getHexDataResponsive={getHexDataResponsive}
          hasJsonData={hasJsonData}
          isDragOver={isDragOver}
          droppedIdl={droppedIdl}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          registerIdl={registerIdl}
          toggleAccountViewMode={toggleAccountViewMode}
        />
      </div>
    </div>
  );
};

const UpdateAccountDetails: React.FC<UpdateAccountDetailsProps> = ({
  address,
  accountData,
  copiedStates,
  getAccountViewMode,
  copyToClipboard,
  extractProgramData,
  getHexData,
  getHexDataForUpdates,
  hasJsonData,
  truncateAddress,
  highlightDifferences,
  renderJsonDiff,
  isDragOver,
  droppedIdl,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  registerIdl,
  toggleAccountViewMode,
}) => {
  const context = 'update';
  return (
      <div className="space-y-3">
        {/* Lamports Field */}
        <div className="flex items-center justify-between px-5">
          <span className={`text-xs font-semibold ${accountData[0].lamports !== accountData[1].lamports ? 'text-yellow-400' : 'text-gray-400'}`}>LAMPORTS</span>
          <LamportsComparison 
            beforeLamports={accountData[0].lamports}
            afterLamports={accountData[1].lamports}
          />
        </div>

        {/* Owner Field */}
        {accountData[0].owner && (
          <div className="flex items-center justify-between px-5">
            <span className={`text-xs font-semibold ${accountData[0].owner !== accountData[1].owner ? 'text-yellow-400' : 'text-gray-400'}`}>
              <span className="hidden sm:inline">ACCOUNT OWNER</span>
              <span className="sm:hidden">OWNER</span>
            </span>
            <OwnerComparison
              beforeOwner={accountData[0].owner}
              afterOwner={accountData[1].owner}
              copiedStates={copiedStates}
              copyToClipboard={copyToClipboard}
              truncateAddress={truncateAddress}
            />
          </div>
        )}

        {/* Data Field */}
        <div className="space-y-0">
          <div className="flex items-center justify-between px-5 pb-2">
            <div className={`text-xs font-semibold ${
              (getAccountViewMode(address) === 'parsed' 
                ? JSON.stringify(extractProgramData(accountData[0].data)) !== JSON.stringify(extractProgramData(accountData[1].data))
                : getHexData(accountData[0].data) !== getHexData(accountData[1].data)
              ) ? 'text-yellow-400' : 'text-gray-400'
            }`}>DATA</div>
            <div className="flex items-center gap-2 text-xs">
                          <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountViewMode(address, context);
              }}
              className={`transition-colors ${
                getAccountViewMode(address, context) === 'parsed'
                  ? 'font-medium text-white'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              Pretty
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountViewMode(address, context);
              }}
              className={`transition-colors ${
                getAccountViewMode(address, context) === 'hex'
                  ? 'font-medium text-white'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              Hex
            </button>
            </div>
          </div>
          <DataComparison
            beforeData={accountData[0].data}
            afterData={accountData[1].data}
            address={address}
            context={context}
            getAccountViewMode={getAccountViewMode}
            extractProgramData={extractProgramData}
            getHexData={getHexData}
            getHexDataForUpdates={getHexDataForUpdates}
            hasJsonData={hasJsonData}
            isDragOver={isDragOver}
            droppedIdl={droppedIdl}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            registerIdl={registerIdl}
            toggleAccountViewMode={toggleAccountViewMode}
            renderJsonDiff={renderJsonDiff}
          />
        </div>
      </div>
  );
};

export default function TransactionStream({
  rpcUrl: propRpcUrl,
  wsUrl: propWsUrl,
  maxTransactions = 50,
  autoStart = true,
  filterByProgram,
  filterByAccount,
}: TransactionStreamProps) {
  const [isClient, setIsClient] = useState(false);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fast Refresh safeguard - ensure component re-mounts cleanly
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // This helps Fast Refresh work better with complex state
      return () => {
        // Cleanup on unmount for Fast Refresh
      };
    }
  }, []);
  const { rpcUrl: configRpcUrl, wsUrl: configWsUrl } = useAppConfig();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionProfile, setTransactionProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Map<string, boolean>>(new Map());
  const [accountViewModes, setAccountViewModes] = useState<Map<string, 'parsed' | 'hex'>>(new Map());
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set());
  const [defaultInstructionsExpanded, setDefaultInstructionsExpanded] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [droppedIdl, setDroppedIdl] = useState<{ [address: string]: any }>({});
  const [isDragOver, setIsDragOver] = useState<{ [address: string]: boolean }>({});

  // Move the large JSON object inside the component and memoize it
  const mockTransactionProfile = useMemo(() => ({
    slot: 123,
    key: '0c2441a4-85b4-4eed-802e-855a66da721d',
    instructionProfiles: [
      {
        accountStates: {
          '1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM': {
            type: 'writable',
            accountChange: {
              type: 'create',
              data: {
                lamports: 10000000001,
                data: {
                  program: 'custom-program',
                  parsed: {
                    field1: 'value1',
                    field2: 'value2',
                  },
                  space: 50,
                },
                owner: '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh',
                executable: false,
                rentEpoch: 0,
                space: 100,
              },
            },
          },
          '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh': {
            type: 'readonly',
          },
        },
        computeUnitsConsumed: 50000,
        logMessages: ['Log message: Creating Account', 'Log message: Account created'],
        errorMessage: null,
      },
      {
        accountStates: {
          '1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM': {
            type: 'writable',
            accountChange: {
              type: 'update',
              data: [
                {
                  lamports: 10000000001,
                  data: {
                    program: 'custom-program',
                    parsed: {
                      field1: 'value1',
                      field2: 'value2',
                    },
                    space: 50,
                  },
                  owner: '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdx',
                  executable: false,
                  rentEpoch: 0,
                  space: 100,
                },
                {
                  lamports: 90,
                  data: {
                    program: 'custom-program',
                    parsed: {
                      field1: 'updated-value1',
                      field2: 'updated-value2',
                    },
                    space: 50,
                  },
                  owner: '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh',
                  executable: false,
                  rentEpoch: 0,
                  space: 100,
                },
              ],
            },
          },
          '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh': {
            type: 'readonly',
          },
        },
        computeUnitsConsumed: 20000,
        logMessages: ['Log message: Updating Account', 'Log message: Account updated'],
        errorMessage: null,
      },
      {
        accountStates: {
          '1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM': {
            type: 'writable',
            accountChange: {
              type: 'delete',
              data: {
                lamports: 100,
                data: {
                  program: 'custom-program',
                  parsed: {
                    field1: 'updated-value1',
                    field2: 'updated-value2',
                  },
                  space: 50,
                },
                owner: '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh',
                executable: false,
                rentEpoch: 0,
                space: 100,
              },
            },
          },
          '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh': {
            type: 'readonly',
          },
        },
        computeUnitsConsumed: 10000,
        logMessages: ['Log message: Deleting Account', 'Log message: Account deleted'],
        errorMessage: null,
      },
    ],
    transactionProfile: {
      accountStates: {
        '1111111QLbz7JHiBTspS962RLKV8GndWFwiEaqKM': {
          type: 'writable',
          accountChange: {
            type: 'unchanged',
          },
        },
        '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh': {
          type: 'readonly',
        },
      },
      computeUnitsConsumed: 10000,
      logMessages: [
        'Log message: Creating Account',
        'Log message: Account created',
        'Log message: Updating Account',
        'Log message: Account updated',
        'Log message: Deleting Account',
        'Log message: Account deleted',
      ],
      errorMessage: null,
    },
    readonlyAccountStates: {
      '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh': {
        lamports: 100,
        data: ['ABCDEFG', 'base64'],
        owner: '1111111ogCyDbaRMvkdsHB3qfdyFYaG1WtRUAfdh',
        executable: false,
        rentEpoch: 0,
        space: 100,
      },
    },
  }), []);

  // Use props if provided, otherwise use config values
  const rpcUrl = propRpcUrl || configRpcUrl;
  const wsUrl = propWsUrl || configWsUrl;
  const { transactions, isStreaming, error, stats, toggleStreaming, clearTransactions } = useTransactionStream({
    rpcUrl,
    wsUrl,
    maxTransactions,
    autoStart,
    filterByProgram,
    filterByAccount,
  });

  const toggleAccountExpansion = (instructionIndex: number, address: string) => {
    const key = `${instructionIndex}:${address}`;
    setExpandedAccounts((prev) => {
      const newMap = new Map(prev);
      const currentState = newMap.get(key);
      newMap.set(key, !currentState);
      return newMap;
    });
  };

  const isAccountExpanded = (instructionIndex: number, address: string, hasChanges: boolean) => {
    const key = `${instructionIndex}:${address}`;
    // Default: all accounts collapsed
    const defaultExpanded = false;
    // If the address has been explicitly set, use that value, otherwise use the default
    return expandedAccounts.has(key) ? expandedAccounts.get(key)! : defaultExpanded;
  };

  const getAccountViewMode = (address: string, context?: string) => {
    const key = context ? `${address}-${context}` : address;
    return accountViewModes.get(key) || 'parsed';
  };

  const toggleAccountViewMode = (address: string, context?: string) => {
    const key = context ? `${address}-${context}` : address;
    setAccountViewModes((prev) => {
      const newMap = new Map(prev);
      const currentMode = newMap.get(key) || 'parsed';
      newMap.set(key, currentMode === 'parsed' ? 'hex' : 'parsed');
      return newMap;
    });
  };

  const toggleInstructionExpansion = (index: number) => {
    setExpandedInstructions((prev) => {
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

  const handleDragOver = (e: React.DragEvent, address: string) => {
    e.preventDefault();
    setIsDragOver((prev) => ({ ...prev, [address]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, address: string) => {
    e.preventDefault();
    setIsDragOver((prev) => ({ ...prev, [address]: false }));
  };

  const handleDrop = (e: React.DragEvent, address: string) => {
    e.preventDefault();
    setIsDragOver((prev) => ({ ...prev, [address]: false }));
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.name.endsWith('.json'));
    
    if (jsonFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const idl = JSON.parse(event.target?.result as string);
          setDroppedIdl((prev) => ({ ...prev, [address]: idl }));
        } catch (error) {
          console.error('Error parsing IDL file:', error);
        }
      };
      reader.readAsText(jsonFile);
    }
  };

  const registerIdl = (address: string) => {
    // Here you would typically send the IDL to your backend or store it
    console.log('Registering IDL for address:', address, droppedIdl[address]);
    // For now, we'll just log it
    alert(`IDL registered for ${address}`);
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}⋯${address.slice(-8)}`;
  };

  const getHexData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      // If it's a base64 array, decode and convert to hex
      if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
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

  const getHexDataResponsive = (data: any, isSmallScreen: boolean = false) => {
    if (typeof data === 'object' && data !== null) {
      // If it's a base64 array, decode and convert to hex
      if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
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

  const getHexDataForUpdates = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      // If it's a base64 array, decode and convert to hex
      if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
        try {
          const decoded = atob(data[0]);
          return formatHexOnly(decoded);
        } catch (error) {
          return data[0] || '<none>';
        }
      }
      // For other objects, convert to hex representation
      const jsonStr = JSON.stringify(data);
      return formatHexOnly(jsonStr);
    }
    // For strings, convert to hex
    const str = String(data);
    if (str === '' || str === 'null' || str === 'undefined') return '<none>';
    return formatHexOnly(str);
  };





  const formatHexDump = (data: string) => {
    const bytes = Array.from(data).map((char) => char.charCodeAt(0));
    const lines = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const lineBytes = bytes.slice(i, i + 16);

      // Hex representation
      const hexPart = lineBytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      // ASCII representation
      const asciiPart = lineBytes
        .map((byte) => {
          if (byte >= 32 && byte <= 126) {
            return String.fromCharCode(byte);
          } else {
            return '.';
          }
        })
        .join('');

      // Line number (offset)
      const offset = i.toString(16).padStart(4, '0').toUpperCase();

      // Create line with ASCII pushed to extreme right
      const hexSection = `${offset}: ${hexPart}`;
      const asciiSection = `|${asciiPart}|`;

      lines.push(`${hexSection.padEnd(70)}${asciiSection}`);
    }

    return lines.join('\n');
  };

  const formatHexOnly = (data: string) => {
    const bytes = Array.from(data).map((char) => char.charCodeAt(0));
    const lines = [];

    for (let i = 0; i < bytes.length; i += 16) {
      const lineBytes = bytes.slice(i, i + 16);

      // Hex representation
      const hexPart = lineBytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      // Line number (offset)
      const offset = i.toString(16).padStart(4, '0').toUpperCase();

      // Create line with only hex (no ASCII)
      lines.push(`${offset}: ${hexPart}`);
    }

    return lines.join('\n');
  };

  // Helper function to extract programData from parsed data
  const hasJsonData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      // Check if it has the parsed structure with programData
      if (data.parsed && data.parsed.info && data.parsed.info.programData) {
        return true;
      }

      // Check if it's a base64 array format: ["base64string", "base64"]
      if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
        try {
          const decoded = atob(data[0]);
          return decoded !== '' && decoded !== '<none>';
        } catch (error) {
          return data[0] !== '' && data[0] !== '<none>';
        }
      }

      // Check if it's a meaningful JSON object (not empty)
      try {
        const jsonStr = JSON.stringify(data);
        return jsonStr !== '{}' && jsonStr !== 'null' && jsonStr !== 'undefined';
      } catch (error) {
        return false;
      }
    }
    const stringValue = String(data);
    return stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined' && stringValue !== '<none>';
  };

  const extractProgramData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      // Check if it has the parsed structure with programData
      if (data.parsed && data.parsed.info && data.parsed.info.programData) {
        return data.parsed.info.programData;
      }

      // Check if it's a base64 array format: ["base64string", "base64"]
      if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
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
      lines.forEach((line: string) => {
        if (line.startsWith('-') || line.startsWith('+')) {
          // Extract field name from lines like: -    field1: "value1"
          const match = line.match(/^\s*[-+]\s*(\w+):/);
          if (match) {
            changedFields.add(match[1]);
          }
        }
      });


      // Split into lines and process each line
      const jsonLines = jsonString.split('\n');
      const processedLines = jsonLines.map((line, index) => {
        const trimmedLine = line.trim();

        // Check if this line contains a changed field
        const hasChangedValue = Array.from(changedFields).some((field) => {
          return trimmedLine.includes(`"${field}"`);
        });

        if (hasChangedValue) {
          const colorClass = isRed
            ? 'text-red-500 bg-red-900/30 font-bold'
            : 'text-green-500 bg-green-900/30 font-bold';
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

      // Mock response using the memoized transaction profile
      const mockResponse = mockTransactionProfile;

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log('📊 Mock transaction profile response:', mockResponse);
      setTransactionProfile(mockResponse);
      
      // Expand all instructions by default
      if (mockResponse.instructionProfiles && mockResponse.instructionProfiles.length > 0) {
        const allInstructionIndices = new Set(mockResponse.instructionProfiles.map((_: any, index: number) => index));
        setExpandedInstructions(allInstructionIndices);
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

  // Show loading state during SSR (after all hooks are called)
  if (!isClient) {
    return (
      <div className="mx-auto flex w-full flex-col gap-4 space-y-6">
        <div className="mb-0 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-white uppercase">Recent Transactions</h2>
        </div>
        <div className="flex h-[280px] items-center justify-center rounded-lg border border-zinc-600">
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="mb-2 text-lg font-medium text-zinc-300">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-4 space-y-6">
      <div className="mb-0 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-white uppercase">Recent Transactions</h2>
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-zinc-600 bg-zinc-800 px-3">
            <div
              className={`h-2 w-2 rounded-full ${
                stats.connectionStatus === 'connected'
                  ? 'bg-green-400'
                  : stats.connectionStatus === 'connecting'
                    ? 'bg-yellow-400'
                    : stats.connectionStatus === 'error'
                      ? 'bg-red-400'
                      : 'bg-gray-500'
              }`}
            />
            <span className="text-sm text-gray-300">{wsUrl}</span>
          </div>
          <button
            onClick={clearTransactions}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 transition-colors hover:bg-zinc-700"
            title="Clear transaction logs"
          >
            <TrashIcon className="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div className="rounded-lg">
        {error && (
          <div className="mb-4 rounded border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Transactions List */}
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-zinc-600">
              <div className="text-center">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="mb-2 text-lg font-medium text-zinc-300">No transactions</div>
                <div className="max-w-md text-sm text-zinc-500">
                  Send transactions on your Surfnet to get detailed simulations, performance profiling, and data
                  indexing
                </div>
              </div>
            </div>
          ) : (
            transactions.map((tx, index) => {
              const status = getTransactionStatus(tx);
              const statusColors = {
                success: 'border-l-[3px] border-[#60d695]',
                failed: 'border-l-[3px] border-[#ff6b6b]',
                pending: 'border-l-[3px] border-[#606060]',
              };

              const badgeColors = {
                success: 'green',
                failed: 'red',
                pending: 'zinc',
              };

              return (
                <div
                  key={`${tx.transaction.signatures[0]}-${index}`}
                  className={`bg-zinc-800 p-4 ${statusColors[status as keyof typeof statusColors]} cursor-pointer transition-colors hover:bg-zinc-700`}
                  onClick={() => handleTransactionClick(tx)}
                >
                  <div className="mb-0 flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="hidden font-mono text-sm text-gray-300 lg:inline">
                          {formatSignature(tx.transaction.signatures[0])}
                        </span>
                        <span className="font-mono text-sm text-gray-300 lg:hidden">
                          {formatSignature(tx.transaction.signatures[0]).slice(0, 8)}⋯
                          {formatSignature(tx.transaction.signatures[0]).slice(-8)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(
                              formatSignature(tx.transaction.signatures[0]),
                              `sig-${tx.transaction.signatures[0]}`
                            );
                          }}
                          className="ml-1 flex h-4 w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-300 sm:hidden"
                        >
                          <ClipboardIcon className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <Badge color={badgeColors[status as keyof typeof badgeColors] as any} className="w-fit text-xs">
                        {status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-col justify-center text-right text-xs text-gray-400">
                      <div className="tracking-wide text-gray-500 uppercase">SLOT</div>
                      <div className="font-mono font-bold text-white">{tx.slot}</div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-400">
                    {tx.meta?.err && <div className="text-red-400">Error: {String(tx.meta.err)}</div>}
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
                <div className="rounded-lg bg-zinc-800/50 p-4">
                  <div className="mb-2 text-xs text-gray-500">Status</div>
                  <Badge
                    color={
                      getTransactionStatus(selectedTransaction) === 'success'
                        ? 'green'
                        : getTransactionStatus(selectedTransaction) === 'failed'
                          ? 'red'
                          : 'zinc'
                    }
                    className="text-sm"
                  >
                    {getTransactionStatus(selectedTransaction).toUpperCase()}
                  </Badge>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-4">
                  <div className="mb-2 text-xs text-gray-500">Compute Units Consumed</div>
                  <div className="font-mono text-sm">
                    {transactionProfile && transactionProfile.instructionProfiles
                      ? transactionProfile.instructionProfiles.reduce(
                          (sum: number, profile: any) => sum + (profile.computeUnitsConsumed || 0),
                          0
                        )
                      : selectedTransaction.meta.computeUnitsConsumed || 'Unknown'}
                  </div>
                </div>

                {selectedTransaction.meta ? (
                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-2 text-xs text-gray-500">Fee</div>
                    <div className="font-mono text-sm">{selectedTransaction.meta.fee || 0} lamports</div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-2 text-xs text-gray-500">Fee</div>
                    <div className="font-mono text-sm">0 lamports</div>
                  </div>
                )}
              </div>

              {/* Transaction Header */}
              {selectedTransaction.transaction?.message?.header && (
                <div className="rounded-lg bg-zinc-800/50 p-4">
                  <div className="mb-2 text-xs text-gray-500">Transaction Header</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Required Signatures</div>
                      <div className="font-mono">
                        {selectedTransaction.transaction.message.header.numRequiredSignatures}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Readonly Signed</div>
                      <div className="font-mono">
                        {selectedTransaction.transaction.message.header.numReadonlySignedAccounts}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Readonly Unsigned</div>
                      <div className="font-mono">
                        {selectedTransaction.transaction.message.header.numReadonlyUnsignedAccounts}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedTransaction.meta?.err && (
                <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-4">
                  <div className="mb-2 text-xs text-red-400">Error Details</div>
                  <div className="text-sm text-red-300">{String(selectedTransaction.meta.err)}</div>
                </div>
              )}

              {/* Transaction Profile - New Detailed View */}
              {transactionProfile && (
                <>
                  <div className="mb-3 text-sm font-semibold text-zinc-200">CU Profiling</div>

                  {/* Compute Units Stack Bar */}
                  {transactionProfile.instructionProfiles && transactionProfile.instructionProfiles.length > 0 && (
                    <div className="mb-8">
                      <div className="mb-3 text-xs text-gray-500">Estimated CU Breakdown per Instruction</div>
                      <div className="flex h-6 overflow-hidden rounded-md border border-zinc-600">
                        {transactionProfile.instructionProfiles.map((profile: any, index: number) => {
                          const cu = profile.computeUnitsConsumed || 0;
                          const totalCu = transactionProfile.instructionProfiles.reduce(
                            (sum: number, profile: any) => sum + (profile.computeUnitsConsumed || 0),
                            0
                          ) || 1;
                          const percentage = (cu / totalCu) * 100;

                          // macOS-style colors for different instruction types
                          const colors = [
                            'bg-blue-500', // Blue
                            'bg-green-500', // Green
                            'bg-orange-500', // Orange
                            'bg-purple-500', // Purple
                            'bg-red-500', // Red
                            'bg-yellow-500', // Yellow
                            'bg-pink-500', // Pink
                            'bg-indigo-500', // Indigo
                          ];
                          const colorClass = colors[index % colors.length];

                          return (
                            <div
                              key={index}
                              className={`${colorClass} group relative cursor-pointer transition-all duration-200 hover:brightness-110`}
                              style={{ width: `${percentage}%` }}
                              title={`Instruction ${index}: ${cu} CU (${percentage.toFixed(1)}%)`}
                            >
                              {/* Tooltip on hover */}
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded bg-black/90 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                Instruction {index}: {cu} CU
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="mt-3 flex flex-wrap gap-3">
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
                              <div className={`h-3 w-3 rounded ${colorClass}`}></div>
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
                        'bg-blue-500', // Blue
                        'bg-green-500', // Green
                        'bg-orange-500', // Orange
                        'bg-purple-500', // Purple
                        'bg-red-500', // Red
                        'bg-yellow-500', // Yellow
                        'bg-pink-500', // Pink
                        'bg-indigo-500', // Indigo
                      ];

                      return (
                        <div key={index} className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/50">
                          {/* Instruction Header */}
                          <div
                            className="cursor-pointer border-b border-zinc-700 bg-zinc-900/50 p-3 transition-colors hover:bg-zinc-900/70"
                            onClick={() => toggleInstructionExpansion(index)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`mr-2 ${
                                      colors[index % colors.length] === 'bg-blue-500'
                                        ? 'text-blue-500'
                                        : colors[index % colors.length] === 'bg-green-500'
                                          ? 'text-green-500'
                                          : colors[index % colors.length] === 'bg-orange-500'
                                            ? 'text-orange-500'
                                            : colors[index % colors.length] === 'bg-purple-500'
                                              ? 'text-purple-500'
                                              : colors[index % colors.length] === 'bg-red-500'
                                                ? 'text-red-500'
                                                : colors[index % colors.length] === 'bg-yellow-500'
                                                  ? 'text-yellow-500'
                                                  : colors[index % colors.length] === 'bg-pink-500'
                                                    ? 'text-pink-500'
                                                    : colors[index % colors.length] === 'bg-indigo-500'
                                                      ? 'text-indigo-500'
                                                      : 'text-gray-500'
                                    }`}
                                  >
                                    {expandedInstructions.has(index) ? '▼' : '▶'}
                                  </span>
                                  <div className="text-sm font-semibold text-zinc-200">Instruction #{index}</div>
                                </div>

                                {profile.errorMessage && (
                                  <Badge color="red" className="text-xs">
                                    ERROR
                                  </Badge>
                                )}
                              </div>
                              <div className="font-mono text-xs font-semibold text-white">
                                {profile.computeUnitsConsumed || 0} CU
                              </div>
                            </div>
                          </div>

                          {/* Instruction Content */}
                          {expandedInstructions.has(index) && (
                            <div className="space-y-4 p-4">
                              {/* Account States */}
                              {profile.accountStates && (
                                <div>
                                  <div className="mb-2 text-xs font-semibold text-gray-500">ACCOUNT STATES</div>
                                  <div className="rounded border border-zinc-600 bg-zinc-900/30 overflow-hidden">
                                    {Object.entries(profile.accountStates).map(
                                      ([address, accountState]: [string, any], accountIndex: number) => {

                                        const isWritable = accountState.type === 'writable';
                                        const hasChanges =
                                          accountState.accountChange && accountState.accountChange.type !== 'unchanged';
                                        const isFirst = accountIndex === 0;
                                        const isLast = accountIndex === Object.entries(profile.accountStates).length - 1;
                                        
                                        const getHoverClasses = () => {
                                          if (hasChanges && accountState.accountChange.type === 'create') {
                                            return "hover:bg-green-900/40";
                                          } else if (hasChanges && accountState.accountChange.type === 'update') {
                                            return "hover:bg-blue-900/40";
                                          } else if (hasChanges && accountState.accountChange.type === 'delete') {
                                            return "hover:bg-red-900/40";
                                          } else if (!hasChanges && !isWritable) {
                                            return "hover:bg-gray-700/40";
                                          } else {
                                            return "hover:bg-zinc-800/40";
                                          }
                                        };

                                        const getSeparatorClasses = () => {
                                          return "";
                                        };

                                                                                return (
                                          <div key={address}>
                                            <div
                                              className={`bg-zinc-900/30 p-3 ${getHoverClasses()} transition-colors`}
                                            >
                                              <div
                                                className="flex cursor-pointer items-center justify-between px-2 py-1 font-mono text-xs text-gray-400"
                                                onClick={() => toggleAccountExpansion(index, address)}
                                              >
                                                <div className="flex items-center">
                                                  {hasChanges && accountState.accountChange.type === 'create' && (
                                                    <span className="mr-2 rounded px-2 py-0.5 text-[10px] font-medium border border-green-500/30 bg-green-900/30 text-green-300">
                                                      NEW ACCOUNT
                                                    </span>
                                                  )}
                                                  {hasChanges && accountState.accountChange.type === 'update' && (
                                                    <span className="mr-2 rounded px-2 py-0.5 text-[10px] font-medium border border-blue-500/30 bg-blue-900/30 text-blue-300">
                                                      UPDATED ACCOUNT
                                                    </span>
                                                  )}
                                                  {hasChanges && accountState.accountChange.type === 'delete' && (
                                                    <span className="mr-2 rounded px-2 py-0.5 text-[10px] font-medium border border-red-500/30 bg-red-900/30 text-red-300">
                                                      DELETED ACCOUNT
                                                    </span>
                                                  )}
                                                  {!hasChanges && !isWritable && (
                                                    <span className="mr-2 rounded px-2 py-0.5 text-[10px] font-medium border border-gray-500/30 text-gray-300">
                                                      READ ACCOUNT
                                                    </span>
                                                  )}
                                                  <AddressDisplay
                                                    address={address}
                                                    copiedStates={copiedStates}
                                                    copyToClipboard={copyToClipboard}
                                                    truncateAddress={truncateAddress}
                                                    copyId={`account-${address}`}
                                                    className="font-semibold text-gray-300"
                                                    showCopyButton={true}
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {isAccountExpanded(index, address, hasChanges) && (
                                                <div className="bg-zinc-950 pt-5">
                                                  {hasChanges && accountState.accountChange.type === 'create' && (
                                                    <AccountDetails
                                                      address={address}
                                                      accountData={accountState.accountChange.data}
                                                      accountType="create"
                                                      copiedStates={copiedStates}
                                                      getAccountViewMode={getAccountViewMode}
                                                      copyToClipboard={copyToClipboard}
                                                      extractProgramData={extractProgramData}
                                                      getHexData={getHexData}
                                                      getHexDataResponsive={getHexDataResponsive}
                                                      hasJsonData={hasJsonData}
                                                      truncateAddress={truncateAddress}
                                                      isDragOver={isDragOver}
                                                      droppedIdl={droppedIdl}
                                                      handleDragOver={handleDragOver}
                                                      handleDragLeave={handleDragLeave}
                                                      handleDrop={handleDrop}
                                                      registerIdl={registerIdl}
                                                      toggleAccountViewMode={toggleAccountViewMode}
                                                    />
                                                  )}

                                                {hasChanges && accountState.accountChange.type === 'update' && (
                                                  <UpdateAccountDetails
                                                    address={address}
                                                    accountData={accountState.accountChange.data}
                                                    copiedStates={copiedStates}
                                                    getAccountViewMode={getAccountViewMode}
                                                    copyToClipboard={copyToClipboard}
                                                    extractProgramData={extractProgramData}
                                                    getHexData={getHexData}
                                                    getHexDataForUpdates={getHexDataForUpdates}
                                                    hasJsonData={hasJsonData}
                                                    truncateAddress={truncateAddress}
                                                    highlightDifferences={highlightDifferences}
                                                    renderJsonDiff={renderJsonDiff}
                                                    isDragOver={isDragOver}
                                                    droppedIdl={droppedIdl}
                                                    handleDragOver={handleDragOver}
                                                    handleDragLeave={handleDragLeave}
                                                    handleDrop={handleDrop}
                                                    registerIdl={registerIdl}
                                                    toggleAccountViewMode={toggleAccountViewMode}
                                                  />
                                                )}

                                                {hasChanges && accountState.accountChange.type === 'delete' && (
                                                  <AccountDetails
                                                    address={address}
                                                    accountData={accountState.accountChange.data}
                                                    accountType="delete"
                                                    copiedStates={copiedStates}
                                                    getAccountViewMode={getAccountViewMode}
                                                    copyToClipboard={copyToClipboard}
                                                    extractProgramData={extractProgramData}
                                                    getHexData={getHexData}
                                                    getHexDataResponsive={getHexDataResponsive}
                                                    hasJsonData={hasJsonData}
                                                    truncateAddress={truncateAddress}
                                                    isDragOver={isDragOver}
                                                    droppedIdl={droppedIdl}
                                                    handleDragOver={handleDragOver}
                                                    handleDragLeave={handleDragLeave}
                                                    handleDrop={handleDrop}
                                                    registerIdl={registerIdl}
                                                    toggleAccountViewMode={toggleAccountViewMode}
                                                  />
                                                )}

                                                {!hasChanges && transactionProfile.readonlyAccountStates && transactionProfile.readonlyAccountStates[address] && (
                                                  <AccountDetails
                                                    address={address}
                                                    accountData={transactionProfile.readonlyAccountStates[address]}
                                                    accountType="read"
                                                    copiedStates={copiedStates}
                                                    getAccountViewMode={getAccountViewMode}
                                                    copyToClipboard={copyToClipboard}
                                                    extractProgramData={extractProgramData}
                                                    getHexData={getHexData}
                                                    getHexDataResponsive={getHexDataResponsive}
                                                    hasJsonData={hasJsonData}
                                                    truncateAddress={truncateAddress}
                                                    isDragOver={isDragOver}
                                                    droppedIdl={droppedIdl}
                                                    handleDragOver={handleDragOver}
                                                    handleDragLeave={handleDragLeave}
                                                    handleDrop={handleDrop}
                                                    registerIdl={registerIdl}
                                                    toggleAccountViewMode={toggleAccountViewMode}
                                                  />
                                                )}
                                                {!hasChanges && (!transactionProfile.readonlyAccountStates || !transactionProfile.readonlyAccountStates[address]) && (
                                                  <div className="rounded border border-gray-500/30 bg-gray-700/20 p-2 text-xs text-gray-400">
                                                    No changes to this account
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          {!isLast && (
                                            <div className="h-px bg-zinc-500/20 mx-3"></div>
                                          )}
                                        </div>
                                      );
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Log Messages */}
                              {profile.logMessages && profile.logMessages.length > 0 && (
                                <div>
                                  <div className="mb-2 text-xs font-semibold text-gray-500">LOGS</div>
                                  <div className="max-h-32 overflow-y-auto rounded border border-gray-600 bg-black/80 p-3 font-mono text-xs">
                                    <div className="space-y-1">
                                      {profile.logMessages.map((log: string, logIndex: number) => (
                                        <div key={logIndex} className="text-emerald-400">
                                          <span className="text-gray-500">
                                            [{logIndex.toString().padStart(3, '0')}]
                                          </span>{' '}
                                          {log}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Error Message */}
                              {profile.errorMessage && (
                                <div>
                                  <div className="mb-2 text-xs font-semibold text-red-400">ERROR</div>
                                  <div className="rounded border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-300">
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
                  <div className="mb-3 text-sm font-semibold text-zinc-200">INSTRUCTIONS</div>
                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-2 text-xs text-gray-500">
                      Instructions ({selectedTransaction.transaction.message.instructions.length})
                    </div>
                    <div className="max-h-48 space-y-3 overflow-y-auto">
                      {selectedTransaction.transaction.message.instructions.map((instruction: any, index: number) => (
                        <div key={index} className="border-l-2 border-zinc-600 pl-3">
                          <div className="mb-1 font-mono text-xs text-gray-300">
                            <span className="text-gray-500">#{index}:</span>{' '}
                            {instruction.programId || 'Unknown Program'}
                          </div>
                          {instruction.accounts && instruction.accounts.length > 0 && (
                            <div className="ml-4 text-xs text-gray-400">
                              <div className="mb-1 text-gray-500">Accounts:</div>
                              <div className="space-y-1">
                                {instruction.accounts.map((acc: any, accIndex: number) => (
                                  <div key={accIndex} className="flex items-start gap-2">
                                    <span className="w-6 text-gray-500">{accIndex}:</span>
                                    <span className="break-all">
                                      {typeof acc === 'object' && acc !== null ? JSON.stringify(acc) : String(acc)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {instruction.data && (
                            <div className="mt-1 ml-4 text-xs text-gray-400">
                              <div className="mb-1 text-gray-500">Data:</div>
                              <div className="rounded bg-zinc-900/50 p-2 font-mono break-all">{instruction.data}</div>
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
            <div className="py-8 text-center text-gray-500">No transaction selected</div>
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
}
