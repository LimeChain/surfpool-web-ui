"use client"

import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { useTransactionStream, formatSignature, formatTime, getTransactionStatus, getTransactionPrograms } from '@/lib/solana-transaction-stream';
import { useAppConfig } from '@/hooks/use-app-config';

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

  return (
    <div className="w-full mx-auto space-y-6 flex flex-col gap-4">
      <div className="mb-0">
        <h2 className="text-sm font-medium text-white uppercase tracking-wide">Transaction Logs</h2>
      </div>
      
      <div className='bg-[#262629] rounded-lg p-4'>
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
        <div className="space-y-3 max-h-96 overflow-y-auto">
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
                  className={`rounded-lg bg-[#232323] p-4 ${statusColors[status as keyof typeof statusColors]}`}
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
                    <div className="text-xs text-gray-500">
                      {formatTime(tx.blockTime)}
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
                        Error: {JSON.stringify(tx.meta.err)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
} 