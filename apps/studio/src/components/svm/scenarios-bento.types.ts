import type { Scenario, ScenarioStep } from '@/lib/scenarios-data';
import type { BentoItem } from './generic-bento';

export interface ScenariosBentoProps {
  scenarios: Scenario[];
  onRefresh?: () => void;
  onDetailPaneChange?: (isOpen: boolean) => void;
  initialSelectedId?: string;
  initialTab?: string;
}

export interface GenerationLog {
  timestamp: string;
  prompt: string;
  modelId: string;
  modelName: string;
  providerName: string;
  protocols: string[];
  response: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface ScenarioBentoItem extends BentoItem {
  created_at?: string;
  updated_at?: string;
  steps?: ScenarioStep[];
  tags?: string[];
}

export interface ExampleScenario {
  label: string;
  prompt: string;
  icon: string;
  protocols: string[];
}

export const exampleScenarios: ExampleScenario[] = [
  {
    label: 'Market Crash',
    prompt: 'SOL crashes from $145 to $85 in 10s, then rebounds to $110',
    icon: '📉',
    protocols: ['pyth'],
  },
  {
    label: 'DEX Arbitrage',
    prompt: 'JTO is 1% cheaper on Raydium AMM than on Raydium CLMM, enabling a SOL → JTO → SOL arbitrage',
    icon: '🔺',
    protocols: ['raydium'],
  },
  {
    label: 'Liquidation Arbitrage',
    prompt:
      'A Kamino obligation worth ~$300k became unhealthy. Whirlpool and Raydium AMM pools are set up to create a profitable liquidation arbitrage path',
    icon: '💰',
    protocols: ['kamino', 'whirlpool', 'raydium'],
  },
  {
    label: 'Triangular Arbitrage',
    prompt:
      'Create a triangular arbitrage opportunity across BTC/USD, ETH/USD, and ETH/BTC price feeds that yields a profitable trading cycle',
    icon: '🔄',
    protocols: ['pyth'],
  },
  {
    label: 'Fresh Launch',
    prompt: "Reset Fartcoin's bonding curve to its fresh launch state so it can be bought from the start again",
    icon: '🚀',
    protocols: ['pump'],
  },
  {
    label: 'Pump Graduation',
    prompt:
      'Create an editable Pump Graduation scenario for token mint <PASTE_TOKEN_MINT_HERE> using the specialized Pump graduation tool. Call the tool exactly once with this tokenMint. If validation fails, report the error and do not retry without tokenMint. Prepare only the three state overrides; do not build buy, migrate, or sell transactions.',
    icon: '🪙',
    protocols: ['pump'],
  },
  {
    label: 'PumpSwap Pool',
    prompt:
      "Set The Official 67 Coin's canonical PumpSwap pool virtual_quote_reserves to 15000000000000 so buying it becomes far more expensive",
    icon: '💧',
    protocols: ['pumpswap'],
  },
  {
    label: 'PumpSwap Price Shock',
    prompt:
      'Create an editable PumpSwap price shock for token mint <PASTE_TOKEN_MINT_HERE> using the specialized PumpSwap price shock tool with virtualQuoteReserves set to "15000000000000". Call the tool exactly once with both values. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '⚡',
    protocols: ['pumpswap'],
  },
  {
    label: 'Phoenix Liquidation Cascade',
    prompt:
      'Create one editable Phoenix Liquidation Cascade scenario for Trader <PASTE_PHOENIX_TRADER_ACCOUNT> on market <PASTE_MARKET_SYMBOL>. Fetch the existing override templates, then call create_scenario once with two overrides: the phoenix-trader-collateral-stress template with quote_lot_collateral "1" at slot 0, and the phoenix-direct-mark-risk-shock template with target_ticks "1" at slot 1, both with fetchBeforeUse enabled. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a liquidation transaction.',
    icon: '🔥',
    protocols: ['phoenix-eternal'],
  },
  {
    label: 'Tessera Stale Quote',
    prompt:
      'Prepare one editable Tessera scenario with a market quote aged to its rejection boundary. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '⏳',
    protocols: ['tessera'],
  },
  {
    label: 'Tessera Depth Stress',
    prompt:
      'Prepare one editable Tessera SOL/USDC scenario that reduces both buy and sell quoting depth by 90% from the current local state. Preserve the price and keep quotes fresh. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '📉',
    protocols: ['tessera'],
  },
  {
    label: 'GoonFi Stale Quote',
    prompt:
      'Age the default SOL/USDC GoonFi quote past its freshness window so swaps are rejected as stale. Call get_override_templates, then call create_scenario once with a single goonfi-stale-quote override, fetchBeforeUse enabled, persist false, its account set to that template\'s default address.pubkey, and last_update_slot at a negative lead well beyond the window (for example -2000) so the quote reads as expired. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '⏳',
    protocols: ['goonfi'],
  },
  {
    label: 'GoonFi Drained Pool',
    prompt:
      'Drain a GoonFi market\'s vaults so swaps fail with insufficient liquidity. Call create_goonfi_liquidity_scenario with market <PASTE_MARKET_ADDRESS> (omit the market field entirely to use the default SOL/USDC market), base_remaining_bps 0, and quote_remaining_bps 0. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '🕳️',
    protocols: ['goonfi'],
  },
  {
    label: 'GoonFi Price Dislocation',
    prompt:
      'Dislocate a GoonFi quote with an asymmetric spread on the default SOL/USDC market. Call get_override_templates, then call create_scenario once with two overrides, each with fetchBeforeUse enabled and its account set to that template\'s default address.pubkey: the goonfi-price template with bid_price_x1e6 and ask_price_x1e6 at a dislocated midpoint where the ask sits a few percent above the bid, and the goonfi-reference-band template with reference_price_a_x1e6 at the bid and reference_price_b_x1e6 at the ask so the band brackets the quote. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap.',
    icon: '📈',
    protocols: ['goonfi'],
  },
];
