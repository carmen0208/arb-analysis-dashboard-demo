/**
 * Unified Type Exports
 *
 * This file consolidates all types that are safe for frontend usage.
 * It re-exports types from various modules to provide a single entry point.
 */

import { LiquidityInfo } from "./blockchain/onchain/pools";

// Re-export everything from blockchain/types.ts
export * from "./blockchain/types";

// Re-export types from blockchain/aggregator/priceAggregator
export type {
  PriceSource,
  PriceAggregatorConfig,
} from "./blockchain/aggregator/priceAggregator";

// Re-export PriceSourceName enum from blockchain/types
export { PriceSourceName } from "./blockchain/coingecko/types";

// Re-export types from blockchain/coingecko/types
export type {
  MarketChartDataPoint,
  MarketChartResponse,
  TokenPriceData,
  MultiSourcePriceData,
  PriceDataPoint,
} from "./blockchain/coingecko/types";

// Re-export tick-related types from blockchain/onchain/pools/ticks
export type {
  LiquidityInfo,
  TickSwapCapacity,
  SwapAmountInfo,
  SwapAmountInfoDown,
  CurrentTickInfo,
} from "./blockchain/onchain/pools/ticks";

// ===== Unified Token Type =====
// This is a generic Token type for frontend use
export interface Token {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
  platform?: string;
  verified?: boolean;
  // Extended fields for frontend display
  price?: Record<string, number>;
  marketCap?: number;
  volume24h?: number;
  poolsInfo?: {
    totalLiquidity: number;
    totalVolume24h: number;
    pools: Array<TokenPool>;
  };
  bridgeInfo?: {
    isL0Supported: boolean;
    supportedChains?: string[];
  };
  isVerified?: boolean;
}

export type TokenPool = {
  address: string;
  platform: string;
  pair: string;
  liquidity: number;
  volume24h: number;
  token0: {
    address: string;
    symbol: string;
    liquidity: number;
  };
  token1: {
    address: string;
    symbol: string;
    liquidity: number;
  };
  exchangeLogo?: string;
  pairLabel?: string;
  // Add tick analysis data
  tickAnalysis?: {
    liquidityDistribution: LiquidityInfo[];
  };
};

// pair_address: string;
// token0: Token;
// token1: Token;
// exchange_name?: string;
// exchange_address: string;
// exchange_logo?: string;
// pair_label?: string;
// liquidity_usd: number;
// volume_24h_usd: number;
// }
