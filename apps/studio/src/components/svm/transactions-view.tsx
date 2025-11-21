"use client"

import { useAppConfig } from '@/hooks/use-app-config';
import TransactionInspector from './transaction-inspector';

export default function TransactionsView() {
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
      <TransactionInspector 
        rpcUrl={rpcUrl}
        wsUrl={wsUrl}
        maxTransactions={50}
        autoStart={true}
      />
    </div>
  );
} 