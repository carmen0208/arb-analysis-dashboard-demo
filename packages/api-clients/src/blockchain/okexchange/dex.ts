/**
 * OKX DEX API Client
 * Focuses on DEX swap core logic with modular configuration management and Rate Limit management
 */

import axios from "axios";
import { SwapQuote } from "../types";
import { isRateLimitError, RateLimitManager, withRetry } from "@dex-ai/core";
import logger from "../../common/logger";
import {
  OkxDexMultiConfig,
  getMultiOkxDexConfigFromEnv,
  OKX_CONFIG_CONSTANTS,
  DEFAULT_SLIPPAGE,
} from "./config";
import { createOkxDexHeaders } from "./auth";
import type {
  SwapDataResponse,
  ApproveTransactionResponse,
  ApiResult,
  SwapQuoteParams,
  SwapDataParams,
  ApproveTransactionParams,
  OkxDexCandlesParams,
  OkxBatchPriceParams,
  OkxBatchPriceData,
  OkxDexCandleData,
} from "./types";

/**
 * Fixed to use BSC chain (chainIndex: "56")
 * Other chains are not considered for now
 */
export const OKX_DEX_CHAIN_INDEX = "56"; // BSC

/**
 * Create OKX DEX Client (Functional approach with time window management)
 * ✅ Proactively manages rate limits to avoid 429 errors
 */
