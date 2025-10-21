import { SlotsGrid } from '@/components/svm/slot-grid';
import { useAppConfig } from '@/hooks/use-app-config';
import Faucet from './faucet';
import { LabeledLink } from './labeled-link';

const ExplorerHeader = () => {
  const { rpcUrl, wsUrl, rpcDatasourceUrl, loading: configLoading, error: configError } = useAppConfig();

  return (
    <div className="mt-8 grid w-full grid-cols-1 items-start gap-8 md:grid-cols-[1fr_350px]">
      <div className="flex w-full flex-col gap-8">
        <SlotsGrid />

        <div className="mt-4 flex w-full flex-col gap-0">
          <h2 className="text-sm font-medium tracking-wide text-white uppercase">SURFNET</h2>
          <div className="flex w-full gap-2">
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
      <div className="-mt-5 w-full md:w-[350px] md:max-w-[350px] md:min-w-[350px]">
        <Faucet />
      </div>
    </div>
  );
};

export default ExplorerHeader;
