import {
  FuturesKlineInterval,
  RestClientV2,
  FuturesCandlestickV2,
} from "bitget-api";
import { getLogger, Logger } from "@dex-ai/core";

const logger: Logger = getLogger("bitget-perp-mark-price");

// Request parameters for Bitget futures kline API
interface BitgetKlineRequestParams {
  productType: "USDT-FUTURES";
  symbol: string;
  granularity: FuturesKlineInterval;
  limit: string;
  startTime?: string;
  endTime?: string;
}

// Types for Bitget mark price data
export interface BitgetMarkPriceKline {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

export interface BitgetMarkPriceHistory {
  timestamp: string;
  price: number;
  source: string;
}

export interface BitgetMarkPriceWithHistory {
  currentPrice: number | null;
  history: BitgetMarkPriceHistory[];
}

/**
 * Create Bitget client instance
 */
function createBitgetClient(): RestClientV2 {
  logger.debug("[Bitget Perp] Creating RestClientV2 instance");
  return new RestClientV2();
}

function formatTimeInterval(input: string): string {
  return input.replace(/(\d+)([mHDWM])(utc)?/gi, (match, number, unit, utc) => {
    const normalizedUnit =
      unit.toLowerCase() === "m" ? "m" : unit.toUpperCase();
    return `${number}${normalizedUnit}${utc || ""}`;
  });
}

/**
 * Get simplified historical price data for Bitget perpetual contracts (only returns closing price and timestamp)
 */
export async function getMarkPriceHistory(
  symbol: string,
  days: number = 7,
): Promise<BitgetMarkPriceHistory[] | null> {
  logger.info("[Bitget Perp] Fetching mark price history", {
    symbol,
    days,
  });

  try {
    // Choose appropriate interval and limit based on days
    let interval: "1m" | "1h" | "4h" | "1d" = "1m";
    let limit = 500;

    if (days <= 1) {
      interval = "1m";
      limit = 24 * 60;
    } else if (days <= 7) {
      interval = "1h";
      limit = days * 24;
    } else if (days <= 30) {
      interval = "4h";
      limit = Math.min(days * 6, 100);
    } else {
      interval = "1d";
      limit = Math.min(days, 100);
    }

    const klines = await getMarkPriceKlinesWithPagination(
      symbol,
      interval,
      limit,
    );

    if (!klines) {
      return null;
    }

    // Convert to simplified price data format
    const priceHistory = klines.map((kline) => ({
      timestamp: kline.timestamp,
      price: kline.close, // Use closing price as the price for this time period
      source: kline.source,
    }));

    logger.info("[Bitget Perp] Successfully fetched mark price history", {
      symbol,
      days,
      interval,
      priceCount: priceHistory.length,
    });

    return priceHistory;
  } catch (error) {
    logger.error("[Bitget Perp] Failed to fetch mark price history", {
      symbol,
      days,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get current price and historical data for Bitget perpetual contracts (single API call)
 * Reference Binance implementation to avoid duplicate API calls
 */
export async function getMarkPriceWithHistory(
  symbol: string,
  days: number = 7,
): Promise<BitgetMarkPriceWithHistory | null> {
  logger.info("[Bitget Perp] Fetching mark price with history", {
    symbol,
    days,
  });

  try {
    if (!symbol) {
      logger.error("[Bitget Perp] Missing required parameter: symbol");
      return null;
    }

    // Get historical data, the latest K-line data contains current price information
    const history = await getMarkPriceHistory(symbol, days);

    if (!history || history.length === 0) {
      return null;
    }

    // Use the latest price as current price
    const currentPrice = history[history.length - 1]?.price || null;

    logger.info("[Bitget Perp] Successfully fetched mark price with history", {
      symbol,
      days,
      currentPrice,
      historyCount: history.length,
    });

    return {
      currentPrice,
      history,
    };
  } catch (error) {
    logger.error("[Bitget Perp] Failed to fetch mark price with history", {
      symbol,
      days,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get complete K-line data for Bitget perpetual contracts, supports fetching more than 1000 data points
 * Handle API limitations through pagination and startTime/endTime parameters
 */
export async function getMarkPriceKlinesWithPagination(
  symbol: string,
  interval:
    | "1m"
    | "3m"
    | "5m"
    | "15m"
    | "30m"
    | "1h"
    | "2h"
    | "4h"
    | "6h"
    | "8h"
    | "12h"
    | "1d"
    | "3d"
    | "1w"
    | "1M" = "1m",
  limit: number = 200,
  startTime?: string,
  endTime?: string,
): Promise<BitgetMarkPriceKline[] | null> {
  logger.info("[Bitget Perp] Fetching mark price klines with pagination", {
    symbol,
    interval,
    limit,
    startTime,
    endTime,
  });

  try {
    if (!symbol) {
      logger.error("[Bitget Perp] Missing required parameter: symbol");
      return null;
    }

    const client = createBitgetClient();
    const maxLimit = 200; // Maximum limit for Bitget API
    const allKlines: BitgetMarkPriceKline[] = [];
    const currentStartTime = startTime;
    let remainingLimit = limit;

    while (remainingLimit > 0) {
      const currentLimit = Math.min(remainingLimit, maxLimit);

      logger.debug("[Bitget Perp] Fetching batch", {
        symbol,
        interval,
        currentLimit,
        currentStartTime,
        remainingLimit,
      });

      // Build request parameters
      const requestParams: BitgetKlineRequestParams = {
        productType: "USDT-FUTURES",
        symbol,
        granularity: formatTimeInterval(interval) as FuturesKlineInterval,
        limit: currentLimit.toString(),
      };

      // Add time parameters
      if (currentStartTime) {
        requestParams.startTime = currentStartTime;
      }
      if (endTime) {
        requestParams.endTime = endTime;
      }

      const response =
        await client.getFuturesHistoricMarkPriceCandles(requestParams);
      if (!response || !response.data || !Array.isArray(response.data)) {
        logger.warn("[Bitget Perp] No klines response received for batch", {
          symbol,
          currentStartTime,
          currentLimit,
        });
        break;
      }
      // Convert K-line data format
      const batchKlines = response.data.map((kline: FuturesCandlestickV2) => ({
        timestamp: kline[0], // Opening time
        open: Number(kline[1]), // Opening price
        high: Number(kline[2]), // Highest price
        low: Number(kline[3]), // Lowest price
        close: Number(kline[4]), // Closing price
        volume: Number(kline[5]), // Trading volume
        source: "bitget",
      }));

      allKlines.push(...batchKlines);

      // If returned data is less than requested limit, we have reached the end of data
      if (batchKlines.length < currentLimit) {
        break;
      }

      // Update start time for next request (using timestamp of last data point)
      // if (batchKlines.length > 0) {
      //   const lastTimestamp = batchKlines[batchKlines.length - 1].timestamp;
      //   currentStartTime = lastTimestamp;
      // }
      if (batchKlines.length > 0) {
        const earlierTimestamp = batchKlines[0].timestamp;
        endTime = earlierTimestamp;
      }

      remainingLimit -= batchKlines.length;

      // Add delay to avoid triggering rate limits
      if (remainingLimit > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(
      "[Bitget Perp] Successfully fetched mark price klines with pagination",
      {
        symbol,
        interval,
        requestedLimit: limit,
        actualCount: allKlines.length,
        batches: Math.ceil(limit / maxLimit),
      },
    );

    return allKlines;
  } catch (error) {
    logger.error(
      "[Bitget Perp] Failed to fetch mark price klines with pagination",
      {
        symbol,
        interval,
        limit,
        startTime,
        endTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return null;
  }
}
