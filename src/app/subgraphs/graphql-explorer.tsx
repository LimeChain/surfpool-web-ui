import { useEffect, useMemo, useState } from 'react'
import { GraphiQL } from 'graphiql';
import 'graphiql/setup-workers/webpack';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { explorerPlugin } from '@graphiql/plugin-explorer';
import 'graphiql/style.css';
import '@graphiql/plugin-explorer/style.css';
import '@/styles/graphiql.css';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { useAppConfig } from '@/hooks/use-app-config';

const explorer = explorerPlugin();

export default function GraphQLExplorer() {
  const [isMounted, setIsMounted] = useState(false);
  const { graphqlUrl, loading: configLoading, error: configError } = useAppConfig();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetcher = useMemo(() => {
    return createGraphiQLFetcher({
      url: graphqlUrl,
    });
  }, [isMounted, graphqlUrl]);

  const style = {
    height: '100vh',
  };

  // Show loading state while config is being fetched
  if (configLoading) {
    return (
      <div style={style} className="flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading GraphQL configuration...</div>
      </div>
    );
  }

  // Show error state if config failed to load
  if (configError) {
    return (
      <div style={style} className="flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-lg text-red-600 dark:text-red-400">
          Failed to load GraphQL configuration: {configError}
        </div>
      </div>
    );
  }

  // Don't render until mounted and config is loaded
  if (!isMounted) {
    return (
      <div style={style} className="flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-300">Initializing GraphQL Explorer...</div>
      </div>
    );
  }

  return (
    <GraphiQL 
      fetcher={fetcher}
      plugins={[explorer]}
      style={style}
      shouldPersistHeaders />
  )
} 