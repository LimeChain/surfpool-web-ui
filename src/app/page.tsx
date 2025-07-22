'use client';

import { Stat } from '@/app/stat';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import MainContent from '@/components/MainContent';
import TransactionSteps from '@/components/svm/transaction-steps';

export default function Home() {
  let workspace = useWorkspaceContext();
  let user = workspace?.data?.user;


   return (
    <div className="p-8 min-h-screen flex flex-col justify-between">
      <div className="flex flex-row w-full gap-8 items-start">
        <MainContent workspace={workspace} user={user} />
      </div>
      <div className="flex w-full gap-8 flex-col mt-8 items-start">
        <TransactionSteps />
      </div>
    </div>
  );
}