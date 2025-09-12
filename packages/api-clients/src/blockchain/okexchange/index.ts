/**
 * OKX DEX API Integration
 * Unified export of all OKX DEX related functionality
 */

// Configuration management
export * from "./config";

// Authentication and signing
export * from "./auth";

// DEX core functionality
export * from "./dex";

// Re-export commonly used types (for backward compatibility)
export type { SwapQuote } from "../types";

// Export OKX DEX specific types
export type {
  SwapDataResponse,
  ApproveTransactionResponse,
  SwapQuoteResponse,
  BatchPriceResponse,
  CandleDataResponse,
  OkxApiError,
  ApiResult,
  RetryConfig,
} from "./types";

/**
 * Usage example:
 *
 * import { createOkxDexClient, OkxDexConfig } from "@dex-ai/api-clients/blockchain/okexchange";
 *
 * const client = createOkxDexClient();
 * const quote = await client.getSwapQuote({
 *   fromTokenAddress: "0x...",
 *   toTokenAddress: "0x...",
 *   amount: "1000000000000000000"
 * });
 */
