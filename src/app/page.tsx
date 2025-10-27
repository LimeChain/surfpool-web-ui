'use client';

import ExplorerHeader from '@/components/svm/explorer-header';

export default function Home() {
  return (
    <div className="flex flex-col justify-between">
      <div className="flex w-full flex-row items-start gap-8">
        <ExplorerHeader />
      </div>
    </div>
  );
}
