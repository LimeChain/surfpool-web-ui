'use client';

import ExplorerHeader from '@/components/explorer-header';
import TransactionLogs from '@/components/svm/transaction-logs';

export default function Home() {

   return (
    <div className="p-2 flex flex-col justify-between">
      <div className="flex flex-row w-full gap-8 items-start">
        <ExplorerHeader/>
      </div>
      <div className="w-full mt-24">
        <TransactionLogs />
      </div>
    </div>
  );
}