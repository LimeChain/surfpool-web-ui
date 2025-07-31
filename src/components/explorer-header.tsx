import React from 'react';
import { SlotsGrid } from '@/components/svm/slot-grid';
import Faucet from './svm/faucet';
import { LabeledLink } from './svm/labeled-link';
import { useAppConfig } from '@/hooks/use-app-config';

const ExplorerHeader = () => {
  const { rpcUrl, wsUrl, rpcDatasourceUrl, loading: configLoading, error: configError } = useAppConfig();

  return (
  <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8 w-full mt-8 items-start">
    <div className="flex flex-col gap-8 w-full">
      <SlotsGrid />

      <div className="flex flex-col gap-0 w-full mt-4">
        <h2 className="text-sm font-medium text-white uppercase tracking-wide">SURFNET</h2>
        <div className="flex gap-2 w-full">
          <div className="w-1/2">
            <LabeledLink
              endpoint={{
                name: 'RPC URL',
                url: rpcUrl,
              }}
              className="rounded-tl-md"
            />
          </div>
          <div className="w-1/2">
            <LabeledLink
              endpoint={{
                name: 'WS URL',
                url: wsUrl,
              }}
              className="rounded-tr-md"
            />
          </div>
        </div>
        <div className="w-full">
          <LabeledLink
            endpoint={{
              name: 'SOURCE',
              url: rpcDatasourceUrl,
            }}
            className="rounded-b-md"
          />
        </div>
      </div>

    </div>
    <div className="w-full -mt-5 md:w-[350px] md:min-w-[350px] md:max-w-[350px]">
      <Faucet />
    </div>
  </div>
  );
};

export default ExplorerHeader; 