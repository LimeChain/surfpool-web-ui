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
  actions?: ScenarioAction[];
};

export type ScenarioAction = {
  protocolId: string;
  actionId: string;
  protocol: string;
  action: string;
};

export default function handler(_req: NextApiRequest, res: NextApiResponse<ScenariosResponseData>) {
  // Mock data for demonstration - replace with actual database query
  const mockScenarios: Scenario[] = [
    {
      id: '1',
      name: 'Triangular Arbitrage: BTC/USD → BTC/ETH → ETH/USD',
      description: 'Exploit price discrepancies across three trading pairs to capture arbitrage profit',
      status: 'completed',
      created_at: new Date('2024-10-15').toISOString(),
      updated_at: new Date('2024-10-15').toISOString(),
      steps: [
        {
          id: '1-1',
          name: 'Slot 0',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'pyth', actionId: 'pyth_set_btc_price', protocol: 'Pyth Oracle', action: 'Set BTC/USD Price: $67,500' },
          ],
        },
        {
          id: '1-2',
          name: 'Slot 1',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'pyth', actionId: 'pyth_set_btc_eth_price', protocol: 'Pyth Oracle', action: 'Set BTC/ETH Price: 20.5 ETH' },
          ],
        },
        {
          id: '1-3',
          name: 'Slot 2',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'pyth', actionId: 'pyth_set_eth_price', protocol: 'Pyth Oracle', action: 'Set ETH/USD Price: $3,350' },
          ],
        },
        {
          id: '1-4',
          name: 'Slot 3',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'jupiter', actionId: 'jupiter_execute_arb', protocol: 'Jupiter', action: 'Execute Arbitrage Swap' },
          ],
        },
      ],
    },
    {
      id: '2',
      name: 'Flash Loan Arbitrage: SOL/USDC Pool Imbalance',
      description: 'Use flash loan to arbitrage price difference between Raydium and Orca pools',
      status: 'active',
      created_at: new Date('2024-10-18').toISOString(),
      updated_at: new Date('2024-10-20').toISOString(),
      steps: [
        {
          id: '2-1',
          name: 'Slot 0',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'raydium', actionId: 'raydium_set_pool_reserves', protocol: 'Raydium', action: 'Set SOL/USDC Pool: 10K SOL' },
          ],
        },
        {
          id: '2-2',
          name: 'Slot 1',
          type: 'slot',
          status: 'running',
          actions: [
            { protocolId: 'whirlpool', actionId: 'orca_set_tick_liquidity', protocol: 'Orca Whirlpools', action: 'Set SOL/USDC Pool: 8K SOL' },
          ],
        },
        {
          id: '2-3',
          name: 'Slot 2',
          type: 'slot',
          status: 'pending',
          actions: [
            { protocolId: 'jupiter', actionId: 'jupiter_set_route', protocol: 'Jupiter', action: 'Route via Raydium → Orca' },
          ],
        },
      ],
    },
    {
      id: '3',
      name: 'Liquidation Cascade: Drift Protocol',
      description: 'Simulate cascading liquidations during volatile price movements',
      status: 'active',
      created_at: new Date('2024-10-20').toISOString(),
      updated_at: new Date('2024-10-21').toISOString(),
      steps: [
        {
          id: '3-1',
          name: 'Slot 0',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'drift', actionId: 'drift_set_collateral', protocol: 'Drift Protocol', action: 'Set User Collateral: 100 SOL' },
            { protocolId: 'pyth', actionId: 'pyth_set_sol_price', protocol: 'Pyth Oracle', action: 'Set SOL Price: $150' },
          ],
        },
        {
          id: '3-2',
          name: 'Slot 1',
          type: 'slot',
          status: 'running',
          actions: [
            { protocolId: 'pyth', actionId: 'pyth_crash_price', protocol: 'Pyth Oracle', action: 'Crash SOL Price: $120 (-20%)' },
          ],
        },
        {
          id: '3-3',
          name: 'Slot 2',
          type: 'slot',
          status: 'pending',
          actions: [
            { protocolId: 'drift', actionId: 'drift_trigger_liquidation', protocol: 'Drift Protocol', action: 'Trigger Liquidation' },
          ],
        },
      ],
    },
    {
      id: '4',
      name: 'Cross-DEX Arbitrage: Jupiter Aggregator',
      description: 'Arbitrage across multiple DEXs using Jupiter\'s smart routing',
      status: 'completed',
      created_at: new Date('2024-10-21').toISOString(),
      updated_at: new Date('2024-10-21').toISOString(),
      steps: [
        {
          id: '4-1',
          name: 'Slot 0',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'raydium', actionId: 'raydium_set_price', protocol: 'Raydium', action: 'Set BONK/SOL: 0.000025' },
            { protocolId: 'whirlpool', actionId: 'orca_set_price', protocol: 'Orca Whirlpools', action: 'Set BONK/SOL: 0.000028' },
          ],
        },
        {
          id: '4-2',
          name: 'Slot 1',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'jupiter', actionId: 'jupiter_find_route', protocol: 'Jupiter', action: 'Find Best Route' },
          ],
        },
        {
          id: '4-3',
          name: 'Slot 2',
          type: 'slot',
          status: 'completed',
          actions: [
            { protocolId: 'jupiter', actionId: 'jupiter_execute_swap', protocol: 'Jupiter', action: 'Execute Multi-hop Swap' },
          ],
        },
      ],
    },
  ];

  res.status(200).json({ scenarios: mockScenarios });
}
