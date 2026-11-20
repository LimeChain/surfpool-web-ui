import type { MarketMoveAdapter } from './market-move';
import { velocityMarketMove } from './market-move-velocity';

export const MARKET_MOVE_ADAPTERS: MarketMoveAdapter[] = [velocityMarketMove];
