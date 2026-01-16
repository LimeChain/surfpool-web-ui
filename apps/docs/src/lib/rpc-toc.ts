import {
  transactionEndpoints,
  accountsEndpoints,
  cheatcodeEndpoints,
  nodeEndpoints,
  networkEndpoints,
  adminEndpoints,
} from "@/lib/rpc-endpoints";
import { websocketEndpoints } from "@/lib/websocket-endpoints";

export type TocItem = {
  title: string;
  url: string;
  depth: number;
};

function endpointsToToc(endpoints: { method_name: string }[]): TocItem[] {
  return endpoints.map(e => ({
    title: e.method_name,
    url: `#${e.method_name}`,
    depth: 3,
  }));
}

export const rpcTocItems: Record<string, TocItem[]> = {
  "rpc/transactions": endpointsToToc(transactionEndpoints),
  "rpc/accounts": endpointsToToc(accountsEndpoints),
  "rpc/cheatcodes": endpointsToToc(cheatcodeEndpoints),
  "rpc/node": endpointsToToc(nodeEndpoints),
  "rpc/network": endpointsToToc(networkEndpoints),
  "rpc/admin": endpointsToToc(adminEndpoints),
  "rpc/websockets": endpointsToToc(websocketEndpoints),
};
