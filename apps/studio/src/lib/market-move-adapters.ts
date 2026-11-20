import type { MarketMoveAdapter } from './market-move';
import { jupiterPerpsMarketMove } from './market-move-jupiter-perps';

export const MARKET_MOVE_ADAPTERS: MarketMoveAdapter[] = [jupiterPerpsMarketMove];
