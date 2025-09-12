/**
 * Etherscan API Client - Functional Approach
 *
 * Main entry point for Etherscan API functions.
 */

import { getLogger, Logger } from "@dex-ai/core";
import { fileCacheAdapter as cache } from "@dex-ai/core";
import { getApiClient, getApiKey } from "./client";
import { makeApiRequest, handleApiResponse } from "./request";
import { CACHE_DURATION, ChainId } from "./constants";
import presetAlphaTokens from "../binance/alpha/alphaTokens.json";
import {
  TokenTransaction,
  TokenTransactionParams,
  BlockParams,
  EnhancedTokenTransaction,
  TokenInfo,
  MonitoringConfig,
  BlockRange,
  MonitoringResult,
} from "./types";
import { getTokenPriceByChainId as getCoinGeckoTokenPrice } from "../coingecko";

const logger: Logger = getLogger("etherscan");

/**
 * Check if a token address is a known/preset alpha token
 * @param address - The token contract address to check
 * @returns boolean indicating if the token is found in the preset alpha tokens list
 */
export function isKnownAlphaToken(address: string): boolean {
  if (!address) return false;

  const normalizedAddress = address.toLowerCase();
  return presetAlphaTokens.some(
    (token) => token.address.toLowerCase() === normalizedAddress,
  );
}

/**
 * Get token transactions for a specific address
 */
