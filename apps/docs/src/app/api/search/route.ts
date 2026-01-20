import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';
import {
  cheatcodeEndpoints,
  accountsEndpoints,
  transactionEndpoints,
  nodeEndpoints,
  networkEndpoints,
  adminEndpoints,
  type Endpoint,
} from '@/lib/rpc-endpoints';

// Map RPC category to URL path
const categoryUrlMap: Record<string, string> = {
  cheatcodes: '/rpc/cheatcodes',
  accounts: '/rpc/accounts',
  transactions: '/rpc/transactions',
  node: '/rpc/node',
  network: '/rpc/network',
  admin: '/rpc/admin',
};

// Map RPC category to breadcrumb label
const categoryBreadcrumbMap: Record<string, string> = {
  cheatcodes: 'Cheatcodes',
  accounts: 'Accounts',
  transactions: 'Transactions',
  node: 'Node',
  network: 'Network',
  admin: 'Admin',
};

// Convert an RPC endpoint to a search index entry
function endpointToSearchIndex(endpoint: Endpoint, category: string) {
  const baseUrl = categoryUrlMap[category];
  const methodId = endpoint.method_name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Build content from method name, description, and parameter info
  const paramContent = endpoint.params
    .map((p) => `${p.name}: ${p.description}`)
    .join('. ');

  const content = [
    endpoint.method_name,
    endpoint.description,
    paramContent,
  ].filter(Boolean).join('. ');

  return {
    title: endpoint.method_name,
    description: endpoint.description,
    content,
    url: `${baseUrl}#${methodId}`,
    breadcrumbs: ['RPC', categoryBreadcrumbMap[category]],
    keywords: endpoint.method_name,
  };
}

// Get all RPC endpoints as search indexes
function getRpcSearchIndexes() {
  const categories: Array<{ endpoints: Endpoint[]; category: string }> = [
    { endpoints: cheatcodeEndpoints, category: 'cheatcodes' },
    { endpoints: accountsEndpoints, category: 'accounts' },
    { endpoints: transactionEndpoints, category: 'transactions' },
    { endpoints: nodeEndpoints, category: 'node' },
    { endpoints: networkEndpoints, category: 'network' },
    { endpoints: adminEndpoints, category: 'admin' },
  ];

  return categories.flatMap(({ endpoints, category }) =>
    endpoints.map((endpoint) => endpointToSearchIndex(endpoint, category))
  );
}

// Get page indexes from fumadocs source
function getPageSearchIndexes() {
  return source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description,
    content: page.data.structuredData?.contents
      ?.map((c) => c.content)
      .join(' ') ?? '',
    url: page.url,
  }));
}

export const { GET } = createSearchAPI('simple', {
  indexes: [...getPageSearchIndexes(), ...getRpcSearchIndexes()],
});
