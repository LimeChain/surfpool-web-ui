'use client';

import { Stat } from '@/app/stat';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { SlotsGrid } from '@/components/svm/slot-grid';
import Faucet from '@/components/svm/faucet';
import TransactionSteps from '@/components/svm/transaction-steps';

export default function Home() {
  let workspace = useWorkspaceContext();
  let user = workspace?.data?.user;
  let shouldCreatePat = false;
  if (workspace?.expectedRedirect && workspace?.expectedRedirect?.startsWith('http://localhost:8488')) {
    shouldCreatePat = true;
  }
  // workspace?.helpers.nhostClient.auth.createPAT()
  return (
    <div className='p-8 min-h-screen bg-zinc-950'>
      <Heading>Hello, {user?.displayName} welcome to Surfpool Studio</Heading>
      {workspace?.expectedRedirect ? <div className="text-sm font-small uppercase text-zinc-300 mt-8">Redirecting to: {workspace?.expectedRedirect}...</div>  : <div/>} 
      <div className="flex w-full gap-8 mt-8 items-start">
        <div className="flex-[3]">
          <SlotsGrid />
        </div>
        <div className="flex-[2]">
          <Faucet />
        </div>
      </div>
      <TransactionSteps />
    </div>
  );
}
