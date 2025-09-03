'use client';

import ExplorerHeader from '@/components/svm/explorer-header';
import TransactionsView from '@/components/svm/transactions-view';

export default function Home() {

   return (
    <div className="p-2 flex flex-col justify-between">
      <div className="flex flex-row w-full gap-8 items-start">
        <ExplorerHeader/>
      </div>
      <div className="w-full mt-24">
        <TransactionsView />
      </div>
    </div>
  );
}