"use client"

import dynamic from "next/dynamic";
const GraphQLExplorer = dynamic(() => import("@/app/subgraphs/graphql-explorer"), { ssr: false });

export default function Subgraphs() {
  return <GraphQLExplorer />;
}