export const createOkxDexClient = (multiConfig?: OkxDexMultiConfig) => {
  const config = multiConfig || getMultiOkxDexConfigFromEnv();

  if (config.configs.length === 0) {
    throw new Error("No valid OKX DEX configurations found");
  }

  // ✅ Use generic Rate Limit manager (Redis-based)

  const rateLimitManager = new RateLimitManager(
    config.configs,
    OKX_CONFIG_CONSTANTS.RATE_LIMIT_WINDOW,
    "OKX-DEX-API",
  );

  const rotationEnabled = config.rotationEnabled && config.configs.length > 1;

  if (rotationEnabled) {
    logger.debug(
      `[OKX DEX] Rate limit rotation enabled with ${
        config.configs.length
      } configurations (${
        OKX_CONFIG_CONSTANTS.RATE_LIMIT_WINDOW / 1000
      }s window per key)`,
    );
  } else {
    logger.debug(
      `[OKX DEX] Single configuration mode (${
        OKX_CONFIG_CONSTANTS.RATE_LIMIT_WINDOW / 1000
      }s rate limit)`,
    );
  }

  /**
   * ✅ Get swap quote (proactive time window management)
   */
  const getSwapQuote = async (params: SwapQuoteParams): Promise<SwapQuote> => {
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage = DEFAULT_SLIPPAGE,
      chainIndex = OKX_DEX_CHAIN_INDEX,
    } = params;

    const path = "dex/aggregator/quote";
    const url = `${OKX_CONFIG_CONSTANTS.API_BASE_URL}${path}`;
    const queryParams = {
      chainIndex,
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage,
    };

    const requestPath = `/api/v5/${path}`;
    const queryString = "?" + new URLSearchParams(queryParams).toString();

    const operation = async (): Promise<SwapQuote> => {
      // ✅ Atomically acquire and mark configuration as used
      const { config: selectedConfig, index: configIndex } =
        await rateLimitManager.acquireAndMarkConfigAsUsed();

      // ✅ Use the accurate index from the rate limit manager
      const displayIndex = configIndex + 1;

      logger.debug(
        `[OKX DEX] Using config ${displayIndex}/${
          config.configs.length
        } (***${selectedConfig.apiKey.slice(-4)})`,
      );

      const timestamp = new Date().toISOString();
      const headers = createOkxDexHeaders(selectedConfig)(
        timestamp,
        "GET",
        requestPath,
        queryString,
      );

      logger.debug("[OKX DEX] Making swap quote request", {
        fromTokenAddress,
        toTokenAddress,
        amount,
        configIndex: displayIndex,
        slippage,
      });

      try {
        const res = await axios.get(url, { params: queryParams, headers });
        logger.debug("[OKX DEX] Swap quote request successful");

        // The key is already marked as used by acquireAndMarkConfigAsUsed
        return res.data?.data?.[0] || null;
      } catch (error) {
        // The key is already marked as used, so if a rate-limit error occurs,
        // it's already on cooldown. We just need to let withRetry handle it.
        logger.warn(
          `[OKX DEX] API call failed for config ${displayIndex}, will let retry handle it`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
        throw error; // Re-throw for withRetry to handle.
      }
    };

    try {
      // ✅ withRetry is still useful for unexpected rate limit errors
      return await withRetry(operation, {
        maxRetries: rotationEnabled ? 2 : 1,
        retryDelay: 2000,
        shouldRetry: (error: unknown) => {
          const isRateLimit = isRateLimitError(error);
          if (isRateLimit) {
            logger.warn(
              "[OKX DEX] Unexpected rate limit hit, will retry. The manager should handle this.",
            );
            return true; // manager will pick a new key on next attempt
          }
          return false;
        },
        onError: (error: unknown, attempt: number) => {
          logger.warn(`[OKX DEX] Attempt ${attempt + 1} failed`, {
            error: error instanceof Error ? error.message : String(error),
            fromTokenAddress,
            toTokenAddress,
          });
        },
      });
    } catch (error) {
      logger.error("[OKX DEX] Request failed after rate limit management", {
        fromTokenAddress,
        toTokenAddress,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  };

  const getSwapData = async (
    params: SwapDataParams,
  ): Promise<ApiResult<SwapDataResponse>> => {
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage = DEFAULT_SLIPPAGE,
      chainIndex = OKX_DEX_CHAIN_INDEX,
      userWalletAddress,
      swapReceiverAddress,
    } = params;

    const path = "dex/aggregator/swap";
    const url = `${OKX_CONFIG_CONSTANTS.API_BASE_URL}${path}`;
    const queryParams: Record<string, string> = {
      chainIndex,
      fromTokenAddress,
      toTokenAddress,
      amount,
      slippage,
      userWalletAddress,
    };

    if (swapReceiverAddress) {
      queryParams.swapReceiverAddress = swapReceiverAddress;
    }

    const requestPath = `/api/v5/${path}`;
    const queryString = "?" + new URLSearchParams(queryParams).toString();

    const operation = async (): Promise<SwapDataResponse> => {
      // ✅ Atomically acquire and mark configuration as used
      const { config: selectedConfig, index: configIndex } =
        await rateLimitManager.acquireAndMarkConfigAsUsed();

      // ✅ Use the accurate index from the rate limit manager
      const displayIndex = configIndex + 1;

      logger.debug(
        `[OKX DEX] Using config ${displayIndex}/${
          config.configs.length
        } (***${selectedConfig.apiKey.slice(-4)})`,
      );

      const timestamp = new Date().toISOString();
      const headers = createOkxDexHeaders(selectedConfig)(
        timestamp,
        "GET",
        requestPath,
        queryString,
      );

      logger.info("[OKX DEX] Making swap data request", {
        fromTokenAddress,
        toTokenAddress,
        amount,
        userWalletAddress,
        configIndex: displayIndex,
        slippage,
      });

      try {
        const res = await axios.get(url, { params: queryParams, headers });
        logger.debug("[OKX DEX] Swap data request successful");

        // The key is already marked as used by acquireAndMarkConfigAsUsed
        return res.data?.data?.[0] || null;
      } catch (error) {
        // The key is already marked as used, so if a rate-limit error occurs,
        // it's already on cooldown. We just need to let withRetry handle it.
        logger.warn(
          `[OKX DEX] API call failed for config ${displayIndex}, will let retry handle it`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
        throw error; // Re-throw for withRetry to handle.
      }
    };

    try {
      const result = await withRetry(operation, {
        maxRetries: rotationEnabled ? 2 : 1,
        retryDelay: 2000,
        shouldRetry: (error: unknown) => {
          const isRateLimit = isRateLimitError(error);
          if (isRateLimit) {
            logger.warn(
              "[OKX DEX] Unexpected rate limit hit, will retry. The manager should handle this.",
            );
            return true;
          }
          return false;
        },
        onError: (error: unknown, attempt: number) => {
          logger.warn(`[OKX DEX] Attempt ${attempt + 1} failed`, {
            error: error instanceof Error ? error.message : String(error),
            fromTokenAddress,
            toTokenAddress,
          });
        },
      });

      return { success: true, data: result };
    } catch (error) {
      logger.error("[OKX DEX] Request failed after rate limit management", {
        fromTokenAddress,
        toTokenAddress,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  const getApproveTransaction = async (
    params: ApproveTransactionParams,
  ): Promise<ApiResult<ApproveTransactionResponse>> => {
    const { tokenAddress, amount, chainIndex = OKX_DEX_CHAIN_INDEX } = params;

    const path = "dex/aggregator/approve-transaction";
    const url = `${OKX_CONFIG_CONSTANTS.API_BASE_URL}${path}`;
    const queryParams = {
      chainId: chainIndex,
      tokenContractAddress: tokenAddress,
      approveAmount: amount,
    };

    const requestPath = `/api/v5/${path}`;
    const queryString = "?" + new URLSearchParams(queryParams).toString();

    const operation = async (): Promise<ApproveTransactionResponse> => {
      // ✅ Atomically acquire and mark configuration as used
      const { config: selectedConfig, index: configIndex } =
        await rateLimitManager.acquireAndMarkConfigAsUsed();

      // ✅ Use the accurate index from the rate limit manager
      const displayIndex = configIndex + 1;

      logger.debug(
        `[OKX DEX] Using config ${displayIndex}/${
          config.configs.length
        } (***${selectedConfig.apiKey.slice(-4)})`,
      );

      const timestamp = new Date().toISOString();
      const headers = createOkxDexHeaders(selectedConfig)(
        timestamp,
        "GET",
        requestPath,
        queryString,
      );

      logger.debug("[OKX DEX] Making approve transaction request", {
        tokenAddress,
        amount,
        configIndex: displayIndex,
      });

      try {
        const res = await axios.get(url, { params: queryParams, headers });
        logger.debug("[OKX DEX] Approve transaction request successful");

        // The key is already marked as used by acquireAndMarkConfigAsUsed
        return res.data?.data?.[0] || null;
      } catch (error) {
        // The key is already marked as used, so if a rate-limit error occurs,
        // it's already on cooldown. We just need to let withRetry handle it.
        logger.warn(
          `[OKX DEX] API call failed for config ${displayIndex}, will let retry handle it`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
        throw error; // Re-throw for withRetry to handle.
      }
    };

    try {
      const result = await withRetry(operation, {
        maxRetries: rotationEnabled ? 2 : 1,
        retryDelay: 2000,
        shouldRetry: (error: unknown) => {
          const isRateLimit = isRateLimitError(error);
          if (isRateLimit) {
            logger.warn(
              "[OKX DEX] Unexpected rate limit hit, will retry. The manager should handle this.",
            );
            return true;
          }
          return false;
        },
        onError: (error: unknown, attempt: number) => {
          logger.warn(`[OKX DEX] Attempt ${attempt + 1} failed`, {
            error: error instanceof Error ? error.message : String(error),
            tokenAddress,
          });
        },
      });

      return { success: true, data: result };
    } catch (error) {
      logger.error("[OKX DEX] Request failed after rate limit management", {
        tokenAddress,
        amount,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };

  return {
    getSwapQuote,
    getSwapData,
    getApproveTransaction,
    getConfigCount: () => config.configs.length,
    isRotationEnabled: () => rotationEnabled,
    getConfigStatus: () => {
      // This function is now less meaningful with Redis, but we can keep it as a placeholder
      if (!rateLimitManager) {
        return "Rate limit manager not initialized.";
      }
      return `Rate limit manager is active with ${config.configs.length} configs. State is managed in Redis.`;
    },
  };
};

/**
 * Create client factory function with specific chain configuration
 * Usage example:
 *
 * // 1. Use default environment variable configuration (automatic time window management)
 * const client = createOkxDexClient();
 *
 * // 2. Check configuration status
 * console.log(client.getConfigStatus()); // "Config1: Ready, Config2: Cooldown(45s)"
 *
 * // 3. Get swap quote (automatically handles time window and waiting)
 * const quote = await client.getSwapQuote({
 *   fromTokenAddress: "0x...",
 *   toTokenAddress: "0x...",
 *   amount: "1000000000000000000",
 * });
 *
 * // 4. Environment variable configuration example:
 * // OKX_ACCESS_DEX_CONFIGS=key1:secret1:pass1:proj1,key2:secret2:pass2:proj2
 *
 * // 5. Configuration management notes:
 * // - Each key has a 60-second cooldown period
 * // - Automatically selects available keys
 * // - If all keys are in cooldown, waits for the earliest key to cool down
 * // - Maximum wait time 65 seconds, throws error if exceeded, suggests adding more keys
 */
export const createBscOkxDexClient = (multiConfig?: OkxDexMultiConfig) => {
  const client = createOkxDexClient(multiConfig);

  return {
    getSwapQuote: (params: Omit<SwapQuoteParams, "chainIndex">) =>
      client.getSwapQuote({ ...params, chainIndex: OKX_DEX_CHAIN_INDEX }),
    getSwapData: (params: Omit<SwapDataParams, "chainIndex">) =>
      client.getSwapData({ ...params, chainIndex: OKX_DEX_CHAIN_INDEX }),
    getApproveTransaction: (
      params: Omit<ApproveTransactionParams, "chainIndex">,
    ) =>
      client.getApproveTransaction({
        ...params,
        chainIndex: OKX_DEX_CHAIN_INDEX,
      }),
    getConfigCount: client.getConfigCount,
    isRotationEnabled: client.isRotationEnabled,
    getConfigStatus: client.getConfigStatus,
  };
};

// ✅ Re-export configuration types for backward compatibility
export type { OkxDexConfig, OkxDexMultiConfig } from "./config";

/**
 * Get OKX Dex K-line data
 */
export const getOkxDexCandles = async (
  params: OkxDexCandlesParams,
  multiConfig?: OkxDexMultiConfig,
): Promise<OkxDexCandleData[]> => {
  const config = multiConfig || getMultiOkxDexConfigFromEnv();

  if (config.configs.length === 0) {
    throw new Error("No valid OKX DEX configurations found");
  }

  const {
    chainIndex,
    tokenContractAddress,
    bar = "1m",
    limit = 299,
    after,
    before,
  } = params;

  const rateLimitManager = new RateLimitManager(
    config.configs,
    OKX_CONFIG_CONSTANTS.RATE_LIMIT_WINDOW,
    "OKX-DEX-CANDLES",
  );

  const path = "dex/market/candles";
  const url = `${OKX_CONFIG_CONSTANTS.API_BASE_URL}${path}`;
  const queryParams: Record<string, string> = {
    chainIndex,
    tokenContractAddress: tokenContractAddress.toLowerCase(),
    bar,
    limit: limit.toString(),
  };

  if (after) queryParams.after = after;
  if (before) queryParams.before = before;

  const requestPath = `/api/v5/${path}`;
  const queryString = "?" + new URLSearchParams(queryParams).toString();

  const operation = async (): Promise<OkxDexCandleData[]> => {
    const { config: selectedConfig, index: configIndex } =
      config.configs.length === 1
        ? {
            config: config.configs[0],
            index: 0,
          }
        : await rateLimitManager.acquireAndMarkConfigAsUsed();

    const displayIndex = configIndex + 1;

    logger.info(
      `[OKX DEX Candles] Using config ${displayIndex}/${
        config.configs.length
      } (***${selectedConfig.apiKey.slice(-4)})`,
    );

    const timestamp = new Date().toISOString();
    const headers = createOkxDexHeaders(selectedConfig)(
      timestamp,
      "GET",
      requestPath,
      queryString,
    );

    logger.debug("[OKX DEX Candles] Making candles request", {
      chainIndex,
      tokenContractAddress,
      bar,
      limit,
      configIndex: displayIndex,
    });

    try {
      const res = await axios.get(url, { params: queryParams, headers });

      if (res.data?.code !== "0") {
        throw new Error(
          `OKX DEX API error: ${res.data?.msg || res.data?.code}`,
        );
      }

      if (!Array.isArray(res.data?.data)) {
        throw new Error("Invalid response format from OKX DEX API");
      }

      logger.debug("[OKX DEX Candles] Request successful", {
        dataLength: res.data.data.length,
      });

      // Convert array format to object format, add boundary checks to prevent undefined values
      return res.data.data.map((arr: string[]) => ({
        ts: arr[0] ?? "",
        o: arr[1] ?? "0",
        h: arr[2] ?? "0",
        l: arr[3] ?? "0",
        c: arr[4] ?? "0",
        vol: arr[5] ?? "0",
        volUsd: arr[6] ?? "0",
        confirm: arr[7] ?? "",
      }));
    } catch (error) {
      logger.warn(
        `[OKX DEX Candles] API call failed for config ${displayIndex}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  };

  try {
    const rotationEnabled = config.rotationEnabled && config.configs.length > 1;
    return await withRetry(operation, {
      maxRetries: rotationEnabled ? 2 : 1,
      retryDelay: 2000,
      shouldRetry: (error: unknown) => {
        const isRateLimit = isRateLimitError(error);
        if (isRateLimit) {
          logger.warn(
            "[OKX DEX Candles] Unexpected rate limit hit, will retry",
          );
          return true;
        }
        return false;
      },
      onError: (error: unknown, attempt: number) => {
        logger.warn(`[OKX DEX Candles] Attempt ${attempt + 1} failed`, {
          error: error instanceof Error ? error.message : String(error),
          chainIndex,
          tokenContractAddress,
        });
      },
    });
  } catch (error) {
    logger.error("[OKX DEX Candles] Request failed after retry", {
      chainIndex,
      tokenContractAddress,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * Convert OKX Dex Candles data to PriceDataPoint array
 */
export function convertOkxCandlesToPriceData(
  candles: OkxDexCandleData[],
): Array<{ timestamp: number; price: number; source: string }> {
  return candles.map((candle) => ({
    timestamp: Number(candle.ts),
    price: Number(candle.c), // Use close price
    source: "okx",
  }));
}

/**
 * Get OKX Dex Batch Price - No Rotation
 */
export async function getOkxBatchTokenPrices(
  params: OkxBatchPriceParams,
  multiConfig?: OkxDexMultiConfig,
): Promise<OkxBatchPriceData[]> {
  const config = multiConfig || getMultiOkxDexConfigFromEnv();

  if (config.configs.length === 0) {
    throw new Error("No valid OKX DEX configurations found");
  }

  const { chainIndex = OKX_DEX_CHAIN_INDEX, tokenContractAddresses } = params;
  if (
    !Array.isArray(tokenContractAddresses) ||
    tokenContractAddresses.length === 0
  ) {
    throw new Error("tokenContractAddresses must be a non-empty array");
  }

  const rateLimitManager = new RateLimitManager(
    config.configs,
    OKX_CONFIG_CONSTANTS.RATE_LIMIT_WINDOW,
    "OKX-DEX-BATCH-PRICE",
  );

  const operation = async (): Promise<OkxBatchPriceData[]> => {
    const { config: selectedConfig, index: configIndex } =
      config.configs.length === 1
        ? {
            config: config.configs[0],
            index: 0,
          }
        : await rateLimitManager.acquireAndMarkConfigAsUsed();

    const displayIndex = configIndex + 1;
    logger.info(
      `[OKX DEX Batch Price] Using config ${displayIndex}/${
        config.configs.length
      } (***${selectedConfig.apiKey.slice(-4)})`,
    );
    const url = `${OKX_CONFIG_CONSTANTS.API_BASE_URL}dex/market/price-info`;
    const requestBody = tokenContractAddresses.map((addr) => ({
      chainIndex,
      tokenContractAddress: addr.toLowerCase(),
    }));

    const timestamp = new Date().toISOString();
    const headers = createOkxDexHeaders(selectedConfig)(
      timestamp,
      "POST",
      "/api/v5/dex/market/price-info",
      JSON.stringify(requestBody),
    );

    logger.debug("[OKX DEX Batch Price] Making batch price request", {
      chainIndex,
      tokenContractAddresses,
    });

    try {
      const res = await axios.post(url, requestBody, { headers });
      if (res.data?.code !== "0") {
        throw new Error(
          `OKX DEX API error: ${res.data?.msg || res.data?.code}`,
        );
      }
      if (!Array.isArray(res.data?.data)) {
        throw new Error("Invalid response format from OKX DEX API");
      }
      logger.info("[OKX DEX] Batch price request successful", {
        count: res.data.data.length,
      });
      return res.data.data as OkxBatchPriceData[];
    } catch (error) {
      logger.error("[OKX DEX] Batch price request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  try {
    const rotationEnabled = config.rotationEnabled && config.configs.length > 1;
    return await withRetry(operation, {
      maxRetries: rotationEnabled ? 2 : 1,
      retryDelay: 2000,
      shouldRetry: (error: unknown) => {
        const isRateLimit = isRateLimitError(error);
        if (isRateLimit) {
          logger.warn(
            "[OKX DEX Batch Price] Unexpected rate limit hit, will retry",
          );
          return true;
        }
        return false;
      },
      onError: (error: unknown, attempt: number) => {
        logger.warn(`[OKX DEX Batch Price] Attempt ${attempt + 1} failed`, {
          error: error instanceof Error ? error.message : String(error),
          chainIndex,
          tokenContractAddresses,
        });
      },
    });
  } catch (error) {
    logger.error("[OKX DEX Batch Price] Request failed after retry", {
      chainIndex,
      tokenContractAddresses,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Note: Temporarily use price as ask1Price and bid1Price
export function convertOkxBatchPriceToPriceData(
  prices: OkxBatchPriceData[],
): Array<{
  address: string;
  price: number;
  ask1Price: number;
  bid1Price: number;
  timestamp: number;
  source: string;
}> {
  return prices.map((item) => ({
    address: item.tokenContractAddress,
    price: Number(item.price),
    ask1Price: Number(item.price),
    bid1Price: Number(item.price),
    timestamp: Number(item.time),
    source: "okx",
  }));
}
