import type { NextApiRequest, NextApiResponse } from 'next';

export type ScenariosResponseData = {
  scenarios: Scenario[];
};

export type Scenario = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  steps?: ScenarioStep[];
  metadata?: Record<string, any>;
};

export type ScenarioStep = {
  id: string;
  name: string;
  type: string;
  status?: string;
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<ScenariosResponseData>) {
  // Mock data for demonstration - replace with actual database query
  const mockScenarios: Scenario[] = [
    {
      id: '1',
      name: 'Deploy Token Contract',
      description: 'Deploy a new SPL token contract to the network',
      status: 'completed',
      created_at: new Date('2024-10-15').toISOString(),
      updated_at: new Date('2024-10-15').toISOString(),
      steps: [
        { id: '1-1', name: 'Initialize wallet', type: 'setup', status: 'completed' },
        { id: '1-2', name: 'Deploy contract', type: 'transaction', status: 'completed' },
        { id: '1-3', name: 'Verify deployment', type: 'validation', status: 'completed' },
      ],
      metadata: {
        network: 'devnet',
        tokenSymbol: 'TEST',
      },
    },
    {
      id: '2',
      name: 'NFT Minting Flow',
      description: 'Complete NFT minting process with metadata upload',
      status: 'active',
      created_at: new Date('2024-10-18').toISOString(),
      updated_at: new Date('2024-10-20').toISOString(),
      steps: [
        { id: '2-1', name: 'Upload metadata to IPFS', type: 'upload', status: 'completed' },
        { id: '2-2', name: 'Mint NFT', type: 'transaction', status: 'running' },
        { id: '2-3', name: 'Transfer to wallet', type: 'transaction', status: 'pending' },
      ],
      metadata: {
        collection: 'SurfPool Genesis',
        totalSupply: 1000,
      },
    },
    {
      id: '3',
      name: 'DeFi Integration Test',
      description: 'Test swapping and liquidity provision on DEX',
      status: 'failed',
      created_at: new Date('2024-10-19').toISOString(),
      updated_at: new Date('2024-10-20').toISOString(),
      steps: [
        { id: '3-1', name: 'Connect to DEX', type: 'setup', status: 'completed' },
        { id: '3-2', name: 'Approve tokens', type: 'transaction', status: 'completed' },
        { id: '3-3', name: 'Execute swap', type: 'transaction', status: 'failed' },
      ],
      metadata: {
        dex: 'Raydium',
        pair: 'SOL/USDC',
      },
    },
  ];

  res.status(200).json({ scenarios: mockScenarios });
}
