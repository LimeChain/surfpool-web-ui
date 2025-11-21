import { useConfig } from '@/contexts/config-context'

export const useAppConfig = () => {
  const { config, loading, error, refetch } = useConfig()
  
  return {
    // URLs
    rpcUrl: config?.rpc_url || 'http://127.0.0.1:8899',
    wsUrl: config?.ws_url || 'ws://127.0.0.1:8900',
    rpcDatasourceUrl: config?.rpc_datasource_url || 'https://api.mainnet-beta.solana.com/',
    studioUrl: config?.studio_url || 'http://127.0.0.1:18488',
    graphqlUrl: config?.graphql_query_route_url || 'http://127.0.0.1:18488/gql/v1/graphql',
    
    // State
    loading,
    error,
    refetch,
    
    // Raw config
    config
  }
} 