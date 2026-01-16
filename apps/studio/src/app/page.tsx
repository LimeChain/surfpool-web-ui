'use client';

import ExplorerHeader from '@/components/svm/explorer-header';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeContent() {
  const searchParams = useSearchParams();
  const initialTransaction = searchParams?.get('t') || undefined;

  return (
    <div className="flex flex-col justify-between">
      <div className="flex w-full flex-row items-start gap-8">
        <ExplorerHeader initialTransactionSignature={initialTransaction} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex flex-col justify-between"><div className="flex w-full flex-row items-start gap-8" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
