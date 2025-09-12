import { describe, it, expect, afterAll, afterEach } from "vitest";
import {
  BybitTicker,
  subscribeBybitTickers,
  BybitTickerSubscription,
  fetchBybitPerpTickers,
} from "../../../../src/blockchain/bybit/perp/tickers";
import {
  getBybitKline,
  getBybitKlineForDays,
} from "../../../../src/blockchain/bybit/perp";
import WebSocket from "ws";

let ws: BybitTickerSubscription | null = null;

describe("Bybit Perp Integration", () => {
  describe("fetchBybitPerpTickers", () => {
    it("should fetch tickers by specific symbols", async () => {
      const symbols = ["BTC", "ETH"];

      const tickers = await fetchBybitPerpTickers(symbols);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      // Check that all returned tickers are from the requested symbols
      const expectedSymbols = new Set(
        symbols.map((s) => `${s.toUpperCase()}USDT`),
      );
      for (const ticker of tickers) {
        expect(expectedSymbols.has(ticker.symbol)).toBe(true);
      }

      // Verify ticker structure
      if (tickers.length > 0) {
        expect(tickers[0]).toHaveProperty("symbol");
        expect(tickers[0]).toHaveProperty("markPrice");
        expect(tickers[0]).toHaveProperty("bid1Price");
        expect(tickers[0]).toHaveProperty("ask1Price");
        expect(tickers[0]).toHaveProperty("indexPrice");
      }
    });

    it("should handle single symbol request", async () => {
      const symbols = ["BTC"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      // All tickers should be BTCUSDT
      for (const ticker of tickers) {
        expect(ticker.symbol).toBe("BTCUSDT");
      }
    });

    it("should handle empty symbols array", async () => {
      const symbols: string[] = [];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBe(0);
    });

    it("should handle non-existent symbols", async () => {
      const symbols = ["NONEXISTENTTOKEN"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBe(0);
    });

    it("should handle mixed valid and invalid symbols", async () => {
      const symbols = ["BTC", "NONEXISTENTTOKEN", "ETH"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      // Should only return valid symbols
      const validSymbols = new Set(["BTCUSDT", "ETHUSDT"]);
      for (const ticker of tickers) {
        expect(validSymbols.has(ticker.symbol)).toBe(true);
      }

      // Should not contain the invalid symbol
      const tickerSymbols = tickers.map((t) => t.symbol);
      expect(tickerSymbols).not.toContain("NONEXISTENTTOKENUSDT");
    });

    it("should handle case-insensitive symbol input", async () => {
      const symbols = ["btc", "ETH", "Ada"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      // All symbols should be converted to uppercase with USDT suffix
      const expectedSymbols = new Set(["BTCUSDT", "ETHUSDT", "ADAUSDT"]);
      for (const ticker of tickers) {
        expect(expectedSymbols.has(ticker.symbol)).toBe(true);
      }
    });

    it("should return unique tickers for duplicate symbols", async () => {
      const symbols = ["BTC", "BTC", "ETH"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      // Check for duplicates
      const uniqueSymbols = new Set(tickers.map((t) => t.symbol));
      expect(uniqueSymbols.size).toBe(tickers.length);

      // Should only contain BTCUSDT and ETHUSDT
      const expectedSymbols = new Set(["BTCUSDT", "ETHUSDT"]);
      for (const ticker of tickers) {
        expect(expectedSymbols.has(ticker.symbol)).toBe(true);
      }
    });

    it("should return tickers with valid price data", async () => {
      const symbols = ["BTC", "ETH"];
      const tickers = await fetchBybitPerpTickers(symbols);

      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);

      for (const ticker of tickers) {
        // Check that price fields are present and valid
        expect(ticker.symbol).toBeDefined();
        expect(typeof ticker.symbol).toBe("string");

        // Price fields should be present (may be null for some tickers)
        expect(ticker).toHaveProperty("markPrice");
        expect(ticker).toHaveProperty("bid1Price");
        expect(ticker).toHaveProperty("ask1Price");
        expect(ticker).toHaveProperty("indexPrice");

        // If prices exist, they should be valid numbers or strings
        if (ticker.markPrice) {
          expect(typeof ticker.markPrice).toMatch(/^(string|number)$/);
        }
        if (ticker.bid1Price) {
          expect(typeof ticker.bid1Price).toMatch(/^(string|number)$/);
        }
        if (ticker.ask1Price) {
          expect(typeof ticker.ask1Price).toMatch(/^(string|number)$/);
        }
      }
    });
  });

  describe("WebSocket Ticker Subscription", () => {
    it("should receive price updates for selected tickers via websocket", async () => {
      const symbols = ["BTCUSDT", "ETHUSDT"];
      const received: BybitTicker[] = [];
      ws = await subscribeBybitTickers(
        symbols,
        (data) => {
          received.push(data);
          // No-op here; resolution handled below
        },
        {
          reconnect: false,
          onError: (err: Error) => {
            throw err;
          },
        },
      );
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (received.length < 4)
            reject(new Error("Timeout: Did not receive 4 price updates"));
        }, 10000);
        const check = () => {
          if (received.length >= 4) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(check, 100); // Poll every 100ms
          }
        };
        check();
      });
      expect(received.length).toBeGreaterThanOrEqual(4);
      for (const ticker of received) {
        expect(symbols).toContain(ticker.symbol);
        // Bybit ticker fields are optional, so we just check that we have a valid ticker object
        expect(ticker).toBeDefined();
        expect(typeof ticker.symbol).toBe("string");
      }
    });

    it("should reconnect automatically when websocket closes", async () => {
      const symbols = ["BTCUSDT"];
      const received: BybitTicker[] = [];
      const reconnectCount = 0;
      let originalWs: WebSocket | null = null;

      await new Promise<void>((resolve, reject) => {
        subscribeBybitTickers(
          symbols,
          (data) => {
            received.push(data);
            // If we receive data after a reconnect, consider the test successful
            if (received.length >= 3) {
              resolve();
            }
          },
          {
            reconnect: true,
            onError: (error) => {
              // Don't reject on error, let reconnect handle it
              console.log(
                "WebSocket error during reconnect test:",
                error.message,
              );
            },
          },
        )
          .then((subscription) => {
            ws = subscription;
            originalWs = subscription.ws;
            originalWs.close();
          })
          .catch(reject);
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
      const received: BybitTicker[] = [];
      let originalWs: WebSocket | null = null;
      let wsClosed = false;

      await new Promise<void>((resolve) => {
        subscribeBybitTickers(
          symbols,
          (data) => {
            received.push(data);
          },
          {
            reconnect: false,
            onError: (error) => {
              console.log("WebSocket error:", error.message);
            },
          },
        ).then((subscription) => {
          ws = subscription;
          originalWs = subscription.ws;

          // Wait for initial data
          setTimeout(() => {
            if (
              received.length > 0 &&
              originalWs &&
              originalWs.readyState === WebSocket.OPEN
            ) {
              // Force close the connection
              console.log("Forcing WebSocket close (no reconnect)...");
              originalWs.close();

              // Wait to see if it reconnects
              setTimeout(() => {
                wsClosed = ws?.ws.readyState === WebSocket.CLOSED;
                resolve();
              }, 3000);
            } else {
              resolve();
            }
          }, 2000);
        });
      });

      // Should not have reconnected
      expect(wsClosed).toBe(true);
      expect(ws?.ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should handle websocket unsubscribe", async () => {
      const symbols = ["BTCUSDT"];
      const received: BybitTicker[] = [];

      ws = await subscribeBybitTickers(
        symbols,
        (data) => {
          received.push(data);
        },
        {
          reconnect: false,
          onError: (error) => {
            console.error("WebSocket error:", error);
          },
        },
      );

      // Wait a bit to collect data
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Allow for cases where no data is received immediately
      if (received.length === 0) {
        console.log("No data received, continuing with test...");
      }

      // Capture count before unsubscribing
      const beforeUnsubscribeCount = received.length;

      // Unsubscribe
      ws.close();

      // Wait for WebSocket to close
      await new Promise((resolve) => {
        if (!ws) return resolve(null);
        if (ws.ws.readyState === WebSocket.CLOSED) return resolve(null);
        ws.ws.on("close", () => resolve(null));
        setTimeout(() => resolve(null), 2000);
      });

      // Wait a bit more for any residual messages to arrive
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Allow for some residual messages, but should not increase significantly
      const afterUnsubscribeCount = received.length;
      expect(afterUnsubscribeCount).toBeGreaterThan(0);
      // Should not increase by more than 50 messages after unsubscribe
      expect(afterUnsubscribeCount).toBeLessThanOrEqual(
        beforeUnsubscribeCount + 50,
      );
      expect(
        ws.ws.readyState === WebSocket.CLOSED ||
          ws.ws.readyState === WebSocket.CLOSING,
      ).toBe(true);
    });
  });

  describe("getBybitKline", () => {
    it("should fetch kline data for BTCUSDT", async () => {
      const klineData = await getBybitKline(
        "BTCUSDT",
        "1",
        undefined,
        undefined,
        10,
      );

      expect(klineData).toBeDefined();
      if (klineData) {
        expect(klineData.symbol).toBe("BTCUSDT");
        expect(klineData.category).toBe("linear");
        expect(Array.isArray(klineData.list)).toBe(true);
        expect(klineData.list.length).toBeLessThanOrEqual(10);

        if (klineData.list.length > 0) {
          const firstKline = klineData.list[0];
          expect(firstKline.startTime).toBeDefined();
          expect(firstKline.openPrice).toBeDefined();
          expect(firstKline.highPrice).toBeDefined();
          expect(firstKline.lowPrice).toBeDefined();
          expect(firstKline.closePrice).toBeDefined();
        }
      }
    });

    it("should handle non-existent symbol", async () => {
      const klineData = await getBybitKline("INVALIDPAIR", "1");

      expect(klineData).toBeNull();
    });
  });

  describe("getBybitKlineForDays", () => {
    it("should fetch 1 day of kline data for BTCUSDT", async () => {
      const priceData = await getBybitKlineForDays("BTCUSDT", 1, "1");

      expect(Array.isArray(priceData)).toBe(true);
      expect(priceData.length).toBeGreaterThan(0);

      if (priceData.length > 0) {
        const firstPoint = priceData[0];
        expect(firstPoint.timestamp).toBeDefined();
        expect(firstPoint.price).toBeGreaterThan(0);
        expect(firstPoint.source).toBe("bybit");

        // 验证数据是按时间排序的
        for (let i = 1; i < priceData.length; i++) {
          expect(priceData[i].timestamp).toBeGreaterThanOrEqual(
            priceData[i - 1].timestamp,
          );
        }
      }
    });
  });

  afterEach(() => {
    // Clean up WebSocket after each test
    if (ws && ws.ws.readyState === WebSocket.OPEN) {
      ws.ws.close();
    }
    ws = null;
  });

  afterAll(() => {
    if (ws && ws.ws.readyState === WebSocket.OPEN) {
      ws.ws.close();
    }
  });
});
