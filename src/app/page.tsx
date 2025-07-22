'use client';

import ExplorerHeader from '@/components/explorer-header';
import TransactionSteps from '@/components/svm/transaction-steps';

export default function Home() {

   return (
    <div className="p-2 flex flex-col justify-between">
      <div className="flex flex-row w-full gap-8 items-start">
        <ExplorerHeader/>
      </div>
      <div className="w-full mt-48">
        {/* <TransactionSteps /> */}
      </div>
    </div>
  );
}