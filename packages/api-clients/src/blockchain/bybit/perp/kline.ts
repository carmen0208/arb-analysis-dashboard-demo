import { OHLCKlineV5, RestClientV5 } from "bybit-api";
import { getLogger, Logger } from "@dex-ai/core";

const logger: Logger = getLogger("bybit-perp-kline");

// Use Bybit API native types
export type BybitKlineInterval =
  | "1"
  | "3"
  | "5"
  | "15"
  | "30"
  | "60"
  | "120"
  | "240"
  | "360"
  | "720"
  | "D"
  | "M"
  | "W";

export interface BybitKlineData {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
}

export interface BybitKlineResponse {
  symbol: string;
  category: string;
  list: BybitKlineData[];
}

/**
 * Get Bybit K-line data
 * @param symbol Trading pair symbol, e.g. "BTCUSDT"
 * @param interval K-line interval, e.g. "1", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W"
 * @param start Start timestamp (milliseconds)
 * @param end End timestamp (milliseconds)
 * @param limit Limit count, maximum 1000, default 200
 * @returns K-line data
 */
export async function getBybitKline(
  symbol: string,
  interval: BybitKlineInterval = "1",
  start?: number,
  end?: number,
  limit: number = 200,
): Promise<BybitKlineResponse | null> {
  try {
    const client = new RestClientV5();

    logger.info("[Bybit Kline] Fetching kline data", {
      symbol,
      interval,
      start,
      end,
      limit,
    });

    const response = await client.getMarkPriceKline({
      category: "linear",
      symbol,
      interval,
      start,
      end,
      limit,
    });

    if (response.retCode !== 0) {
      logger.error("[Bybit Kline] API error", {
        symbol,
        retCode: response.retCode,
        retMsg: response.retMsg,
      });
      return null;
    }

    logger.info("[Bybit Kline] Successfully fetched kline data", {
      symbol,
      dataPoints: response.result?.list?.length || 0,
    });

    // Convert API response to our types
    if (response.result) {
      return {
        symbol: response.result.symbol,
        category: response.result.category,
        list: response.result.list.map((item: OHLCKlineV5) => ({
          startTime: item[0],
          openPrice: item[1],
          highPrice: item[2],
          lowPrice: item[3],
          closePrice: item[4],
        })),
      };
    }

    return null;
  } catch (error) {
    logger.error("[Bybit Kline] Failed to fetch kline data", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get Bybit Mark Price K-line data
 * @param symbol Trading pair symbol, e.g. "BTCUSDT"
 * @param interval K-line interval
 * @param start Start timestamp (milliseconds)
 * @param end End timestamp (milliseconds)
 * @param limit Limit count
 * @returns Mark Price K-line data
 */
export async function getBybitMarkPriceKline(
  symbol: string,
  interval: BybitKlineInterval = "1",
  start?: number,
  end?: number,
  limit: number = 200,
): Promise<BybitKlineResponse | null> {
  try {
    const client = new RestClientV5();

    logger.info("[Bybit Mark Price Kline] Fetching mark price kline data", {
      symbol,
      interval,
      start,
      end,
      limit,
    });

    const response = await client.getMarkPriceKline({
      category: "linear",
      symbol,
      interval,
      start,
      end,
      limit,
    });

    if (response.retCode !== 0) {
      logger.error("[Bybit Mark Price Kline] API error", {
        symbol,
        retCode: response.retCode,
        retMsg: response.retMsg,
      });
      return null;
    }

    logger.info(
      "[Bybit Mark Price Kline] Successfully fetched mark price kline data",
      {
        symbol,
        dataPoints: response.result?.list?.length || 0,
      },
    );

    // Convert API response to our types
    if (response.result) {
      return {
        symbol: response.result.symbol,
        category: response.result.category,
        list: response.result.list.map((item: OHLCKlineV5) => ({
          startTime: item[0],
          openPrice: item[1],
          highPrice: item[2],
          lowPrice: item[3],
          closePrice: item[4],
        })),
      };
    }

    return null;
  } catch (error) {
    logger.error(
      "[Bybit Mark Price Kline] Failed to fetch mark price kline data",
      {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}

/**
 * Convert Bybit K-line data to price data points
 * @param klineData Bybit K-line data
 * @returns Price data points array
 */
export function convertBybitKlineToPriceData(
  klineData: BybitKlineData[],
): Array<{ timestamp: number; price: number; source: string }> {
  return klineData.map((kline) => ({
    timestamp: Number(kline.startTime),
    price: Number(kline.closePrice),
    source: "bybit",
  }));
}

/**
 * Get Bybit K-line data for specified days (supports pagination)
 * @param symbol Trading pair symbol
 * @param days Number of days
 * @param interval K-line interval, default 1 minute
 * @returns Price data points array
 */
export async function getBybitKlineForDays(
  symbol: string,
  days: number,
  interval: BybitKlineInterval = "1",
): Promise<Array<{ timestamp: number; price: number; source: string }>> {
  const maxLimitPerRequest = 1000; // Bybit API single request maximum limit
  const minutesPerDay = 1440; // 1 day = 1440 minutes
  const totalMinutes = days * minutesPerDay;

  // Calculate how many requests are needed
  const numRequests = Math.ceil(totalMinutes / maxLimitPerRequest);

  logger.info("[Bybit Kline] Pagination calculation", {
    symbol,
    days,
    totalMinutes,
    maxLimitPerRequest,
    numRequests,
  });

  const allKlineData: BybitKlineData[] = [];
  let endTime: number | undefined; // Timestamp for pagination
  let remainingMinutes = totalMinutes; // Track remaining minutes to fetch

  for (let i = 0; i < numRequests; i++) {
    const limit = Math.min(maxLimitPerRequest, remainingMinutes);

    if (limit <= 0) break;

    logger.debug("[Bybit Kline] Making request", {
      symbol,
      requestIndex: i + 1,
      numRequests,
      limit,
      remainingMinutes,
      endTime: endTime || "latest",
    });

    const klineResponse = await getBybitKline(
      symbol,
      interval,
      undefined, // start
      endTime, // end
      limit,
    );

    if (klineResponse && klineResponse.list && klineResponse.list.length > 0) {
      allKlineData.push(...klineResponse.list);

      // Update remaining minutes (based on actual data points fetched)
      remainingMinutes -= klineResponse.list.length;

      // Set endTime parameter for next request (using earliest timestamp)
      const earliestTimestamp = Math.min(
        ...klineResponse.list.map((kline) => Number(kline.startTime)),
      );
      endTime = earliestTimestamp;

      logger.debug("[Bybit Kline] Request completed", {
        symbol,
        requestIndex: i + 1,
        dataReceived: klineResponse.list.length,
        totalDataSoFar: allKlineData.length,
        remainingMinutes,
        nextEndTime: endTime,
      });
    } else {
      // If no more data, exit loop
      logger.debug("[Bybit Kline] No more data available", {
        symbol,
        requestIndex: i + 1,
      });
      break;
    }

    // Add delay to avoid API limits
    if (i < numRequests - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (allKlineData.length === 0) {
    return [];
  }

  // Sort by timestamp (earliest to latest)
  allKlineData.sort((a, b) => Number(a.startTime) - Number(b.startTime));

  return convertBybitKlineToPriceData(allKlineData);
}