export async function getTokenTransactions(
  address: string,
  chainId: ChainId = ChainId.BSC,
  options: {
    startBlock?: number;
    endBlock?: number;
    page?: number;
    offset?: number;
    sort?: "asc" | "desc";
    forceRefresh?: boolean;
  } = {},
): Promise<TokenTransaction[]> {
  const {
    startBlock,
    endBlock,
    page = 1,
    offset = 100,
    sort = "asc",
    forceRefresh = false,
  } = options;

  logger.info("[Etherscan] Fetching token transactions", {
    address,
    chainId,
    startBlock,
    endBlock,
    page,
    offset,
  });

  // Use cache key based on parameters
  const cacheKey = `token-tx-${chainId}-${address}-${startBlock}-${endBlock}-${page}-${offset}-${sort}`;

  if (!forceRefresh) {
    const cached = await cache.getFromCache<TokenTransaction[]>(
      "etherscan",
      cacheKey,
    );
    if (cached) {
      logger.info("[Etherscan] Returning cached token transactions", {
        address,
        transactionCount: cached.length,
      });
      return cached;
    }
  }

  try {
    // Use the unified client for all chains - V2 API handles chainid parameter
    const client = getApiClient(chainId);

    const params: TokenTransactionParams = {
      chainid: chainId,
      module: "account",
      action: "tokentx",
      address,
      page,
      offset,
      startblock: startBlock,
      endblock: endBlock,
      sort,
      apikey: getApiKey(chainId),
    };

    const response = await makeApiRequest<TokenTransaction[]>(client, params, {
      address,
      chainId,
      operation: "getTokenTransactions",
    });

    const transactions = handleApiResponse(response.data);

    // Cache the result
    await cache.saveToCache(
      "etherscan",
      transactions,
      CACHE_DURATION,
      cacheKey,
    );

    logger.info("[Etherscan] Successfully fetched token transactions", {
      address,
      transactionCount: transactions.length,
    });
    return transactions;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("No transactions found")
    ) {
      logger.info("[Etherscan] No transactions found", {
        address,
        chainId,
      });
      return [];
    }
    logger.error("[Etherscan] Error fetching token transactions", {
      address,
      chainId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get block number by timestamp using Etherscan API
 */
export async function getBlockNumberByTimestamp(
  chainId: ChainId,
  timestamp: number,
  closest: "before" | "after" = "before",
): Promise<number> {
  const client = getApiClient(chainId);

  const params: BlockParams = {
    chainid: chainId,
    module: "block",
    action: "getblocknobytime",
    timestamp: timestamp.toString(),
    closest,
    apikey: getApiKey(chainId),
  };

  try {
    logger.debug("[Etherscan] Getting block number by timestamp", {
      chainId,
      timestamp,
      closest,
    });

    const response = await makeApiRequest<string>(client, params, {
      chainId,
      timestamp,
      operation: "getBlockNumberByTimestamp",
    });

    const blockNumber = handleApiResponse(response.data);
    const result = parseInt(blockNumber);

    logger.debug("[Etherscan] Block number retrieved", {
      chainId,
      timestamp,
      blockNumber: result,
    });

    return result;
  } catch (error) {
    logger.error("[Etherscan] Error getting block number by timestamp", {
      chainId,
      timestamp,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Calculate block range for monitoring using accurate block numbers
 */
export async function calculateBlockRange(
  chainId: ChainId,
  intervalMinutes: number = 5,
): Promise<BlockRange> {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - intervalMinutes * 60;

  try {
    // Get accurate block numbers using Etherscan API
    const startBlock = await getBlockNumberByTimestamp(
      chainId,
      startTime,
      "before",
    );
    const endBlock = await getBlockNumberByTimestamp(chainId, now);
    return {
      startBlock,
      endBlock,
      timestamp: now,
    };
  } catch (error) {
    logger.warn("[Etherscan] Falling back to estimated block range", {
      chainId,
      intervalMinutes,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to estimation if API fails
    const blocksPerSecond = chainId === ChainId.BSC ? 3 : 1;
    const estimatedBlocks = intervalMinutes * 60 * blocksPerSecond;

    return {
      startBlock: Math.max(0, estimatedBlocks),
      endBlock: 99999999, // Use a large number to get latest blocks
      timestamp: now,
    };
  }
}

/**
 * Enhance token transaction with calculated values
 */
export async function enhanceTokenTransaction(
  transaction: TokenTransaction,
  thresholdUSD: number,
  chainId: ChainId = ChainId.BSC, // Default to BSC for backward compatibility
): Promise<EnhancedTokenTransaction> {
  const valueInTokens =
    parseFloat(transaction.value) /
    Math.pow(10, parseInt(transaction.tokenDecimal));

  const tokenInfo: TokenInfo = {
    address: transaction.contractAddress,
    name: transaction.tokenName,
    symbol: transaction.tokenSymbol,
    decimals: parseInt(transaction.tokenDecimal),
  };

  // Calculate price for unknown tokens (known tokens are filtered out upstream)
  let valueInUSD: number | undefined;
  let isLargeTransfer = false;

  try {
    // Check cache for token price first
    const cacheKey = `token-price-${transaction.contractAddress.toLowerCase()}`;
    const cachedPrice = await cache.getFromCache<{
      price: number;
      timestamp: string;
    }>("etherscan-token-prices", cacheKey);

    let tokenPrice: number | undefined;

    if (cachedPrice) {
      logger.debug("[Etherscan] Using cached token price", {
        tokenAddress: transaction.contractAddress,
        price: cachedPrice.price,
      });
      tokenPrice = cachedPrice.price;
    } else {
      // Get token price from CoinGecko by chain ID
      const priceData = await getCoinGeckoTokenPrice(
        chainId,
        transaction.contractAddress,
      );

      if (priceData) {
        tokenPrice = priceData.currentPrice;

        // Cache the price for 60 minutes
        await cache.saveToCache(
          "etherscan-token-prices",
          { price: tokenPrice, timestamp: new Date().toISOString() },
          2 * 60 * 60 * 1000, // 2 hours cache
          cacheKey,
        );

        logger.debug("[Etherscan] Cached new token price", {
          tokenAddress: transaction.contractAddress,
          price: tokenPrice,
        });
      }
    }

    if (tokenPrice) {
      valueInUSD = valueInTokens * tokenPrice;
      isLargeTransfer = valueInUSD >= thresholdUSD;
      tokenInfo.priceUSD = tokenPrice;
    }
  } catch (error) {
    logger.warn("[Etherscan] Failed to get token price", {
      tokenAddress: transaction.contractAddress,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ...transaction,
    valueInTokens,
    valueInUSD,
    tokenInfo,
    isLargeTransfer,
    transferThreshold: thresholdUSD,
  };
}

/**
 * Monitor large token transfers for specific addresses
 */
export async function monitorLargeTransfers(
  config: MonitoringConfig,
): Promise<MonitoringResult> {
  const { addresses, thresholds, intervalMinutes, chainId } = config;

  logger.info("[Etherscan] Starting large transfer monitoring", {
    addresses,
    chainId,
    intervalMinutes,
  });

  const blockRange = await calculateBlockRange(chainId, intervalMinutes);
  const allTransactions: EnhancedTokenTransaction[] = [];
  const largeTransfers: EnhancedTokenTransaction[] = [];

  // Fetch transactions for all monitored addresses
  for (const address of addresses) {
    const threshold = thresholds[address]?.minAmountUSD || 10000; // Default 10k USD

    try {
      const transactions = await getTokenTransactions(address, chainId, {
        startBlock: blockRange.startBlock,
        endBlock: blockRange.endBlock,
        forceRefresh: true, // Always get fresh data for monitoring
      });

      // Filter out known alpha tokens to avoid unnecessary price calculations
      const unknownTokenTransactions = transactions.filter(
        (transaction) => !isKnownAlphaToken(transaction.contractAddress),
      );

      const knownTokenCount =
        transactions.length - unknownTokenTransactions.length;
      if (knownTokenCount > 0) {
        logger.debug("[Etherscan] Filtered out known alpha tokens", {
          address,
          totalTransactions: transactions.length,
          knownTokenCount,
          unknownTokenCount: unknownTokenTransactions.length,
        });
      }

      // Enhance transactions with price data and thresholds (only unknown tokens)
      for (const transaction of unknownTokenTransactions) {
        const enhanced = await enhanceTokenTransaction(
          transaction,
          threshold,
          chainId,
        );
        allTransactions.push(enhanced);

        if (enhanced.isLargeTransfer) {
          largeTransfers.push(enhanced);
        }
      }
    } catch (error) {
      logger.error("[Etherscan] Error monitoring address", {
        address,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Calculate summary
  const totalValueUSD = largeTransfers.reduce(
    (sum, tx) => sum + (tx.valueInUSD || 0),
    0,
  );

  const result: MonitoringResult = {
    chainId,
    blockRange,
    transactions: allTransactions,
    largeTransfers,
    summary: {
      totalTransactions: allTransactions.length,
      largeTransfersCount: largeTransfers.length,
      totalValueUSD,
      monitoredAddresses: addresses,
    },
  };

  logger.info("[Etherscan] Monitoring completed", {
    chainId,
    totalTransactions: result.summary.totalTransactions,
    largeTransfersCount: result.summary.largeTransfersCount,
    totalValueUSD: result.summary.totalValueUSD,
  });

  return result;
}

// Export types for convenience
export * from "./types";
export * from "./constants";
