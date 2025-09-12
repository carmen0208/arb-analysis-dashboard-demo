import { USDMClient } from "binance";
import { getLogger, Logger } from "@dex-ai/core";
import WebSocket from "ws";
import { BINANCE_USDM_WS_URL } from "./constants";
import { BinanceErrorCallback } from "./types";

const logger: Logger = getLogger("binance-perp-orderbook");

// Types
export interface BinanceOrderBookEntry {
  price: string;
  quantity: string;
}

export interface BinanceOrderBook {
  symbol: string;
  bids: BinanceOrderBookEntry[];
  asks: BinanceOrderBookEntry[];
  lastUpdateId: number;
  time: number;
}

export interface BinanceOrderBookCallback {
  (data: BinanceOrderBook): void;
}

/**
 * Create Binance USDM client instance
 */
function createBinanceClient(): USDMClient {
  logger.debug("[Binance Perp] Creating USDM client instance");
  return new USDMClient();
}

/**
 * Get orderbook (REST API)
 */
export async function getOrderBook(
  symbol: string,
  limit: 5 | 10 | 20 | 50 | 100 | 500 | 1000 | 5000 = 100,
): Promise<BinanceOrderBook | null> {
  logger.info("[Binance Perp] Fetching orderbook", { symbol, limit });

  try {
    if (!symbol) {
      logger.error("[Binance Perp] Missing required parameter: symbol");
      return null;
    }

    const client = createBinanceClient();
    const response = await client.getOrderBook({ symbol, limit });

    if (!response) {
      logger.warn("[Binance Perp] No response received", { symbol });
      return null;
    }

    const orderbook: BinanceOrderBook = {
      symbol,
      bids: response.bids.map((bid) => ({
        price: String(bid[0]),
        quantity: String(bid[1]),
      })),
      asks: response.asks.map((ask) => ({
        price: String(ask[0]),
        quantity: String(ask[1]),
      })),
      lastUpdateId: response.lastUpdateId,
      time: Date.now(),
    };

    logger.info("[Binance Perp] Successfully fetched orderbook", {
      symbol,
      bidCount: orderbook.bids.length,
      askCount: orderbook.asks.length,
      lastUpdateId: orderbook.lastUpdateId,
    });

    return orderbook;
  } catch (error) {
    logger.error("[Binance Perp] Failed to fetch orderbook", {
      symbol,
      limit,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Subscribe to orderbook WebSocket stream
 */
export function subscribeOrderBook(
  symbol: string,
  levels: number = 20,
  onOrderBook: BinanceOrderBookCallback,
  onError?: BinanceErrorCallback,
): WebSocket {
  logger.info("[Binance Perp] Subscribing to orderbook stream", {
    symbol,
    levels,
  });

  if (!symbol) {
    logger.warn("[Binance Perp] No symbol provided for subscription");
    throw new Error("No symbol provided for subscription");
  }

  // Create WebSocket connection
  const ws = new WebSocket(BINANCE_USDM_WS_URL);

  ws.onopen = () => {
    logger.info("[Binance Perp] WebSocket connection opened");

    // Subscribe to orderbook stream
    const subscribeMessage = {
      method: "SUBSCRIBE",
      params: [`${symbol.toLowerCase()}@depth${levels}@100ms`],
      id: Date.now(),
    };

    ws.send(JSON.stringify(subscribeMessage));
    logger.info("[Binance Perp] Subscription message sent", {
      symbol: symbol.toLowerCase(),
      levels,
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);

      // Handle subscription confirmation
      if (data.result === null && data.id) {
        logger.info("[Binance Perp] Subscription confirmed", { id: data.id });
        return;
      }

      // Handle orderbook data
      if (data.s && data.b && data.a) {
        const orderbook: BinanceOrderBook = {
          symbol: data.s,
          bids: data.b.map((bid: [string, string]) => ({
            price: bid[0],
            quantity: bid[1],
          })),
          asks: data.a.map((ask: [string, string]) => ({
            price: ask[0],
            quantity: ask[1],
          })),
          lastUpdateId: data.u,
          time: data.E,
        };

        logger.debug("[Binance Perp] Received orderbook update", {
          symbol: orderbook.symbol,
          bidCount: orderbook.bids.length,
          askCount: orderbook.asks.length,
          lastUpdateId: orderbook.lastUpdateId,
        });

        onOrderBook(orderbook);
      }
    } catch (error) {
      logger.error("[Binance Perp] Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        data: event.data,
      });
      onError?.(error);
    }
  };

  ws.onerror = (error) => {
    logger.error("[Binance Perp] WebSocket error", {
      error: error instanceof Error ? error.message : String(error),
    });
    onError?.(error);
  };

  ws.onclose = (event) => {
    logger.info("[Binance Perp] WebSocket connection closed", {
      code: event.code,
      reason: event.reason,
    });
  };

  return ws;
}

/**
 * Unsubscribe from orderbook WebSocket stream
 */
export function unsubscribeOrderBook(
  ws: WebSocket,
  symbol: string,
  levels: number = 20,
): void {
  logger.info("[Binance Perp] Unsubscribing from orderbook stream", {
    symbol,
    levels,
  });

  if (ws.readyState === WebSocket.OPEN) {
    const unsubscribeMessage = {
      method: "UNSUBSCRIBE",
      params: [`${symbol.toLowerCase()}@depth${levels}@100ms`],
      id: Date.now(),
    };

    ws.send(JSON.stringify(unsubscribeMessage));
    logger.info("[Binance Perp] Unsubscribe message sent");
  }

  ws.close();
}

/**
 * Subscribe to multiple symbols' orderbook WebSocket streams
 */
export function subscribeMultipleOrderBooks(
  symbols: string[],
  levels: number = 20,
  onOrderBook: BinanceOrderBookCallback,
  onError?: BinanceErrorCallback,
): WebSocket {
  logger.info("[Binance Perp] Subscribing to multiple orderbook streams", {
    symbolCount: symbols.length,
    levels,
  });

  if (!symbols.length) {
    logger.warn("[Binance Perp] No symbols provided for subscription");
    throw new Error("No symbols provided for subscription");
  }

  // Create WebSocket connection
  const ws = new WebSocket(BINANCE_USDM_WS_URL);

  ws.onopen = () => {
    logger.info("[Binance Perp] WebSocket connection opened");

    // Subscribe to multiple orderbook streams
    const subscribeMessage = {
      method: "SUBSCRIBE",
      params: symbols.map(
        (symbol) => `${symbol.toLowerCase()}@depth${levels}@100ms`,
      ),
      id: Date.now(),
    };

    ws.send(JSON.stringify(subscribeMessage));
    logger.info("[Binance Perp] Subscription message sent", {
      symbols: symbols.map((s) => s.toLowerCase()),
      levels,
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);

      // Handle subscription confirmation
      if (data.result === null && data.id) {
        logger.info("[Binance Perp] Subscription confirmed", { id: data.id });
        return;
      }

      // Handle orderbook data
      if (data.s && data.b && data.a) {
        const orderbook: BinanceOrderBook = {
          symbol: data.s,
          bids: data.b.map((bid: [string, string]) => ({
            price: bid[0],
            quantity: bid[1],
          })),
          asks: data.a.map((ask: [string, string]) => ({
            price: ask[0],
            quantity: ask[1],
          })),
          lastUpdateId: data.u,
          time: data.E,
        };

        logger.debug("[Binance Perp] Received orderbook update", {
          symbol: orderbook.symbol,
          bidCount: orderbook.bids.length,
          askCount: orderbook.asks.length,
          lastUpdateId: orderbook.lastUpdateId,
        });

        onOrderBook(orderbook);
      }
    } catch (error) {
      logger.error("[Binance Perp] Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        data: event.data,
      });
      onError?.(error);
    }
  };

  ws.onerror = (error) => {
    logger.error("[Binance Perp] WebSocket error", {
      error: error instanceof Error ? error.message : String(error),
    });
    onError?.(error);
  };

  ws.onclose = (event) => {
    logger.info("[Binance Perp] WebSocket connection closed", {
      code: event.code,
      reason: event.reason,
    });
  };

  return ws;
}

/**
 * Unsubscribe from multiple symbols' orderbook WebSocket streams
 */
export function unsubscribeMultipleOrderBooks(
  ws: WebSocket,
  symbols: string[],
  levels: number = 20,
): void {
  logger.info("[Binance Perp] Unsubscribing from multiple orderbook streams", {
    symbolCount: symbols.length,
    levels,
  });

  if (ws.readyState === WebSocket.OPEN) {
    const unsubscribeMessage = {
      method: "UNSUBSCRIBE",
      params: symbols.map(
        (symbol) => `${symbol.toLowerCase()}@depth${levels}@100ms`,
      ),
      id: Date.now(),
    };

    ws.send(JSON.stringify(unsubscribeMessage));
    logger.info("[Binance Perp] Unsubscribe message sent");
  }

  ws.close();
}
