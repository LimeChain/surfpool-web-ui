import { useEffect, useMemo, useState } from 'react'
import { GraphiQL } from 'graphiql';
import 'graphiql/setup-workers/webpack';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { explorerPlugin } from '@graphiql/plugin-explorer';
import 'graphiql/style.css';
import '@graphiql/plugin-explorer/style.css';
import '@/styles/graphiql.css';
import { useWorkspaceContext } from '@/contexts/workspace-context';

const explorer = explorerPlugin();

export default function GraphQLExplorer() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetcher = useMemo(() => {
    return createGraphiQLFetcher({
      url: "http://127.0.0.1:8488/gql/v1/graphql",
    });
  }, [isMounted]);

  const style = {
    height: '100vh',
  };

  return (
    <GraphiQL 
      fetcher={fetcher}
      plugins={[explorer]}
      style={style}
      shouldPersistHeaders />
  )
} 