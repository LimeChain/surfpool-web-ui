'use client';

import { Stat } from '@/app/stat';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { useWorkspaceContext } from '@/contexts/workspace-context';

export default function Home() {
  let workspace = useWorkspaceContext();
  let user = workspace?.data?.user;
  let shouldCreatePat = false;
  if (workspace?.expectedRedirect && workspace?.expectedRedirect?.startsWith('http://localhost:8488')) {
    shouldCreatePat = true;
  }
  // workspace?.helpers.nhostClient.auth.createPAT()
  return (
    <div className='p-8'>
      <Heading>Good afternoon, {user?.displayName}</Heading>
      {workspace?.expectedRedirect ? <div className="text-sm font-small uppercase text-zinc-300 mt-8">Redirecting to: {workspace?.expectedRedirect}...</div>  : <div/>}
    </div>
  );
}
