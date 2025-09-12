/**
 * Token Aggregator API - Combines data from multiple blockchain sources
 *
 * This module provides a two-step approach for token information:
 * 1. First search for tokens using searchTokens() to get a list of matching tokens
 * 2. Then get detailed information for a selected token using getTokenDetails()
 */

export { searchTokens, getTokenDetails } from "./service";
export type {
  TokenAggregateInfo,
  TokenSearchOptions,
  TokenSearchResult,
  TokenDetailOptions,
} from "./types";

// Price Aggregator exports
export {
  getMultiSourceTokenPrice,
  getCurrentTokenPrice,
  getHistoricalTokenPrices,
  comparePriceSources,
  DEFAULT_CONFIG,
} from "./priceAggregator";
export type { PriceSource, PriceAggregatorConfig } from "./priceAggregator";
