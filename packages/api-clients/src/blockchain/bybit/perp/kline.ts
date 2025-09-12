import { OHLCKlineV5, RestClientV5 } from "bybit-api";
import { getLogger, Logger } from "@dex-ai/core";

const logger: Logger = getLogger("bybit-perp-kline");

// 使用Bybit API的原生类型
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
 * 获取 Bybit K线数据
 * @param symbol 交易对符号，例如 "BTCUSDT"
 * @param interval K线间隔，例如 "1", "5", "15", "30", "60", "120", "240", "360", "720", "D", "M", "W"
 * @param start 开始时间戳（毫秒）
 * @param end 结束时间戳（毫秒）
 * @param limit 限制数量，最大1000，默认200
 * @returns K线数据
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

    // const response = await client.getKline({
    //   category: "linear",
    //   symbol,
    //   interval,
    //   start,
    //   end,
    //   limit,
    // });

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

    // 转换API响应到我们的类型
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
 * 获取 Bybit Mark Price K线数据
 * @param symbol 交易对符号，例如 "BTCUSDT"
 * @param interval K线间隔
 * @param start 开始时间戳（毫秒）
 * @param end 结束时间戳（毫秒）
 * @param limit 限制数量
 * @returns Mark Price K线数据
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

    // 转换API响应到我们的类型
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
 * 将 Bybit K线数据转换为价格数据点
 * @param klineData Bybit K线数据
 * @returns 价格数据点数组
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
 * 获取指定天数的 Bybit K线数据（支持分页）
 * @param symbol 交易对符号
 * @param days 天数
 * @param interval K线间隔，默认1分钟
 * @returns 价格数据点数组
 */
export async function getBybitKlineForDays(
  symbol: string,
  days: number,
  interval: BybitKlineInterval = "1",
): Promise<Array<{ timestamp: number; price: number; source: string }>> {
  const maxLimitPerRequest = 1000; // Bybit API 单次最大限制
  const minutesPerDay = 1440; // 1天 = 1440分钟
  const totalMinutes = days * minutesPerDay;

  // 计算需要多少次请求
  const numRequests = Math.ceil(totalMinutes / maxLimitPerRequest);

  logger.info("[Bybit Kline] Pagination calculation", {
    symbol,
    days,
    totalMinutes,
    maxLimitPerRequest,
    numRequests,
  });

  const allKlineData: BybitKlineData[] = [];
  let endTime: number | undefined; // 用于分页的时间戳
  let remainingMinutes = totalMinutes; // 跟踪剩余需要获取的分钟数

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

      // 更新剩余分钟数（基于实际获取的数据点数量）
      remainingMinutes -= klineResponse.list.length;

      // 为下一次请求设置endTime参数（使用最早的时间戳）
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
      // 如果没有更多数据，退出循环
      logger.debug("[Bybit Kline] No more data available", {
        symbol,
        requestIndex: i + 1,
      });
      break;
    }

    // 添加延迟避免API限制
    if (i < numRequests - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (allKlineData.length === 0) {
    return [];
  }

  // 按时间戳排序（从早到晚）
  allKlineData.sort((a, b) => Number(a.startTime) - Number(b.startTime));

  return convertBybitKlineToPriceData(allKlineData);
}
