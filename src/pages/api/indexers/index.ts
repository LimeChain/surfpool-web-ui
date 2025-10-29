import type { NextApiRequest, NextApiResponse } from 'next';

export type Indexer = {
  id: string;
  name: string;
  description: string | null;
  table_name: string;
  workspace_slug: string;
  filters: any;
  fields: any[];
  source_type: any;
};

export type IndexersResponseData = {
  indexers: Indexer[];
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<IndexersResponseData | { error: string }>
) {
  try {
    // Fetch from the workspace API
    const response = await fetch('http://127.0.0.1:18488/workspace/v1/indexers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch indexers: ${response.status}`);
    }

    const indexers: Indexer[] = await response.json();

    res.status(200).json({ indexers });
  } catch (error) {
    console.error('Error fetching indexers:', error);
    res.status(500).json({ error: 'Failed to fetch indexers' });
  }
}
