import type { MarketMoveAdapter } from './market-move';
import { manifestMarketMove } from './market-move-manifest';

export const MARKET_MOVE_ADAPTERS: MarketMoveAdapter[] = [manifestMarketMove];
