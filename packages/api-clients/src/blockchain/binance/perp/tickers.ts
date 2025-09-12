import { USDMClient } from "binance";
import { getLogger, Logger } from "@dex-ai/core";
import WebSocket, { MessageEvent, CloseEvent, ErrorEvent } from "ws";
import { BINANCE_USDM_WS_URL } from "./constants";

const logger: Logger = getLogger("blockchain-binance");

// Types
export interface BinanceOrderBookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  time: number;
}

export interface BinanceTickerCallback {
  (data: BinanceOrderBookTicker): void;
}

export interface SubscribeBinanceTickersOptions {
  reconnect?: boolean; // Whether to auto-reconnect
  onError?: (err: Error) => void;
}

export interface BinanceTickerSubscription {
  ws: WebSocket;
  close: () => void;
}

/**
 * Create Binance USDM client instance
 */
function createBinanceClient(): USDMClient {
  logger.debug("[Binance Perp] Creating USDM client instance");
  return new USDMClient();
}

/**
 * Get orderbook ticker for single symbol (REST API)
 */
export async function getSymbolOrderBookTicker(
  symbol: string,
): Promise<BinanceOrderBookTicker | null> {
  logger.info("[Binance Perp] Fetching orderbook ticker", { symbol });

  try {
    if (!symbol) {
      logger.error("[Binance Perp] Missing required parameter: symbol");
      return null;
    }

    const client = createBinanceClient();
    const response = await client.getSymbolOrderBookTicker({ symbol });
    if (!response) {
      logger.warn("[Binance Perp] No response received", { symbol });
      return null;
    }

    const ticker: BinanceOrderBookTicker = {
      symbol: response.symbol,
      bidPrice: String(response.bidPrice),
      bidQty: String(response.bidQty),
      askPrice: String(response.askPrice),
      askQty: String(response.askQty),
      time: response.time,
    };

    logger.info("[Binance Perp] Successfully fetched orderbook ticker", {
      symbol,
      bidPrice: ticker.bidPrice,
      askPrice: ticker.askPrice,
    });

    return ticker;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch orderbook ticker", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get orderbook tickers for multiple symbols (REST API)
 */
export async function getSymbolOrderBookTickers(
  symbols: string[],
): Promise<BinanceOrderBookTicker[]> {
  logger.info("[Binance Perp] Fetching orderbook tickers", {
    symbolCount: symbols.length,
  });

  try {
    if (!symbols.length) {
      logger.warn("[Binance Perp] No symbols provided");
      return [];
    }

    const client = createBinanceClient();
    const response = await client.getSymbolOrderBookTicker();

    if (!response || !Array.isArray(response)) {
      logger.warn("[Binance Perp] No response received or invalid format");
      return [];
    }

    // Filter by requested symbols
    const filteredTickers = response.filter((ticker) =>
      symbols.includes(ticker.symbol),
    );

    const result: BinanceOrderBookTicker[] = filteredTickers.map((ticker) => ({
      symbol: ticker.symbol,
      bidPrice: String(ticker.bidPrice),
      bidQty: String(ticker.bidQty),
      askPrice: String(ticker.askPrice),
      askQty: String(ticker.askQty),
      time: ticker.time,
    }));

    logger.info("[Binance Perp] Successfully fetched orderbook tickers", {
      requestedCount: symbols.length,
      receivedCount: result.length,
    });

    return result;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch orderbook tickers", {
      symbolCount: symbols.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Subscribe to symbol orderbook ticker WebSocket stream
 * Note: Due to WebSocket API limitations in binance package, using native WebSocket implementation here
 */
export function subscribeOrderBookTicker(
  symbols: string[],
  onTicker: BinanceTickerCallback,
  options?: SubscribeBinanceTickersOptions,
): BinanceTickerSubscription {
  if (!symbols.length) {
    throw new Error("No symbols provided for Binance ticker subscription");
  }

  let reconnecting = false;

  const wrapper: BinanceTickerSubscription = {
    ws: undefined as unknown as WebSocket, // will be set after connect
    close: () => {
      if (wrapper.ws && wrapper.ws.readyState === WebSocket.OPEN) {
        wrapper.ws.close();
      }
    },
  };

  const connect = (): WebSocket => {
    logger.info("[Binance Perp] Subscribing to orderbook ticker stream", {
      symbolCount: symbols.length,
    });

    // Create WebSocket connection
    const ws = new WebSocket(BINANCE_USDM_WS_URL);

    ws.onopen = () => {
      logger.info(
        "[Binance Perp] WebSocket connection opened, subscribing to tickers",
        {
          symbols,
        },
      );

      // Subscribe to orderbook ticker streams
      const subscribeMessage = {
        method: "SUBSCRIBE",
        params: symbols.map((symbol) => `${symbol.toLowerCase()}@bookTicker`),
        id: Date.now(),
      };

      ws.send(JSON.stringify(subscribeMessage));
      logger.info("[Binance Perp] Subscription message sent", {
        symbols: symbols.map((s) => s.toLowerCase()),
      });
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        // Handle subscription confirmation
        if (data.result === null && data.id) {
          logger.info("[Binance Perp] Subscription confirmed", { id: data.id });
          return;
        }

        // Handle orderbook ticker data
        if (data.s && data.b && data.a) {
          const ticker: BinanceOrderBookTicker = {
            symbol: data.s,
            bidPrice: data.b,
            bidQty: data.B,
            askPrice: data.a,
            askQty: data.A,
            time: data.E,
          };

          logger.debug("[Binance Perp] Received orderbook ticker", {
            symbol: ticker.symbol,
            bidPrice: ticker.bidPrice,
            askPrice: ticker.askPrice,
          });

          onTicker(ticker);
        }
      } catch (error) {
        logger.error("[Binance Perp] Failed to parse WebSocket message", {
          error: error instanceof Error ? error.message : String(error),
          data: event.data,
        });
        const err = error instanceof Error ? error : new Error(String(error));
        options?.onError?.(err);
      }
    };

    ws.onerror = (error: ErrorEvent) => {
      logger.error("[Binance Perp] WebSocket error", {
        error,
      });
      const err = error instanceof Error ? error : new Error(String(error));
      options?.onError?.(err);
    };

    ws.onclose = (event: CloseEvent) => {
      logger.warn("[Binance Perp] WebSocket connection closed", {
        code: event.code,
        reason: event.reason,
      });
      if (options?.reconnect && !reconnecting) {
        reconnecting = true;
        setTimeout(() => {
          reconnecting = false;
          const newWs = connect();
          wrapper.ws = newWs;
        }, 2000);
      }
    };

    wrapper.ws = ws;
    return ws;
  };

  connect();
  return wrapper;
}

/**
 * Unsubscribe from WebSocket stream
 */
export function unsubscribeOrderBookTicker(
  ws: WebSocket,
  symbols: string[],
): void {
  logger.info("[Binance Perp] Unsubscribing from orderbook ticker stream", {
    symbolCount: symbols.length,
  });

  if (ws.readyState === WebSocket.OPEN) {
    const unsubscribeMessage = {
      method: "UNSUBSCRIBE",
      params: symbols.map((symbol) => `${symbol.toLowerCase()}@bookTicker`),
      id: Date.now(),
    };

    ws.send(JSON.stringify(unsubscribeMessage));
    logger.info("[Binance Perp] Unsubscribe message sent");
  }

  ws.close();
}

/**
 * Get all available USDT perpetual contract symbols
 */
export async function getAllUsdtPerpSymbols(): Promise<string[]> {
  logger.info("[Binance Perp] Fetching all USDT perp symbols");

  try {
    const client = createBinanceClient();
    const exchangeInfo = await client.getExchangeInfo();
    if (!exchangeInfo || !exchangeInfo.symbols) {
      logger.warn("[Binance Perp] No exchange info received");
      return [];
    }

    // Filter for USDT perpetual futures
    const usdtPerpSymbols = exchangeInfo.symbols
      .filter(
        (symbol) =>
          symbol.symbol.endsWith("USDT") &&
          symbol.contractType === "PERPETUAL" &&
          symbol.status === "TRADING",
      )
      .map((symbol) => symbol.symbol);

    logger.info("[Binance Perp] Successfully fetched USDT perp symbols", {
      count: usdtPerpSymbols.length,
    });

    return usdtPerpSymbols;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch USDT perp symbols", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get historical price data for Binance perpetual contracts
 */
export async function getMarkPriceKlines(
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
    | "1M" = "1h",
  limit: number = 1000,
): Promise<Array<{
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}> | null> {
  logger.info("[Binance Perp] Fetching mark price klines", {
    symbol,
    interval,
    limit,
  });

  try {
    if (!symbol) {
      logger.error("[Binance Perp] Missing required parameter: symbol");
      return null;
    }

    const client = createBinanceClient();

    // Use Binance K-line API to get historical data
    const response = await client.getKlines({
      symbol,
      interval,
      limit,
    });

    if (!response || !Array.isArray(response)) {
      logger.warn("[Binance Perp] No klines response received", { symbol });
      return null;
    }

    // Convert K-line data format
    const klines = response.map((kline) => ({
      timestamp: kline[0], // Opening time
      open: Number(kline[1]), // Opening price
      high: Number(kline[2]), // Highest price
      low: Number(kline[3]), // Lowest price
      close: Number(kline[4]), // Closing price
      volume: Number(kline[5]), // Trading volume
      source: "binance",
    }));

    logger.info("[Binance Perp] Successfully fetched mark price klines", {
      symbol,
      interval,
      limit,
      klineCount: klines.length,
    });

    return klines;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch mark price klines", {
      symbol,
      interval,
      limit,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get simplified historical price data for Binance perpetual contracts (only returns closing price and timestamp)
 */
export async function getMarkPriceHistory(
  symbol: string,
  days: number = 7,
): Promise<Array<{
  timestamp: number;
  price: number;
  source: string;
}> | null> {
  logger.info("[Binance Perp] Fetching mark price history", {
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

    const klines = await getMarkPriceKlines(symbol, interval, limit);

    if (!klines) {
      return null;
    }

    // Convert to simplified price data format
    const priceHistory = klines.map((kline) => ({
      timestamp: kline.timestamp,
      price: kline.close, // Use closing price as the price for this time period
      source: kline.source,
    }));

    logger.info("[Binance Perp] Successfully fetched mark price history", {
      symbol,
      days,
      interval,
      priceCount: priceHistory.length,
    });

    return priceHistory;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch mark price history", {
      symbol,
      days,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Get current price and historical data for Binance perpetual contracts (single API call)
 * Reference Bybit implementation to avoid duplicate API calls
 */
export async function getMarkPriceWithHistory(
  symbol: string,
  days: number = 7,
): Promise<{
  currentPrice: number | null;
  history: Array<{
    timestamp: number;
    price: number;
    source: string;
  }>;
} | null> {
  logger.info("[Binance Perp] Fetching mark price with history", {
    symbol,
    days,
  });

  try {
    if (!symbol) {
      logger.error("[Binance Perp] Missing required parameter: symbol");
      return null;
    }

    // Get historical data, the latest K-line data contains current price information
    const history = await getMarkPriceHistory(symbol, days);

    if (!history || history.length === 0) {
      return null;
    }

    // Use the latest price as current price
    const currentPrice = history[history.length - 1]?.price || null;

    logger.info("[Binance Perp] Successfully fetched mark price with history", {
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
    logger.error("[Binance Perp] Failed to fetch mark price with history", {
      symbol,
      days,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
