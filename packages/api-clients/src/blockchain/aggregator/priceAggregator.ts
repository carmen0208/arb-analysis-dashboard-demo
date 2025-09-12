/**
 * Price Aggregator - Multi-source Token Price Data
 *
 * Aggregates price data from multiple sources (CoinGecko, Bybit, OKX Dex, etc.)
 * to provide comprehensive price information for tokens.
 */

import { getTokenFullPriceData } from "../coingecko";
import { PriceDataPoint, MultiSourcePriceData } from "../coingecko/types";
import { PriceSourceName } from "../coingecko/types";
import {
  getOkxDexCandles,
  convertOkxCandlesToPriceData,
  OKX_DEX_CHAIN_INDEX,
} from "../okexchange/dex";
import { OkxDexCandleData } from "../okexchange/types";
import { getBybitKlineForDays } from "../bybit/perp";
import { getMarkPriceWithHistory as getBinanceMarkPriceWithHistory } from "../binance/perp";
import { getMarkPriceWithHistory as getBitgetMarkPriceWithHistory } from "../bitget/perp/markPrice";
import logger from "../../common/logger";

export interface PriceSource {
  name: PriceSourceName;
  enabled: boolean;
  priority: number; // Lower number = higher priority
}

export interface PriceAggregatorConfig {
  sources: {
    [PriceSourceName.COINGECKO]: PriceSource;
    [PriceSourceName.BYBIT]: PriceSource;
    [PriceSourceName.OKX]: PriceSource;
    [PriceSourceName.BINANCE]: PriceSource;
    [PriceSourceName.BITGET]: PriceSource;
    // Add more sources as needed
  };
  defaultDays: number;
  defaultCurrency: string;
}

export const DEFAULT_CONFIG: PriceAggregatorConfig = {
  sources: {
    [PriceSourceName.COINGECKO]: {
      name: PriceSourceName.COINGECKO,
      enabled: false,
      priority: 1,
    },
    [PriceSourceName.BYBIT]: {
      name: PriceSourceName.BYBIT,
      enabled: true,
      priority: 2,
    },
    [PriceSourceName.OKX]: {
      name: PriceSourceName.OKX,
      enabled: true,
      priority: 3,
    },
    [PriceSourceName.BINANCE]: {
      name: PriceSourceName.BINANCE,
      enabled: true,
      priority: 4,
    },
    [PriceSourceName.BITGET]: {
      name: PriceSourceName.BITGET,
      enabled: true,
      priority: 5,
    },
  },
  defaultDays: 1,
  defaultCurrency: "usd",
};

/**
 * Get Bybit price data
 * Use mark price K-line data, which is the standard way to get current price in perpetual contracts
 */
