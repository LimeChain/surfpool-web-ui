import type { NextApiRequest, NextApiResponse } from 'next';
// let retrieveSubgraphs = require("./retrieve_subgraphs.gql");

export type SubgraphsResponseData = {
  subgraphs: Subgraph[];
};

export type Subgraph = {
  id: String;
  name: String;
  online: boolean;
  revisions: SubgraphRevision[];
};

export type SubgraphRevision = {
  id: String;
  number: String;
  description?: String;
  status?: String;
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<SubgraphsResponseData>) {
  // Get data from your database
  res.status(200).json({ subgraphs: [] });
}
