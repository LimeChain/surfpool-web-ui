'use client';

import { CheckIcon, ClipboardIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import React from 'react';
import { aggressiveTruncateAddress } from './lib/address-utils';

interface AddressDisplayProps {
  address: string;
  copiedStates: Record<string, boolean>;
  copyToClipboard: (text: string, id: string) => void;
  truncateAddress: (address: string) => string;
  copyId: string;
  className?: string;
  showCopyButton?: boolean;
  aggressiveTruncate?: boolean;
  rpcUrl: string;
  explorerClusterQuery?: string;
}

// Helper to build explorer URL from query string (handles encoding)
const buildExplorerAddressUrl = (address: string, query: string): string => {
  const params = new URLSearchParams();
  query.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params.set(key, value);
    }
  });
  return `https://explorer.solana.com/address/${address}?${params.toString()}`;
};

const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  copiedStates,
  copyToClipboard,
  truncateAddress,
  copyId,
  className = '',
  showCopyButton = true,
  aggressiveTruncate = false,
  rpcUrl,
  explorerClusterQuery,
}) => {
  // Handle edge cases
  if (!address || address.trim() === '') {
    return <span className="text-xs text-gray-500">No address</span>;
  }

  const explorerUrl = explorerClusterQuery
    ? buildExplorerAddressUrl(address, explorerClusterQuery)
    : `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;

  return (
    <div className={`flex items-center gap-2 sm:gap-1 ${className}`}>
      <span className="text-sm sm:text-xs text-gray-300 font-mono flex-1 min-w-0 break-all">
        {/* Show truncated address when aggressiveTruncate is true, otherwise show full on larger screens */}
        {aggressiveTruncate ? (
          <span className="hidden sm:inline">{truncateAddress(address)}</span>
        ) : (
          <span className="hidden sm:inline">{address}</span>
        )}
        <span className="sm:hidden">
          {aggressiveTruncate ? aggressiveTruncateAddress(address) : address}
        </span>
      </span>
      {showCopyButton && (
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            copyToClipboard(address, copyId);
          }}
          aria-label={`Copy address ${address}`}
          className="flex h-8 w-8 sm:h-4 sm:w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-300 rounded-lg bg-zinc-700 sm:bg-transparent flex-shrink-0"
        >
          {copiedStates[copyId] ? (
            <CheckIcon className="h-4 w-4 sm:h-2.5 sm:w-2.5 text-green-500" />
          ) : (
            <ClipboardIcon className="h-4 w-4 sm:h-2.5 sm:w-2.5" />
          )}
        </button>
      )}
      <button
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          window.open(explorerUrl, '_blank');
        }}
        aria-label={`Open ${address} in Solana Explorer`}
        className="flex h-8 w-8 sm:h-4 sm:w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-300 rounded-lg bg-zinc-700 sm:bg-transparent flex-shrink-0"
      >
        <ArrowTopRightOnSquareIcon className="h-4 w-4 sm:h-2.5 sm:w-2.5" />
      </button>
    </div>
  );
};

export default AddressDisplay;
