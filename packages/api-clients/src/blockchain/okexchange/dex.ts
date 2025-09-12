/**
 * OKX DEX API Client
 * 专注于DEX交换的核心逻辑，使用模块化的配置管理和Rate Limit管理
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
/**
 * 固定使用 BSC 链 (chainIndex: "56")
 * 暂时不考虑其他链的支持
 */
export const OKX_DEX_CHAIN_INDEX = "56"; // BSC

/**
 * Swap Quote参数接口
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
 * OKX Dex Candles 相关类型和函数
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
  ts: string; // 时间戳
  o: string; // 开盘价
  h: string; // 最高价
  l: string; // 最低价
  c: string; // 收盘价
  vol: string; // 成交量
  volUsd: string; // 美元成交量
  confirm: string; // 是否已完成
}

export interface OkxBatchPriceParams {
  chainIndex: string;
  tokenContractAddresses: string[]; // 批量地址
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

/**
 * 创建OKX DEX Client（Functional方式，支持时间窗口管理）
 * ✅ 主动管理率限，避免429错误
 */
export const createOkxDexClient = (multiConfig?: OkxDexMultiConfig) => {
  const config = multiConfig || getMultiOkxDexConfigFromEnv();

  if (config.configs.length === 0) {
    throw new Error("No valid OKX DEX configurations found");
  }

  // ✅ 使用通用的Rate Limit管理器 (Redis-based)

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
   * ✅ 获取swap quote（主动时间窗口管理）
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
      // ✅ withRetry仍然有用，以防突发的、非预期内的率限错误
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

  const getSwapData = async (params: SwapDataParams): Promise<any> => {
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

    const operation = async (): Promise<any> => {
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
      return await withRetry(operation, {
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

  const getApproveTransaction = async (
    params: ApproveTransactionParams,
  ): Promise<any> => {
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

    const operation = async (): Promise<any> => {
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
      return await withRetry(operation, {
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
    } catch (error) {
      logger.error("[OKX DEX] Request failed after rate limit management", {
        tokenAddress,
        amount,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
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
 * 创建具有特定链配置的客户端工厂函数
 * 使用示例:
 *
 * // 1. 使用默认环境变量配置（自动时间窗口管理）
 * const client = createOkxDexClient();
 *
 * // 2. 查看配置状态
 * console.log(client.getConfigStatus()); // "Config1: Ready, Config2: Cooldown(45s)"
 *
 * // 3. 获取swap quote（自动处理时间窗口和等待）
 * const quote = await client.getSwapQuote({
 *   fromTokenAddress: "0x...",
 *   toTokenAddress: "0x...",
 *   amount: "1000000000000000000",
 * });
 *
 * // 4. 环境变量配置示例：
 * // OKX_ACCESS_DEX_CONFIGS=key1:secret1:pass1:proj1,key2:secret2:pass2:proj2
 *
 * // 5. 配置管理说明：
 * // - 每个key有60秒冷却期
 * // - 自动选择可用的key
 * // - 如果都在冷却期，等待最早的key冷却完成
 * // - 最大等待时间65秒，超过则抛出错误建议增加更多key
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

// ✅ 重新导出配置类型，保持向后兼容
export type { OkxDexConfig, OkxDexMultiConfig } from "./config";

/**
 * 获取 OKX Dex K线数据
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

      // 转换数组格式为对象格式，增加边界检查，防止 undefined 值
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
 * 将 OKX Dex Candles 数据转换为 PriceDataPoint 数组
 */
export function convertOkxCandlesToPriceData(
  candles: OkxDexCandleData[],
): Array<{ timestamp: number; price: number; source: string }> {
  return candles.map((candle) => ({
    timestamp: Number(candle.ts),
    price: Number(candle.c), // 使用收盘价
    source: "okx",
  }));
}

/**
 * 获取 OKX Dex Batch Price - No Rotation
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

// Note: 暂时使用 price 作为 ask1Price 和 bid1Price
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
