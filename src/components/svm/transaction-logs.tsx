"use client"

import TransactionStream from './transaction-stream';
import { useAppConfig } from '@/hooks/use-app-config';

export default function TransactionLogs() {
  const { rpcUrl, wsUrl, loading: configLoading, error: configError } = useAppConfig();

  if (configLoading) {
    return (
      <div className="w-full">
        <div className="text-sm text-zinc-500">Loading configuration...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="w-full">
        <div className="text-sm text-red-500">Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <TransactionStream 
        maxTransactions={50}
        autoStart={true}
        rpcUrl={rpcUrl}
        wsUrl={wsUrl}
      />
    </div>
  );
} 