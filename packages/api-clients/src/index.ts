/**
 * API Clients - Entry Point
 */

// ===== Unified export of all types and values =====
export * from "./types";

// Export price aggregator functionality
export {
  getMultiSourceTokenPrice,
  getCurrentTokenPrice,
  getHistoricalTokenPrices,
  comparePriceSources,
  DEFAULT_CONFIG,
} from "./blockchain/aggregator/priceAggregator";

export type {
  PriceAggregatorConfig,
  PriceSource,
} from "./blockchain/aggregator/priceAggregator";

// Re-export CoinGecko types (using aliases to avoid conflicts)
export type {
  MarketChartDataPoint as CoinGeckoMarketChartDataPoint,
  MarketChartResponse as CoinGeckoMarketChartResponse,
  TokenPriceData as CoinGeckoTokenPriceData,
  MultiSourcePriceData as CoinGeckoMultiSourcePriceData,
  PriceDataPoint as CoinGeckoPriceDataPoint,
  // Top Pools API types
  PoolData as CoinGeckoPoolData,
  TopPoolsResponse as CoinGeckoTopPoolsResponse,
  TopPoolsOptions as CoinGeckoTopPoolsOptions,
  PoolToken as CoinGeckoPoolToken,
} from "./blockchain/coingecko/types";

// Export tick analysis functions
export {
  getTickLiquidityDistribution,
  getTickSwapCapacity,
  detectLiquidityCliffs,
} from "./blockchain/onchain/pools/ticks";

// Export blockchain functionality
export { aggregator, pancake } from "./blockchain";

export * as blockchain from "./blockchain";
