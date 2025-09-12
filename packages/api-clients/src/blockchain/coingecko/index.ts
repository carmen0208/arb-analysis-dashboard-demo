/**
 * Blockchain API Clients - CoinGecko (Functional Approach)
 *
 * Main entry point for CoinGecko API functions.
 */

import { CACHE_DURATION, getPlatformFromChainId } from "./constants"; // Keep CACHE_DURATION
import { apiClient } from "./client"; // Import the apiClient instance
import { makeApiRequest } from "./request";
import { fileCacheAdapter as cache } from "@dex-ai/core";
import {
  CoinListInfo,
  CoinPlatformInfo,
  CoinDetailInfo,
  TokenInfo,
  Ticker,
  CoinTickerResponse,
  MarketChartDataPoint,
  MarketChartResponse,
  TokenPriceData,
} from "./types";
import logger from "../../../src/common/logger";
import { CacheAdapter } from "@dex-ai/core";

// Define the expected structure of the API response items
type MarketCoinData = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  // Add other fields if needed from the /coins/markets endpoint
};

async function getValidCacheOrNull<T>(
  cache: CacheAdapter,
  cacheName: string,
  cacheKeys: string[],
  forceRefresh: boolean,
): Promise<T | null> {
  if (forceRefresh) {
    logger.info("[CoinGecko] Forcing refresh, skipping cache check.");
    return null;
  }
  const cached = await cache.getFromCache<{ data: T; timestamp: string }>(
    cacheName,
    ...cacheKeys,
  );
  if (cached) {
    logger.info("[CoinGecko] Returning coins from valid cache", {
      coinCount: Array.isArray(cached.data) ? cached.data.length : undefined,
    });
    return cached.data;
  } else {
    logger.info("[CoinGecko] No cache found, will fetch fresh data");
    return null;
  }
}

/**
 * Fetches the complete list of coins from CoinGecko.
 */
export async function getAllCoinLists(
  forceRefresh: boolean = false,
): Promise<CoinListInfo[]> {
  logger.info("[CoinGecko] Fetching coin list", { forceRefresh });
  const cacheName = "coingecko";
  const cacheKeys = ["coinlist"];

  // Use abstracted cache check function
  const validCache = (await getValidCacheOrNull(
    cache,
    cacheName,
    cacheKeys,
    forceRefresh,
  )) as CoinListInfo[] | null;
  if (validCache) return validCache;

  // 2. Fetch fresh data if cache is invalid, missing, or refresh is forced
  try {
    logger.info("[CoinGecko] Fetching fresh coin list from API");
    const response = await makeApiRequest<CoinListInfo[]>(
      apiClient, // Pass apiClient
      "/coins/list",
      { include_platform: true },
      { operation: "getAllCoinLists" },
    );

    const freshData = response.data;
    logger.info("[CoinGecko] Successfully fetched coins from API", {
      coinCount: freshData.length,
    });

    // 3. Write fresh data to cache
    await cache.saveToCache<{ data: CoinListInfo[]; timestamp: string }>(
      cacheName,
      { data: freshData, timestamp: new Date().toISOString() },
      CACHE_DURATION,
      ...cacheKeys,
    );
    logger.info("[CoinGecko] Saved fresh data to cache");

    return freshData;
  } catch (fetchError) {
    logger.error("[CoinGecko] Error fetching coin list", {
      error:
        fetchError instanceof Error ? fetchError.message : String(fetchError),
      stack: fetchError instanceof Error ? fetchError.stack : undefined,
    });

    // Attempt to return stale cache as a last resort
    const cached = await cache.getFromCache<{
      data: CoinListInfo[];
      timestamp: string;
    }>(cacheName, ...cacheKeys);
    if (cached) {
      logger.warn("[CoinGecko] Returning potentially stale data from cache", {
        coinCount: cached.data.length,
      });
      return cached.data;
    } else {
      logger.error(
        "[CoinGecko] Fetch failed and cache is empty or unreadable.",
      );
      return [];
    }
  }
}

/**
 * Filters the master coin list based on a search query (id, symbol, or name).
 */
