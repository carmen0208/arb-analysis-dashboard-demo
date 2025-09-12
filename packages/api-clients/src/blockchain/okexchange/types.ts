/**
 * OKX DEX API Types
 *
 * Comprehensive type definitions for OKX DEX API responses and data structures
 */

/**
 * Base API response structure
 */
export interface OkxApiResponse<T = unknown> {
  code: string;
  msg: string;
  data: T;
}

/**
 * Swap data response structure
 */
export interface SwapDataResponse {
  tx: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  fromToken: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
  };
  toToken: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
  };
  priceImpact: string;
  fee: string;
  gasEstimate: string;
}

/**
 * Approve transaction response structure
 */
export interface ApproveTransactionResponse {
  tx: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  tokenAddress: string;
  approveAmount: string;
  gasEstimate: string;
}

/**
 * Swap quote response structure
 */
export interface SwapQuoteResponse {
  fromToken: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
  };
  toToken: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
  };
  priceImpact: string;
  fee: string;
  gasEstimate: string;
  route: Array<{
    protocol: string;
    pool: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
  }>;
}

/**
 * Batch price response structure
 */
export interface BatchPriceResponse {
  prices: Array<{
    tokenAddress: string;
    price: string;
    timestamp: number;
  }>;
}

/**
 * Candle data response structure
 */
export interface CandleDataResponse {
  candles: Array<{
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
}

/**
 * Error response structure
 */
export interface OkxErrorResponse {
  code: string;
  msg: string;
  data?: unknown;
}

/**
 * Rate limit error structure
 */
export interface RateLimitError {
  code: "429";
  msg: "Rate limit exceeded";
  data: {
    retryAfter: number;
    limit: number;
    remaining: number;
  };
}

/**
 * API error types
 */
export type OkxApiError = OkxErrorResponse | RateLimitError | Error;

/**
 * Generic API function result
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: OkxApiError };

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry: (error: OkxApiError) => boolean;
  onError: (error: OkxApiError, attempt: number) => void;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Swap Quote parameter interface
 */
export interface SwapQuoteParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  slippage?: string;
  chainIndex?: string;
}

export interface SwapDataParams extends SwapQuoteParams {
  userWalletAddress: string;
  swapReceiverAddress?: string;
}

export interface ApproveTransactionParams {
  tokenAddress: string;
  amount: string;
  chainIndex?: string;
}

/**
 * OKX Dex Candles related types and functions
 */
export interface OkxDexCandlesParams {
  chainIndex: string;
  tokenContractAddress: string;
  bar?: string;
  limit?: number;
  after?: string;
  before?: string;
}

export interface OkxDexCandleData {
  ts: string; // Timestamp
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  c: string; // Close price
  vol: string; // Volume
  volUsd: string; // USD volume
  confirm: string; // Whether completed
}

export interface OkxBatchPriceParams {
  chainIndex: string;
  tokenContractAddresses: string[]; // Batch addresses
}

export interface OkxBatchPriceData {
  chainIndex: string;
  tokenContractAddress: string;
  price: string;
  time: string;
  marketCap?: string;
  priceChange5M?: string;
  priceChange1H?: string;
  priceChange4H?: string;
  priceChange24H?: string;
  volume5M?: string;
  volume1H?: string;
  volume4H?: string;
  volume24H?: string;
}
