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
      'Crash a Kamino collateral price in the Scope oracle so an obligation becomes unhealthy, while Whirlpool pools keep their real price - the gap makes liquidating it profitable',
    icon: '💰',
    protocols: ['kamino', 'whirlpool'],
  },
  {
    label: 'Tessera Risk-Off',
    prompt:
      'Create an editable WSOL/USDC scenario where SOL crashes to $50 and the Tessera maker goes risk-off. It reprices both directions to $50 but stops taking on more SOL: anyone selling SOL is turned away, while buyers can still get SOL at $50 for the next 100 slots. To achieve this, use the Tessera price override, keep the quote fresh throughout those 100 slots, and halt only the liquidity that fills SOL sellers. Select the market only through the override account; do not put a market value in values.',
    icon: '🛡️',
    protocols: ['tessera'],
  },
  {
    label: 'Tessera Stale Quote',
    prompt:
      "Age the quote of the default WSOL/USDC Tessera market from the catalog to its rejection boundary so swaps in both directions are rejected as stale. Read that market's freshness limit from the catalog and age the quote by exactly that many slots. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap. Select the market only through the override account; do not put a market value in values.",
    icon: '⏳',
    protocols: ['tessera'],
  },
  {
    label: 'Tessera Depth Stress',
    prompt:
      'Prepare one editable Tessera WSOL/USDC scenario that reduces both buy and sell quoting depth by 90% from the current local state. Preserve the price and keep the quote fresh. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap. Select the market only through the override account; do not put a market value in values.',
    icon: '📉',
    protocols: ['tessera'],
  },
  {
    label: 'GoonFi Price Shock',
    prompt:
      "Create an editable SOL/USDC scenario where the GoonFi oracle shocks SOL down to $100 and the market keeps trading at that price instead of rejecting it. Sellers should receive about 100 USDC per SOL, but GoonFi should pay out no more than 25 USDC, so small sells still fill and larger ones fail. To achieve this, use the GoonFi oracle price override, stamp that quote as fresh, move the market's reference band to the new price, and drain the USDC vault balance. Select the market only through the override account; do not put a market value in values.",
    icon: '🎯',
    protocols: ['goonfi'],
  },
  {
    label: 'GoonFi Stale Quote',
    prompt:
      "Age the quote of the default SOL/USDC GoonFi market from the catalog well past its freshness window so swaps in both directions are rejected as stale. Take the market's oracle from the catalog entry. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap. Select the market only through the override account; do not put a market value in values.",
    icon: '⏳',
    protocols: ['goonfi'],
  },
  {
    label: 'GoonFi Drained Pool',
    prompt:
      "Drain both vaults of the default SOL/USDC GoonFi market from the catalog so swaps fail for lack of inventory. Leave the price and the quote's freshness unchanged. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap. Select the market only through the override account; do not put a market value in values.",
    icon: '🏜️',
    protocols: ['goonfi'],
  },
  {
    label: 'GoonFi Price Dislocation',
    prompt:
      "Dislocate the quote of the default SOL/USDC GoonFi market from the catalog: spread the bid and the ask a few percent apart on its oracle, stamp the quote as fresh, and set the market's reference band to bracket both so the venue still accepts swaps in both directions. Keep override labels short. If validation fails, report the error and do not retry. Prepare state only; do not build or execute a swap. Select the market only through the override account; do not put a market value in values.",
    icon: '↔️',
    protocols: ['goonfi'],
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
      'Create an editable PumpSwap price shock for token mint <PASTE_TOKEN_MINT_HERE>. Fetch the existing override templates, then call create_scenario once with the pump-amm-canonical-pool template, base_mint set to that mint, virtual_quote_reserves set to 15000000000000, slot 1, and fetchBeforeUse enabled. Prepare state only; do not build or execute a swap.',
    icon: '⚡',
    protocols: ['pumpswap'],
  },
];
