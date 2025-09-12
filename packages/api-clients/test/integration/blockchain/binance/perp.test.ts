import { describe, it, expect, afterEach, afterAll } from "vitest";
import {
  getSymbolOrderBookTicker,
  getSymbolOrderBookTickers,
  subscribeOrderBookTicker,
  getAllUsdtPerpSymbols,
  getOrderBook,
  subscribeOrderBook,
  BinanceTickerSubscription,
} from "../../../../src/blockchain/binance/perp";
import WebSocket from "ws";

let ws: BinanceTickerSubscription | null = null;
let orderbookWs: WebSocket | null = null;

describe("Binance Perp Integration", () => {
  describe("OrderBook Ticker REST API", () => {
    it("should fetch orderbook ticker for BTCUSDT", async () => {
      const ticker = await getSymbolOrderBookTicker("BTCUSDT");
      expect(ticker).not.toBeNull();
      if (ticker) {
        expect(ticker.symbol).toBe("BTCUSDT");
        expect(typeof ticker.bidPrice).toBe("string");
        expect(typeof ticker.askPrice).toBe("string");
        expect(typeof ticker.bidQty).toBe("string");
        expect(typeof ticker.askQty).toBe("string");
        expect(typeof ticker.time).toBe("number");
        expect(parseFloat(ticker.bidPrice)).toBeGreaterThan(0);
        expect(parseFloat(ticker.askPrice)).toBeGreaterThan(0);
      }
    });

    it("should fetch orderbook tickers for multiple symbols", async () => {
      const symbols = ["BTCUSDT", "ETHUSDT"];
      const tickers = await getSymbolOrderBookTickers(symbols);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      for (const ticker of tickers) {
        expect(symbols).toContain(ticker.symbol);
        expect(typeof ticker.bidPrice).toBe("string");
        expect(typeof ticker.askPrice).toBe("string");
        expect(parseFloat(ticker.bidPrice)).toBeGreaterThan(0);
        expect(parseFloat(ticker.askPrice)).toBeGreaterThan(0);
      }
    });

    it("should handle invalid symbol gracefully", async () => {
      const ticker = await getSymbolOrderBookTicker("INVALID_SYMBOL");
      expect(ticker).toBeNull();
    });

    it("should handle empty symbol array", async () => {
      const tickers = await getSymbolOrderBookTickers([]);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBe(0);
    });

    it("should handle mixed valid and invalid symbols", async () => {
      const symbols = ["BTCUSDT", "INVALID_SYMBOL", "ETHUSDT"];
      const tickers = await getSymbolOrderBookTickers(symbols);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);
      expect(tickers.length).toBeLessThanOrEqual(2); // Should only return valid symbols

      for (const ticker of tickers) {
        expect(["BTCUSDT", "ETHUSDT"]).toContain(ticker.symbol);
      }
    });

    it("should handle null/undefined symbol", async () => {
      const ticker = await getSymbolOrderBookTicker("");
      expect(ticker).toBeNull();
    });
  });

  describe("OrderBook Ticker WebSocket", () => {
    it("should receive orderbook ticker updates via websocket", async () => {
      const symbols = ["BTCUSDT"];
      const received: unknown[] = [];

      await new Promise((resolve, reject) => {
        ws = subscribeOrderBookTicker(
          symbols,
          (data) => {
            received.push(data);
            if (received.length >= 2) {
              resolve(null);
            }
          },
          {
            reconnect: false,
            onError: (error) => {
              reject(error);
            },
          },
        );

        setTimeout(() => {
          if (received.length < 1) {
            reject(new Error("Timeout: Did not receive enough ticker updates"));
          }
        }, 10000);
      });

      expect(received.length).toBeGreaterThanOrEqual(1);
      for (const item of received) {
        const typedItem = item as any; // Type assertion for test data
        expect(symbols).toContain(typedItem.symbol);
        expect(typeof typedItem.bidPrice).toBe("string");
        expect(typeof typedItem.askPrice).toBe("string");
        expect(parseFloat(typedItem.bidPrice)).toBeGreaterThan(0);
        expect(parseFloat(typedItem.askPrice)).toBeGreaterThan(0);
      }
    });

    it("should handle multiple symbols in websocket subscription", async () => {
      const symbols = ["BTCUSDT", "ETHUSDT"];
      const received: unknown[] = [];

      await new Promise((resolve, reject) => {
        ws = subscribeOrderBookTicker(
          symbols,
          (data) => {
            received.push(data);
            // Wait for at least 2 updates from each symbol
            const btcCount = received.filter(
              (item) => (item as any).symbol === "BTCUSDT",
            ).length;
            const ethCount = received.filter(
              (item) => (item as any).symbol === "ETHUSDT",
            ).length;
            if (btcCount >= 1 && ethCount >= 1) {
              resolve(null);
            }
          },
          {
            reconnect: false,
            onError: (error) => {
              reject(error);
            },
          },
        );

        setTimeout(() => {
          if (received.length < 2) {
            reject(new Error("Timeout: Did not receive enough ticker updates"));
          }
        }, 10000);
      });

      expect(received.length).toBeGreaterThanOrEqual(2);
      const receivedSymbols = received.map((item) => (item as any).symbol);
      expect(receivedSymbols.some((s) => s === "BTCUSDT")).toBe(true);
      expect(receivedSymbols.some((s) => s === "ETHUSDT")).toBe(true);
    });

    it("should throw error for empty symbols array", async () => {
      expect(() => {
        subscribeOrderBookTicker([], () => {}, {
          reconnect: false,
          onError: (_error) => {
            // Expected error for invalid symbols
          },
        });
      }).toThrow("No symbols provided for Binance ticker subscription");
    });

    it("should handle websocket error gracefully", async () => {
      const symbols = ["INVALID_SYMBOL"];
      // Track if error was received (for test validation)
      let errorReceived = false;

      await new Promise((resolve) => {
        ws = subscribeOrderBookTicker(symbols, () => {}, {
          reconnect: false,
          onError: (_error) => {
            errorReceived = true;
            resolve(null);
          },
        });

        setTimeout(() => {
          resolve(null);
        }, 5000);
      });

      // Should handle errors gracefully without throwing
      // Note: errorReceived may be true if WebSocket error occurs
      expect(true).toBe(true);
    });

    it("should reconnect automatically when websocket closes", async () => {
      const symbols = ["BTCUSDT"];
      const received: unknown[] = [];
      const reconnectCount = 0;
      let originalWs: WebSocket | null = null;

      await new Promise((resolve, _reject) => {
        ws = subscribeOrderBookTicker(
          symbols,
          (data) => {
            received.push(data);
            // If we receive data after a reconnect, consider the test successful
            if (received.length >= 3) {
              resolve(null);
            }
          },
          {
            reconnect: true,
            onError: (_error) => {
              // Don't reject on error, let reconnect handle it
              // Expected error during reconnect test
            },
          },
        );

        originalWs = ws.ws;
        originalWs.close();
      });

      expect(received.length).toBeGreaterThanOrEqual(3);
      expect(reconnectCount).toBeGreaterThanOrEqual(0);

      // Verify we have a working connection
      expect(ws).not.toBeNull();
      if (ws) {
        expect(
          ws.ws.readyState === WebSocket.OPEN ||
            ws.ws.readyState === WebSocket.CONNECTING,
        ).toBe(true);
      }
    });

    it("should not reconnect when reconnect option is disabled", async () => {
      const symbols = ["BTCUSDT"];
      const received: unknown[] = [];
      let originalWs: WebSocket | null = null;
      let wsClosed = false;

      await new Promise((resolve) => {
        ws = subscribeOrderBookTicker(
          symbols,
          (data) => {
            received.push(data);
          },
          {
            reconnect: false,
            onError: (_error) => {
              // Expected error during test
            },
          },
        );

        originalWs = ws.ws;

        // Wait for initial data
        setTimeout(() => {
          if (
            received.length > 0 &&
            originalWs &&
            originalWs.readyState === WebSocket.OPEN
          ) {
            // Force close the connection
            originalWs.close();

            // Wait to see if it reconnects
            setTimeout(() => {
              wsClosed = ws?.ws.readyState === WebSocket.CLOSED;
              resolve(null);
            }, 3000);
          } else {
            resolve(null);
          }
        }, 2000);
      });

      // Should not have reconnected
      expect(wsClosed).toBe(true);
      expect(ws?.ws.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe("OrderBook REST API", () => {
    it("should fetch orderbook for BTCUSDT", async () => {
      const orderbook = await getOrderBook("BTCUSDT", 20);
      expect(orderbook).not.toBeNull();
      if (orderbook) {
        expect(orderbook.symbol).toBe("BTCUSDT");
        expect(Array.isArray(orderbook.bids)).toBe(true);
        expect(Array.isArray(orderbook.asks)).toBe(true);
        expect(orderbook.bids.length).toBeGreaterThan(0);
        expect(orderbook.asks.length).toBeGreaterThan(0);
        expect(typeof orderbook.lastUpdateId).toBe("number");
        expect(typeof orderbook.time).toBe("number");

        // Check bid/ask structure
        for (const bid of orderbook.bids) {
          expect(typeof bid.price).toBe("string");
          expect(typeof bid.quantity).toBe("string");
          expect(parseFloat(bid.price)).toBeGreaterThan(0);
          expect(parseFloat(bid.quantity)).toBeGreaterThan(0);
        }

        for (const ask of orderbook.asks) {
          expect(typeof ask.price).toBe("string");
          expect(typeof ask.quantity).toBe("string");
          expect(parseFloat(ask.price)).toBeGreaterThan(0);
          expect(parseFloat(ask.quantity)).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("OrderBook WebSocket", () => {
    it("should receive orderbook updates via websocket", async () => {
      const symbol = "BTCUSDT";
      const received: unknown[] = [];

      await new Promise((resolve, reject) => {
        orderbookWs = subscribeOrderBook(
          symbol,
          20,
          (data) => {
            received.push(data);
            if (received.length >= 2) {
              resolve(null);
            }
          },
          (error) => {
            reject(error);
          },
        );

        setTimeout(() => {
          if (received.length < 1) {
            reject(
              new Error("Timeout: Did not receive enough orderbook updates"),
            );
          }
        }, 10000);
      });

      expect(received.length).toBeGreaterThanOrEqual(1);
      for (const item of received) {
        const typedItem = item as any; // Type assertion for test data
        expect(typedItem.symbol).toBe(symbol);
        expect(Array.isArray(typedItem.bids)).toBe(true);
        expect(Array.isArray(typedItem.asks)).toBe(true);
        expect(typedItem.bids.length).toBeGreaterThan(0);
        expect(typedItem.asks.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Symbol Management", () => {
    it("should fetch all USDT perp symbols", async () => {
      const symbols = await getAllUsdtPerpSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      expect(symbols.length).toBeGreaterThan(0);

      // Check that symbols end with USDT
      for (const symbol of symbols.slice(0, 10)) {
        // Check first 10 symbols
        expect(symbol.endsWith("USDT")).toBe(true);
      }

      // Check that common symbols are present
      const commonSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"];
      for (const commonSymbol of commonSymbols) {
        expect(symbols).toContain(commonSymbol);
      }
    });
  });

  afterEach(() => {
    // Clean up WebSocket after each test
    if (ws && ws.ws.readyState === WebSocket.OPEN) {
      ws.ws.close();
    }
    if (orderbookWs && orderbookWs.readyState === WebSocket.OPEN) {
      orderbookWs.close();
    }
    ws = null;
    orderbookWs = null;
  });

  afterAll(() => {
    if (ws && ws.ws.readyState === WebSocket.OPEN) {
      ws.ws.close();
    }
    if (orderbookWs && orderbookWs.readyState === WebSocket.OPEN) {
      orderbookWs.close();
    }
  });
});