async function fetchBybitPriceData(
  tokenAddress: string,
  days: number,
  tokenSymbol?: string, // New: optional token symbol parameter
): Promise<{
  currentPrice: number;
  historicalData: Array<{ timestamp: number; price: number; source: string }>;
}> {
  try {
    logger.info("[PriceAggregator] Fetching Bybit price data", {
      tokenAddress,
      days,
      tokenSymbol,
    });

    // Prioritize using passed symbol, if not available try to parse
    let bybitSymbol: string | null = null;

    if (!tokenSymbol) {
      logger.error("[PriceAggregator] No token symbol provided", {
        tokenAddress,
      });
      return {
        currentPrice: 0,
        historicalData: [],
      };
    }

    bybitSymbol = `${tokenSymbol}USDT`;
    logger.info("[PriceAggregator] Using provided symbol", {
      tokenAddress,
      tokenSymbol,
      bybitSymbol,
    });

    // Get K-line data
    const klineData = await getBybitKlineForDays(bybitSymbol, days, "1");

    if (!klineData.length) {
      logger.warn("[PriceAggregator] No Bybit kline data available", {
        tokenAddress,
        bybitSymbol,
      });
      return {
        currentPrice: 0,
        historicalData: [],
      };
    }

    // Get current price - use latest mark price K-line closing price
    // Bybit already uses getMarkPriceKline API, so the closing price here is the current price of perpetual contract
    const currentPrice = klineData[klineData.length - 1]?.price || 0;

    logger.info("[PriceAggregator] Bybit data fetched successfully", {
      tokenAddress,
      bybitSymbol,
      dataPoints: klineData.length,
      currentPrice,
    });

    return {
      currentPrice,
      historicalData: klineData,
    };
  } catch (error) {
    logger.error("[PriceAggregator] Bybit fetch failed", {
      tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      currentPrice: 0,
      historicalData: [],
    };
  }
}

/**
 * Get OKX Dex paginated price data
 */
async function fetchOkxDexPriceData(
  tokenAddress: string,
  days: number,
): Promise<{
  currentPrice: number;
  historicalData: Array<{ timestamp: number; price: number; source: string }>;
}> {
  const chainIndex = OKX_DEX_CHAIN_INDEX; // Fixed to use BSC

  // Calculate required data amount
  const totalMinutes = days * 1440; // Maximum 1440 1-minute K-lines per day
  const maxLimitPerRequest = 299; // Maximum limit per request for OKX API

  // Calculate how many requests needed
  const numRequests = Math.ceil(totalMinutes / maxLimitPerRequest);

  logger.info("[PriceAggregator] OKX Dex pagination calculation", {
    tokenAddress,
    totalMinutes,
    maxLimitPerRequest,
    numRequests,
  });

  // Paginate to get all data
  const allCandlesData: OkxDexCandleData[] = [];
  let after: string | undefined; // Timestamp for pagination
  let remainingMinutes = totalMinutes; // Track remaining minutes to fetch

  for (let i = 0; i < numRequests; i++) {
    const limit = Math.min(maxLimitPerRequest, remainingMinutes);

    if (limit <= 0) break;

    logger.debug("[PriceAggregator] OKX Dex making request", {
      tokenAddress,
      requestIndex: i + 1,
      numRequests,
      limit,
      remainingMinutes,
      after: after || "latest",
    });

    const candlesData = await getOkxDexCandles({
      chainIndex,
      tokenContractAddress: tokenAddress,
      bar: "1m",
      limit,
      after, // Use before parameter for pagination
    });

    if (candlesData?.length) {
      allCandlesData.push(...candlesData);

      // Update remaining minutes (based on actual data points fetched)
      remainingMinutes -= candlesData.length;

      // Set before parameter for next request (using earliest timestamp)
      const earliestTimestamp = Math.min(
        ...candlesData.map((candle) => Number(candle.ts)),
      );
      after = earliestTimestamp.toString();

      logger.debug("[PriceAggregator] OKX Dex request completed", {
        tokenAddress,
        requestIndex: i + 1,
        dataReceived: candlesData.length,
        totalDataSoFar: allCandlesData.length,
        remainingMinutes,
        nextAfter: after,
      });
    } else {
      // If no more data, exit loop
      logger.debug("[PriceAggregator] OKX Dex no more data available", {
        tokenAddress,
        requestIndex: i + 1,
      });
      break;
    }

    // Add delay to avoid API limits
    if (i < numRequests - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (!allCandlesData.length) {
    return {
      currentPrice: 0,
      historicalData: [],
    };
  }

  // Sort by timestamp (earliest to latest)
  allCandlesData.sort((a, b) => Number(a.ts) - Number(b.ts));

  const priceData = convertOkxCandlesToPriceData(allCandlesData);

  return {
    currentPrice: priceData[priceData.length - 1]?.price || 0,
    historicalData: priceData,
  };
}

/**
 * Get Binance price data
 */
async function fetchBinancePriceData(
  tokenAddress: string,
  days: number,
  tokenSymbol?: string,
): Promise<{
  currentPrice: number;
  historicalData: Array<{
    timestamp: number;
    price: number;
    source: string;
  }>;
}> {
  try {
    logger.info("[PriceAggregator] Fetching Binance price data", {
      tokenAddress,
      days,
      tokenSymbol,
    });

    if (!tokenSymbol) {
      logger.error("[PriceAggregator] No token symbol provided for Binance", {
        tokenAddress,
      });
      return {
        currentPrice: 0,
        historicalData: [],
      };
    }

    const binanceSymbol = `${tokenSymbol}USDT`;
    logger.info("[PriceAggregator] Using Binance symbol", {
      tokenAddress,
      tokenSymbol,
      binanceSymbol,
    });

    // Get current price and historical data (single API call)
    let currentPrice: number;
    let historicalData: Array<{
      timestamp: number;
      price: number;
      source: string;
    }> = [];

    try {
      // Use new getMarkPriceWithHistory method to get current price and historical data in one call
      const binanceData = await getBinanceMarkPriceWithHistory(
        binanceSymbol,
        days,
      );
      if (binanceData && binanceData.history && binanceData.history.length) {
        // Directly use closing price of latest K-line data as current price, just like bybit
        currentPrice =
          binanceData.history[binanceData.history.length - 1]?.price || 0;
        historicalData = binanceData.history;
      } else {
        // If no historical data, return 0
        currentPrice = 0;
        historicalData = [];
      }
    } catch (historyError) {
      logger.warn("[PriceAggregator] Failed to fetch Binance data", {
        tokenAddress,
        binanceSymbol,
        error:
          historyError instanceof Error
            ? historyError.message
            : String(historyError),
      });
      // If data fetch fails, return 0
      currentPrice = 0;
      historicalData = [];
    }

    logger.info("[PriceAggregator] Binance data fetched successfully", {
      tokenAddress,
      binanceSymbol,
      currentPrice,
      historicalDataLength: historicalData.length,
    });

    return {
      currentPrice,
      historicalData,
    };
  } catch (error) {
    logger.error("[PriceAggregator] Binance fetch failed", {
      tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      currentPrice: 0,
      historicalData: [],
    };
  }
}

/**
 * Get Bitget price data
 * Use getMarkPriceWithHistory function from markPrice.ts to get mark price data
 */
async function fetchBitgetPriceData(
  tokenAddress: string,
  days: number,
  tokenSymbol?: string,
): Promise<{
  currentPrice: number;
  historicalData: Array<{
    timestamp: number;
    price: number;
    source: string;
  }>;
}> {
  try {
    logger.info("[PriceAggregator] Fetching Bitget price data", {
      tokenAddress,
      days,
      tokenSymbol,
    });

    if (!tokenSymbol) {
      logger.error("[PriceAggregator] No token symbol provided for Bitget", {
        tokenAddress,
      });
      return {
        currentPrice: 0,
        historicalData: [],
      };
    }

    const bitgetSymbol = `${tokenSymbol}USDT`;
    logger.info("[PriceAggregator] Using Bitget symbol", {
      tokenAddress,
      tokenSymbol,
      bitgetSymbol,
    });

    // Use getMarkPriceWithHistory function from markPrice.ts to get data
    const bitgetData = await getBitgetMarkPriceWithHistory(bitgetSymbol, days);

    if (!bitgetData?.history?.length) {
      logger.warn("[PriceAggregator] No Bitget mark price data available", {
        tokenAddress,
        bitgetSymbol,
      });
      return {
        currentPrice: 0,
        historicalData: [],
      };
    }

    // Use latest mark price as current price
    const currentPrice =
      bitgetData.currentPrice ||
      bitgetData.history[bitgetData.history.length - 1]?.price ||
      0;

    // Convert historical data format
    const historicalData = bitgetData.history.map((item) => ({
      timestamp: Number(item.timestamp),
      price: item.price,
      source: item.source,
    }));

    logger.info("[PriceAggregator] Bitget data fetched successfully", {
      tokenAddress,
      bitgetSymbol,
      currentPrice,
      dataPoints: historicalData.length,
    });

    return {
      currentPrice,
      historicalData,
    };
  } catch (error) {
    logger.error("[PriceAggregator] Bitget fetch failed", {
      tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      currentPrice: 0,
      historicalData: [],
    };
  }
}

/**
 * Get multi-source price data for token
 */
export async function getMultiSourceTokenPrice(
  tokenAddress: string,
  tokenSymbol: string, // New: optional token symbol parameter
  platform: string = "ethereum",
  config: Partial<PriceAggregatorConfig> = {},
): Promise<MultiSourcePriceData> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const enabledSources = Object.entries(finalConfig.sources)
    .filter(([_, source]) => source.enabled)
    .sort(([_, a], [__, b]) => a.priority - b.priority);

  logger.info("[PriceAggregator] Fetching multi-source price data", {
    tokenAddress,
    platform,
    enabledSources: enabledSources.map(([name]) => name),
  });

  const sources: MultiSourcePriceData["sources"] = {};

  // Parallel fetch from all enabled data sources
  const promises = enabledSources.map(async ([sourceName]) => {
    try {
      switch (sourceName) {
        case PriceSourceName.COINGECKO: {
          const coingeckoData = await getTokenFullPriceData(
            platform,
            tokenAddress,
            finalConfig.defaultDays,
            finalConfig.defaultCurrency,
          );

          if (coingeckoData) {
            sources[PriceSourceName.COINGECKO] = {
              currentPrice: coingeckoData.currentPrice,
              lastUpdated: coingeckoData.lastUpdated,
              historicalData: coingeckoData.historicalData?.map((point) => ({
                timestamp: point.timestamp,
                price: point.price,
                source: "coingecko",
              })),
            };
          }
          break;
        }

        case PriceSourceName.BYBIT: {
          try {
            const { currentPrice, historicalData } = await fetchBybitPriceData(
              tokenAddress,
              finalConfig.defaultDays,
              tokenSymbol,
            );

            logger.info("[PriceAggregator] Bybit data fetched successfully", {
              tokenAddress,
              dataPoints: historicalData.length,
              currentPrice: currentPrice,
            });

            sources[PriceSourceName.BYBIT] = {
              currentPrice: currentPrice,
              lastUpdated: new Date().toISOString(),
              historicalData: historicalData,
            };
          } catch (error) {
            logger.error("[PriceAggregator] Bybit fetch failed", {
              tokenAddress,
              platform,
              error: error instanceof Error ? error.message : String(error),
            });

            // Set error state but don't block other data sources
            sources[PriceSourceName.BYBIT] = {
              currentPrice: 0,
              lastUpdated: new Date().toISOString(),
              historicalData: [],
            };
          }
          break;
        }

        case PriceSourceName.OKX: {
          try {
            const { currentPrice, historicalData } = await fetchOkxDexPriceData(
              tokenAddress,
              finalConfig.defaultDays,
            );

            logger.info("[PriceAggregator] OKX Dex data fetched successfully", {
              tokenAddress,
              dataPoints: historicalData.length,
              currentPrice: currentPrice,
            });

            sources[PriceSourceName.OKX] = {
              currentPrice: currentPrice,
              lastUpdated: new Date().toISOString(),
              historicalData: historicalData,
            };
          } catch (error) {
            logger.error("[PriceAggregator] OKX Dex fetch failed", {
              tokenAddress,
              platform,
              error: error instanceof Error ? error.message : String(error),
            });

            // Set error state but don't block other data sources
            sources[PriceSourceName.OKX] = {
              currentPrice: 0,
              lastUpdated: new Date().toISOString(),
              historicalData: [],
            };
          }
          break;
        }

        case PriceSourceName.BINANCE: {
          try {
            const { currentPrice, historicalData } =
              await fetchBinancePriceData(
                tokenAddress,
                finalConfig.defaultDays,
                tokenSymbol,
              );

            logger.info("[PriceAggregator] Binance data fetched successfully", {
              tokenAddress,
              dataPoints: historicalData.length,
              currentPrice: currentPrice,
            });

            sources[PriceSourceName.BINANCE] = {
              currentPrice: currentPrice,
              lastUpdated: new Date().toISOString(),
              historicalData: historicalData,
            };
          } catch (error) {
            logger.error("[PriceAggregator] Binance fetch failed", {
              tokenAddress,
              platform,
              error: error instanceof Error ? error.message : String(error),
            });

            // Set error state but don't block other data sources
            sources[PriceSourceName.BINANCE] = {
              currentPrice: 0,
              lastUpdated: new Date().toISOString(),
              historicalData: [],
            };
          }
          break;
        }

        case PriceSourceName.BITGET: {
          try {
            const { currentPrice, historicalData } = await fetchBitgetPriceData(
              tokenAddress,
              finalConfig.defaultDays,
              tokenSymbol,
            );

            logger.info("[PriceAggregator] Bitget data fetched successfully", {
              tokenAddress,
              dataPoints: historicalData.length,
              currentPrice: currentPrice,
            });

            sources[PriceSourceName.BITGET] = {
              currentPrice: currentPrice,
              lastUpdated: new Date().toISOString(),
              historicalData: historicalData,
            };
          } catch (error) {
            logger.error("[PriceAggregator] Bitget fetch failed", {
              tokenAddress,
              platform,
              error: error instanceof Error ? error.message : String(error),
            });

            // Set error state but don't block other data sources
            sources[PriceSourceName.BITGET] = {
              currentPrice: 0,
              lastUpdated: new Date().toISOString(),
              historicalData: [],
            };
          }
          break;
        }

        default:
          logger.warn("[PriceAggregator] Unknown source", { sourceName });
      }
    } catch (error) {
      logger.error("[PriceAggregator] Error fetching from source", {
        sourceName,
        tokenAddress,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await Promise.all(promises);

  const result: MultiSourcePriceData = {
    tokenAddress,
    sources,
  };

  logger.info("[PriceAggregator] Completed multi-source price fetch", {
    tokenAddress,
    sourcesCount: Object.keys(sources).length,
    sources: Object.keys(sources),
  });

  return result;
}

/**
 * Get current price for token (from all available sources)
 */
export async function getCurrentTokenPrice(
  tokenAddress: string,
  tokenSymbol: string, // New: optional token symbol parameter
  platform: string = "ethereum",
  config: Partial<PriceAggregatorConfig> = {},
): Promise<{ [source: string]: number }> {
  const multiSourceData = await getMultiSourceTokenPrice(
    tokenAddress,
    tokenSymbol,
    platform,
    config,
  );

  const currentPrices: { [source: string]: number } = {};

  Object.entries(multiSourceData.sources).forEach(([source, data]) => {
    currentPrices[source] = data.currentPrice;
  });

  return currentPrices;
}

/**
 * Get historical price data for token (from all available sources)
 */
export async function getHistoricalTokenPrices(
  tokenAddress: string,
  tokenSymbol: string,
  platform: string = "binance-smart-chain",
  config: Partial<PriceAggregatorConfig> = {},
): Promise<{ [source: string]: PriceDataPoint[] }> {
  const multiSourceData = await getMultiSourceTokenPrice(
    tokenAddress,
    tokenSymbol, // Pass symbol parameter
    platform,
    config,
  );

  const historicalData: { [source: string]: PriceDataPoint[] } = {};

  Object.entries(multiSourceData.sources).forEach(([source, data]) => {
    if (data.historicalData) {
      historicalData[source] = data.historicalData;
    }
  });

  return historicalData;
}

/**
 * Compare price differences between different data sources
 */
export function comparePriceSources(multiSourceData: MultiSourcePriceData): {
  source: string;
  price: number;
  difference: number;
  percentageDiff: number;
}[] {
  const prices = Object.entries(multiSourceData.sources).map(
    ([source, data]) => ({
      source,
      price: data.currentPrice,
    }),
  );

  if (prices.length < 2) {
    return prices.map((p) => ({
      ...p,
      difference: 0,
      percentageDiff: 0,
    }));
  }

  // Use first price as benchmark
  const basePrice = prices[0].price;

  return prices.map(({ source, price }) => ({
    source,
    price,
    difference: price - basePrice,
    percentageDiff: basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0,
  }));
}
