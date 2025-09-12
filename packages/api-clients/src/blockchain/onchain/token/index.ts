import { getLogger, Logger, TIME_CONSTANTS } from "@dex-ai/core";
import { ERC20_ABI } from "../abis";
import {
  V3PoolConfig,
  DEFAULT_CONFIG,
  getCoinGeckoChainName,
} from "../pools/config";
import { getTokenPrice as getTokenPriceFromCoingecko } from "../../coingecko";
import { createClient } from "../client";

const logger: Logger = getLogger("blockchain-onchain-token");

// Token information interface
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  priceUSD?: number;
}

// Simplified in-memory cache implementation
const memoryCache = new Map<string, { data: unknown; expires: number }>();

function getFromCache<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expires) {
    memoryCache.delete(key);
    return null;
  }

  return item.data as T;
}

function setCache<T>(
  key: string,
  data: T,
  ttl: number = TIME_CONSTANTS.DEFAULT_CACHE_TTL,
): void {
  memoryCache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

function deleteCache(key: string): void {
  memoryCache.delete(key);
}

/**
 * Get single token information
 */
export async function getTokenInfo(
  tokenAddress: `0x${string}`,
  config?: V3PoolConfig,
): Promise<TokenInfo> {
  const finalConfig = config || DEFAULT_CONFIG;
  const cacheKey = `token_info_${finalConfig.chainId}_${tokenAddress.toLowerCase()}`;

  // Try to get from cache
  const cached = getFromCache<TokenInfo>(cacheKey);
  if (cached) {
    logger.debug("[TokenInfo] Cache hit", {
      tokenAddress,
      chainId: finalConfig.chainId,
    });
    return cached;
  }

  // Fetch from blockchain
  const client = createClient(finalConfig);

  try {
    // Get token information using multicall
    const tokenData = await client.multicall({
      contracts: [
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
          args: [],
        },
      ],
      allowFailure: false,
      batchSize: 4096,
    });

    const [decimals, symbol, name] = tokenData;

    const tokenInfo: TokenInfo = {
      address: tokenAddress,
      symbol: symbol as string,
      decimals: Number(decimals),
      name: name as string,
    };

    // Cache result (5 minutes)
    setCache(cacheKey, tokenInfo, TIME_CONSTANTS.DEFAULT_CACHE_TTL);

    logger.info("[TokenInfo] Fetched token info", {
      tokenAddress,
      symbol: tokenInfo.symbol,
      chainId: finalConfig.chainId,
    });

    return tokenInfo;
  } catch (error) {
    logger.error("[TokenInfo] Error fetching token info", {
      tokenAddress,
      chainId: finalConfig.chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get token USD price (simplified version, can be obtained from CoinGecko, etc.)
 */
export async function getTokenPriceUSD(
  chainId: number,
  tokenAddress: `0x${string}`,
  symbol: string,
): Promise<number> {
  // Common stablecoin prices
  const stablecoinPrices: Record<string, number> = {
    USDT: 1.0,
    USDC: 1.0,
    BUSD: 1.0,
    DAI: 1.0,
  };

  if (stablecoinPrices[symbol]) {
    return stablecoinPrices[symbol];
  }

  // Try to get price from CoinGecko for unknown tokens
  try {
    const priceData = await getTokenPriceFromCoingecko(
      getCoinGeckoChainName(chainId),
      tokenAddress,
    );
    if (priceData && priceData.currentPrice > 0) {
      logger.info("[V3PoolAnalyzer] Found token price from CoinGecko", {
        symbol,
        address: tokenAddress,
        price: priceData.currentPrice,
      });
      return priceData.currentPrice;
    }
  } catch (error) {
    logger.warn("[V3PoolAnalyzer] Failed to get price from CoinGecko", {
      symbol,
      address: tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback to default price if CoinGecko fails
  logger.warn("[V3PoolAnalyzer] Unknown token price, using default", {
    symbol,
    address: tokenAddress,
  });
  return 0.1;
}
/**
 * Batch get token information
 */
export async function getBatchTokenInfo(
  tokenAddresses: `0x${string}`[],
  config?: V3PoolConfig,
): Promise<Record<string, TokenInfo>> {
  const finalConfig = config || DEFAULT_CONFIG;
  const result: Record<string, TokenInfo> = {};

  // Check cache first
  const uncachedAddresses: `0x${string}`[] = [];

  for (const address of tokenAddresses) {
    const cacheKey = `token_info_${finalConfig.chainId}_${address.toLowerCase()}`;
    const cached = getFromCache<TokenInfo>(cacheKey);

    if (cached) {
      result[address] = cached;
    } else {
      uncachedAddresses.push(address);
    }
  }

  // Batch fetch uncached token information
  if (uncachedAddresses.length) {
    const client = createClient(finalConfig);

    try {
      // Create multicall contracts for all uncached tokens
      const multicallContracts = uncachedAddresses.flatMap((address) => [
        {
          address,
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        },
        {
          address,
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        },
        {
          address,
          abi: ERC20_ABI,
          functionName: "name",
          args: [],
        },
      ]);

      // Execute multicall for all token data
      const batchData = await client.multicall({
        contracts: multicallContracts,
        allowFailure: false,
        batchSize: 4096,
      });

      // Process results in groups of 3 (decimals, symbol, name for each token)
      for (let i = 0; i < uncachedAddresses.length; i++) {
        const address = uncachedAddresses[i];
        const baseIndex = i * 3;
        const [decimals, symbol, name] = batchData.slice(
          baseIndex,
          baseIndex + 3,
        );

        const tokenInfo: TokenInfo = {
          address,
          symbol: symbol as string,
          decimals: Number(decimals),
          name: name as string,
        };

        // Cache result
        const cacheKey = `token_info_${finalConfig.chainId}_${address.toLowerCase()}`;
        setCache(cacheKey, tokenInfo, TIME_CONSTANTS.DEFAULT_CACHE_TTL);

        result[address] = tokenInfo;
      }

      logger.info("[TokenInfo] Batch fetched token info", {
        chainId: finalConfig.chainId,
        count: uncachedAddresses.length,
      });
    } catch (error) {
      logger.error("[TokenInfo] Error in batch fetch", {
        chainId: finalConfig.chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return result;
}

/**
 * Clear token cache
 */
export async function clearTokenCache(
  tokenAddress?: `0x${string}`,
): Promise<void> {
  if (tokenAddress) {
    // Clear cache for specific token across all chains
    const chainIds = [1, 56, 137, 42161, 10]; // Supported chains
    chainIds.forEach((chainId) => {
      const cacheKey = `token_info_${chainId}_${tokenAddress.toLowerCase()}`;
      deleteCache(cacheKey);
    });
    logger.info("[TokenInfo] Cleared cache for token", { tokenAddress });
  } else {
    // Clear all token cache
    memoryCache.clear();
    logger.info("[TokenInfo] Cleared all token cache");
  }
}
