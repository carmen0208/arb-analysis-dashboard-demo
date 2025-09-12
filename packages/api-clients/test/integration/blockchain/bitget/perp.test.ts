import { describe, it, expect, afterAll, afterEach } from "vitest";
import {
  fetchAllPerpTickers,
  subscribePerpPrices,
  BitgetTickerSubscription,
  getPerpTickersBySymbols,
} from "../../../../src/blockchain/bitget/perp/index";
import { FuturesTickerV2 } from "bitget-api";

let ws: BitgetTickerSubscription | null = null;

describe("Bitget Perp Integration", () => {
  it("should fetch all USDT perp tickers", async () => {
    const tickers = await fetchAllPerpTickers();
    expect(Array.isArray(tickers)).toBe(true);
    expect(tickers.length).toBeGreaterThan(0);
    expect(tickers[0]).toHaveProperty("symbol");
    expect(tickers[0]).toHaveProperty("askPr");
    expect(tickers[0]).toHaveProperty("bidPr");
    expect(tickers[0]).toHaveProperty("ts");
    expect(tickers[0]).toHaveProperty("indexPrice");
    expect(tickers[0]).toHaveProperty("fundingRate");
    expect(tickers[0]).toHaveProperty("askSz");
    expect(tickers[0]).toHaveProperty("bidSz");
  });

  it("should fetch tickers by specific symbols", async () => {
    const symbols = ["BTC", "ETH"];
    const tickers = await getPerpTickersBySymbols(symbols);
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
      expect(tickers[0]).toHaveProperty("askPr");
      expect(tickers[0]).toHaveProperty("bidPr");
      expect(tickers[0]).toHaveProperty("ts");
    }
  });

  it("should handle single symbol request", async () => {
    const symbols = ["BTC"];
    const tickers = await getPerpTickersBySymbols(symbols);

    expect(Array.isArray(tickers)).toBe(true);
    expect(tickers.length).toBeGreaterThan(0);

    // All tickers should be BTCUSDT
    for (const ticker of tickers) {
      expect(ticker.symbol).toBe("BTCUSDT");
    }
  });

  it("should handle empty symbols array", async () => {
    const symbols: string[] = [];
    const tickers = await getPerpTickersBySymbols(symbols);

    expect(Array.isArray(tickers)).toBe(true);
    expect(tickers.length).toBe(0);
  });

  it("should handle non-existent symbols", async () => {
    const symbols = ["NONEXISTENTTOKEN"];
    const tickers = await getPerpTickersBySymbols(symbols);

    expect(Array.isArray(tickers)).toBe(true);
    expect(tickers.length).toBe(0);
  });

  it("should handle mixed valid and invalid symbols", async () => {
    const symbols = ["BTC", "NONEXISTENTTOKEN", "ETH"];
    const tickers = await getPerpTickersBySymbols(symbols);

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
    const tickers = await getPerpTickersBySymbols(symbols);

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
    const tickers = await getPerpTickersBySymbols(symbols);

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

  it("should receive price updates for selected tickers via websocket", async () => {
    const tickers = await fetchAllPerpTickers();
    const symbols = tickers.slice(0, 2).map((t: FuturesTickerV2) => t.symbol);
    const received: any[] = [];
    await new Promise((resolve, reject) => {
      ws = subscribePerpPrices(symbols, (data) => {
        received.push(data);
        if (received.length >= 4) {
          resolve(null);
        }
      });
      setTimeout(() => {
        if (received.length < 2)
          reject(new Error("Timeout: Did not receive enough price updates"));
      }, 10000);
    });
    expect(received.length).toBeGreaterThanOrEqual(2);
    for (const item of received) {
      expect(symbols).toContain(item.symbol);
      expect(typeof item.bidPr).toBe("string");
      expect(typeof item.ts).toBe("string");
    }
  });

  it("should reconnect automatically when websocket closes", async () => {
    const symbols = ["BTCUSDT", "ETHUSDT"];
    const received: any[] = [];
    let originalWs: any;

    await new Promise<void>((resolve, reject) => {
      ws = subscribePerpPrices(
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
      );

      originalWs = ws.ws;
      ws.ws.closeAll();
      // Wait a bit for initial connection
      // setTimeout(() => {
      //   // Force close the WebSocket to trigger reconnect
      //   if (ws?.ws) {
      //     console.log("Forcing WebSocket close to test reconnect...");
      //     ws.ws.closeAll();
      //   }
      // }, 1000);
    });

    // Should have reconnected
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(ws && ws.ws !== originalWs).toBe(true);
  });

  it("should not reconnect when reconnect option is disabled", async () => {
    const symbols = ["BTCUSDT"];
    const received: any[] = [];
    let wsClosed = false;
    let originalWs: any;

    await new Promise<void>((resolve) => {
      ws = subscribePerpPrices(
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
      );

      originalWs = ws.ws;

      // Wait a bit for initial connection
      setTimeout(() => {
        // Force close the WebSocket
        if (ws?.ws) {
          console.log("Forcing WebSocket close (no reconnect)...");
          ws.ws.closeAll();
        }

        // Wait to see if it reconnects
        setTimeout(() => {
          // For Bitget, we can't directly check readyState, so we check if ws is still the same
          wsClosed = ws?.ws === originalWs;
          resolve();
        }, 3000);
      }, 1000);
    });

    // Should not have reconnected
    expect(wsClosed).toBe(true);
    // For Bitget, we can't directly check readyState, so we verify the ws is still the same
    expect(ws?.ws).toBe(originalWs);
  });

  it.skip("should handle websocket unsubscribe", async () => {
    const symbols = ["BTCUSDT"];
    const received: any[] = [];

    await new Promise<void>((resolve) => {
      ws = subscribePerpPrices(symbols, (data) => {
        received.push(data);
      });

      // Wait a bit to collect data
      setTimeout(() => {
        // Allow for cases where no data is received immediately
        if (received.length === 0) {
          console.log("No data received, continuing with test...");
        }

        // Capture count before unsubscribing
        const countBeforeUnsubscribe = received.length;

        // Unsubscribe
        ws?.close();

        // Wait a bit more
        setTimeout(() => {
          const countAfterUnsubscribe = received.length;
          // Should not receive more data after unsubscribe
          expect(countAfterUnsubscribe).toBe(countBeforeUnsubscribe);
          resolve();
        }, 1000);
      }, 2000);
    });
  });

  afterEach(() => {
    // Clean up WebSocket after each test
    if (ws && typeof ws.close === "function") {
      ws.close();
    }
    ws = null;
  });

  afterAll(() => {
    if (ws && typeof ws.close === "function") {
      ws.close();
    }
  });
});
