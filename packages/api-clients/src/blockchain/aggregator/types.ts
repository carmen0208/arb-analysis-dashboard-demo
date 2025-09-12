import {
  TokenInfo,
  CoinPlatformInfo,
  Ticker,
  CoinDetailInfo,
} from "../coingecko/types";
import { TokenPool } from "../moralis/types";
import { TokenTopHolders } from "../moralis/holders";

/**
 * Represents a token match from the search results
 */
export type TokenSearchResult = CoinDetailInfo;
/**
 * Comprehensive token information aggregated from multiple sources
 */
export interface TokenAggregateInfo {
  // Basic token info
  basicInfo: TokenInfo;

  // Price data
  price: {
    current: number;
    change24h: number | null;
  };

  // Platform addresses
  platforms: CoinPlatformInfo;

  // Liquidity pools
  pools: TokenPool[];

  // Top holders
  topHolders: TokenTopHolders | null;

  // Flag indicating if this is a native token (ETH on Ethereum, BTC on Bitcoin, etc.)
  isNativeToken: boolean;

  // CoinGecko tickers
  tickers: Ticker[];
}

/**
 * Options for the initial token search
 */
export interface TokenSearchOptions {
  query: string; // Search query (symbol, name, or id)
  limit?: number; // Maximum number of search results to return
}

/**
 * Options for fetching detailed token information
 */
export interface TokenDetailOptions {
  tokenId: string; // CoinGecko token ID (required)
  chain?: string; // Chain ID (default: "eth")
  includeHolders?: boolean; // Whether to include top holders (default: true)
  includePools?: boolean; // Whether to include pools (default: true)
  poolLimit?: number; // Max pools to return (default: 10)
  holdersLimit?: number; // Max holders to return (default: 20)
  days?: string; // Time period for holders analysis (default: "90")
}