export async function getCoinInfo(query: string): Promise<CoinListInfo[]> {
  logger.info("[CoinGecko] Searching for coins", { query });

  try {
    // Ensure cache is populated or refreshed if needed
    const allCoins = await getAllCoinLists();

    if (!allCoins || allCoins.length === 0) {
      logger.warn("[CoinGecko] No coins found in the master list");
      return [];
    }

    const filteredCoins = filterCoinsByQuery(allCoins, query);

    logger.info("[CoinGecko] Found matching coins", {
      query,
      matchCount: filteredCoins.length,
      totalCoins: allCoins.length,
    });

    return filteredCoins;
  } catch (error) {
    logger.error("[CoinGecko] Error filtering coins", {
      query,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

export async function getCoinInfoBySymbol(
  symbol: string,
): Promise<CoinListInfo[]> {
  logger.info("[CoinGecko] Searching for coins by symbol", { symbol });

  try {
    const allCoins = await getAllCoinLists();

    if (!allCoins || allCoins.length === 0) {
      logger.warn("[CoinGecko] No coins found in the master list");
      return [];
    }

    const filteredCoins = filterCoinsBySymbol(allCoins, symbol);

    logger.info("[CoinGecko] Found matching coins", {
      symbol,
      matchCount: filteredCoins.length,
      totalCoins: allCoins.length,
    });

    return filteredCoins;
  } catch (error) {
    logger.error("[CoinGecko] Error filtering coins by symbol", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Helper function to filter coins by query
 */
function filterCoinsByQuery(
  coins: CoinListInfo[],
  query: string,
): CoinListInfo[] {
  const lowerCaseQuery = query.toLowerCase();
  return coins.filter(
    (coin) =>
      coin.id.toLowerCase().includes(lowerCaseQuery) ||
      coin.symbol.toLowerCase().includes(lowerCaseQuery) ||
      coin.name.toLowerCase().includes(lowerCaseQuery),
  );
}

/**
 * Helper function to filter coins by symbol
 */
function filterCoinsBySymbol(
  coins: CoinListInfo[],
  symbol: string,
): CoinListInfo[] {
  const lowerCaseSymbol = symbol.toLowerCase();
  return coins.filter((coin) => coin.symbol.toLowerCase() === lowerCaseSymbol);
}

/**
 * Get price data for a specific cryptocurrency by its CoinGecko ID.
 */
export async function getCoinPrice(
  id: string,
  currency: string = "usd",
): Promise<number | null> {
  logger.info("[CoinGecko] Fetching price", { id, currency });

  try {
    const response = await makeApiRequest<
      Record<string, Record<string, number>>
    >(
      apiClient,
      "/simple/price",
      { ids: id, vs_currencies: currency },
      { id, currency },
    ); // Pass apiClient

    // Safely access nested property
    const price = response.data?.[id]?.[currency] || null;

    logPriceResult(id, currency, price);

    return price;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching price", {
      id,
      currency,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Helper function to log price result
 */
function logPriceResult(
  id: string,
  currency: string,
  price: number | null,
): void {
  if (price === null) {
    logger.warn("[CoinGecko] No price data found", { id, currency });
  } else {
    logger.info("[CoinGecko] Successfully fetched price", {
      id,
      currency,
      price,
    });
  }
}

/**
 * Get platform-specific contract addresses for a coin by its CoinGecko ID.
 */
export async function getCoinAddresses(
  id: string,
): Promise<CoinPlatformInfo | null> {
  logger.info("[CoinGecko] Fetching addresses", { id });

  try {
    const params = {
      localization: false,
      tickers: false,
      market_data: false,
      community_data: false,
      developer_data: false,
      sparkline: false,
    };

    const response = await makeApiRequest<CoinDetailInfo>(
      apiClient, // Pass apiClient
      `/coins/${id}`,
      params,
      { id },
    );

    const platforms = response.data?.platforms || null;

    logPlatformsResult(id, platforms);

    return platforms;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching addresses", {
      id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Helper function to log platforms result
 */
function logPlatformsResult(
  id: string,
  platforms: CoinPlatformInfo | null,
): void {
  if (!platforms || Object.keys(platforms).length === 0) {
    logger.warn("[CoinGecko] No platform addresses found", { id });
  } else {
    logger.info("[CoinGecko] Successfully fetched addresses", {
      id,
      platforms,
      platformCount: Object.keys(platforms).length,
    });
  }
}

/**
 * Get market data for top tokens by market cap.
 */
export async function getTopTokens(limit: number = 10): Promise<TokenInfo[]> {
  logger.info("[CoinGecko] Fetching top tokens", { limit });

  try {
    const params = {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: limit,
      page: 1,
      sparkline: false,
      locale: "en",
    };

    const response = await makeApiRequest<MarketCoinData[]>(
      apiClient, // Pass apiClient
      "/coins/markets",
      params,
      { limit },
    );

    const marketData = response.data || [];

    logTopTokensResult(limit, marketData.length);

    return mapMarketDataToTokenInfo(marketData);
  } catch (error) {
    logger.error("[CoinGecko] Error fetching top tokens", {
      limit,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Helper function to log top tokens result
 */
function logTopTokensResult(limit: number, count: number): void {
  if (count === 0) {
    logger.warn("[CoinGecko] No top tokens found", { limit });
  } else {
    logger.info("[CoinGecko] Successfully fetched top tokens", {
      limit,
      tokenCount: count,
    });
  }
}

/**
 * Helper function to map market data to TokenInfo
 */
function mapMarketDataToTokenInfo(data: MarketCoinData[]): TokenInfo[] {
  // Ensure data is an array before mapping
  if (!Array.isArray(data)) {
    logger.warn("[CoinGecko] Market data is not an array, returning empty.", {
      data,
    });
    return [];
  }
  return data.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    price: coin.current_price,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    change24h: coin.price_change_percentage_24h,
    // platforms are not included in /coins/markets
  }));
}

/**
 * Fetch tickers for a specific coin by its CoinGecko ID.
 */
export async function getCoinTickers(
  id: string,
  options: {
    include_exchange_logo?: boolean;
    dex_pair_format?: "contract_address" | "symbol";
    exchange_ids?: string;
    page?: number;
  } = {},
): Promise<Ticker[]> {
  logger.info("[CoinGecko] Fetching coin tickers", { id, options });

  try {
    const params = {
      include_exchange_logo: true,
      dex_pair_format: "contract_address",
      ...options,
    };
    const response = await makeApiRequest<CoinTickerResponse>(
      apiClient,
      `/coins/${id}/tickers`,
      params,
      { id, operation: "getCoinTickers" },
    );

    const tickers = response.data?.tickers || [];
    logger.info("[CoinGecko] Successfully fetched tickers", {
      id,
      tickerCount: tickers.length,
    });

    return tickers;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching coin tickers", {
      id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get historical price data for a token
 * @param platform Platform ID (e.g., 'ethereum', 'binance-smart-chain')
 * @param contractAddress Token contract address
 * @param days Number of days (1, 14, 30, max)
 * @param currency Currency (default 'usd')
 */
export async function getTokenMarketChart(
  platform: string,
  contractAddress: string,
  days: number | "max" = 30,
  currency: string = "usd",
): Promise<MarketChartDataPoint[]> {
  logger.info("[CoinGecko] Fetching token market chart", {
    platform,
    contractAddress,
    days,
    currency,
  });

  try {
    const response = await makeApiRequest<MarketChartResponse>(
      apiClient,
      `/coins/${platform}/contract/${contractAddress}/market_chart`,
      {
        vs_currency: currency,
        days: days.toString(),
      },
      { operation: "getTokenMarketChart" },
    );

    const { prices, market_caps, total_volumes } = response.data;

    // Transform data format
    const chartData: MarketChartDataPoint[] = prices.map(
      ([timestamp, price], index) => ({
        timestamp,
        price,
        marketCap: market_caps[index]?.[1] || 0,
        volume: total_volumes[index]?.[1] || 0,
      }),
    );

    logger.info("[CoinGecko] Successfully fetched market chart", {
      platform,
      contractAddress,
      dataPoints: chartData.length,
    });

    return chartData;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching token market chart", {
      platform,
      contractAddress,
      days,
      currency,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get current price and basic information for a token
 * @param platform Platform ID
 * @param contractAddress Token contract address
 * @param currency Currency (default 'usd')
 */
export async function getTokenPrice(
  platform: string,
  contractAddress: string,
  currency: string = "usd",
): Promise<TokenPriceData | null> {
  logger.info("[CoinGecko] Fetching token price", {
    platform,
    contractAddress,
    currency,
  });

  try {
    // Get current price
    const priceResponse = await makeApiRequest<
      Record<string, Record<string, number>>
    >(
      apiClient,
      `/simple/token_price/${platform}`,
      {
        contract_addresses: contractAddress,
        vs_currencies: currency,
        include_market_cap: true,
        include_24hr_vol: true,
        include_24hr_change: true,
        include_last_updated_at: true,
      },
      { operation: "getTokenPrice" },
    );

    const tokenData =
      priceResponse.data[contractAddress.toLowerCase()] ||
      priceResponse.data[contractAddress];
    if (!tokenData) {
      logger.warn("[CoinGecko] Token not found", { platform, contractAddress });
      return null;
    }

    const result: TokenPriceData = {
      source: "coingecko",
      tokenAddress: contractAddress,
      platform,
      currentPrice: tokenData[currency] || 0,
      marketCap: tokenData[`${currency}_market_cap`] || 0,
      volume24h: tokenData[`${currency}_24h_vol`] || 0,
      priceChange24h: tokenData[`${currency}_24h_change`] || 0,
      lastUpdated: new Date(
        (tokenData.last_updated_at || Date.now() / 1000) * 1000,
      ).toISOString(),
    };

    logger.info("[CoinGecko] Successfully fetched token price", {
      platform,
      contractAddress,
      price: result.currentPrice,
    });

    return result;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching token price", {
      platform,
      contractAddress,
      currency,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get complete price data for a token (including historical data)
 * @param platform Platform ID
 * @param contractAddress Token contract address
 * @param days Number of days for historical data
 * @param currency Currency
 */
export async function getTokenFullPriceData(
  platform: string,
  contractAddress: string,
  days: number = 30,
  currency: string = "usd",
): Promise<TokenPriceData | null> {
  logger.info("[CoinGecko] Fetching full token price data", {
    platform,
    contractAddress,
    days,
    currency,
  });

  try {
    // Get current price and historical data in parallel
    const [priceData, historicalData] = await Promise.all([
      getTokenPrice(platform, contractAddress, currency),
      getTokenMarketChart(platform, contractAddress, days, currency),
    ]);

    if (!priceData) {
      return null;
    }

    // Merge data
    const fullData: TokenPriceData = {
      ...priceData,
      historicalData,
    };

    logger.info("[CoinGecko] Successfully fetched full token price data", {
      platform,
      contractAddress,
      currentPrice: fullData.currentPrice,
      historicalDataPoints: fullData.historicalData?.length || 0,
    });

    return fullData;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching full token price data", {
      platform,
      contractAddress,
      days,
      currency,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  // ... add more fields as needed
}

/**
 * Fetches market data for coins from CoinGecko.
 * @param params Object with CoinGecko /coins/markets parameters
 * @returns Array of market data objects
 */
export async function getCoinMarkets(params: {
  vs_currency: string;
  ids?: string; // comma-separated
  order?: string;
  per_page?: number;
  page?: number;
  sparkline?: boolean;
  price_change_percentage?: string;
}): Promise<CoinMarketData[]> {
  const response = await makeApiRequest<CoinMarketData[]>(
    apiClient,
    "/coins/markets",
    params,
    { operation: "getCoinMarkets" },
  );
  return response.data;
}

/**
 * Get token price from CoinGecko by chain ID
 */
export async function getTokenPriceByChainId(
  chainId: number,
  tokenAddress: string,
  currency: string = "usd",
): Promise<TokenPriceData | null> {
  const platform = getPlatformFromChainId(chainId);

  if (!platform) {
    logger.warn("[CoinGecko] Unsupported chain ID for price lookup", {
      chainId,
      tokenAddress,
    });
    return null;
  }

  try {
    const priceData = await getTokenPrice(platform, tokenAddress, currency);
    if (!priceData) return null;

    return {
      source: "coingecko",
      tokenAddress,
      platform,
      currentPrice: priceData.currentPrice,
      marketCap: priceData.marketCap,
      volume24h: priceData.volume24h,
      priceChange24h: priceData.priceChange24h,
      lastUpdated: priceData.lastUpdated,
    };
  } catch (error) {
    logger.error("[CoinGecko] Error getting token price by chain ID", {
      chainId,
      platform,
      tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Export Top Pools API functions
export * from "./pools";

// Export types for convenience if needed by consumers
export * from "./types";
