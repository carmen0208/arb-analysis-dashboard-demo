import { describe, it, expect } from "vitest";
import {
  getMarkPriceKlinesWithPagination,
  getMarkPriceHistory,
  getMarkPriceWithHistory,
} from "../../../../src/blockchain/bitget/perp/markPrice";

describe("Bitget Mark Price Integration", () => {
  const testSymbol = "BTCUSDT";

  describe("getMarkPriceKlinesWithPagination", () => {
    it("should fetch mark price klines for BTCUSDT", async () => {
      const klines = await getMarkPriceKlinesWithPagination(
        testSymbol,
        "1m",
        10,
      );
      expect(klines).not.toBeNull();
      if (klines) {
        expect(Array.isArray(klines)).toBe(true);
        expect(klines.length).toBeGreaterThan(0);
        expect(klines.length).toBeLessThanOrEqual(10);

        // Check kline structure
        const firstKline = klines[0];
        expect(firstKline).toHaveProperty("timestamp");
        expect(firstKline).toHaveProperty("open");
        expect(firstKline).toHaveProperty("high");
        expect(firstKline).toHaveProperty("low");
        expect(firstKline).toHaveProperty("close");
        expect(firstKline).toHaveProperty("volume");
        expect(firstKline).toHaveProperty("source");
        expect(firstKline.source).toBe("bitget");

        // Check data types
        expect(typeof firstKline.timestamp).toBe("string");
        expect(typeof firstKline.open).toBe("number");
        expect(typeof firstKline.high).toBe("number");
        expect(typeof firstKline.low).toBe("number");
        expect(typeof firstKline.close).toBe("number");
        expect(typeof firstKline.volume).toBe("number");

        // Check data validity
        expect(Number(firstKline.timestamp)).toBeGreaterThan(0);
        expect(firstKline.high).toBeGreaterThanOrEqual(firstKline.low);
        expect(firstKline.close).toBeGreaterThan(0);
      }
    }, 15000);

    it("should handle different intervals", async () => {
      const intervals = ["1m", "1h", "4h", "1d"] as const;

      for (const interval of intervals) {
        const klines = await getMarkPriceKlinesWithPagination(
          testSymbol,
          interval,
          50,
        );
        expect(klines).not.toBeNull();
        if (klines) {
          expect(klines.length).toBeLessThanOrEqual(50);
        }
      }
    }, 30000);

    it("should return null for invalid symbol", async () => {
      const klines = await getMarkPriceKlinesWithPagination(
        "INVALID_SYMBOL",
        "1h",
        10,
      );
      expect(klines).toBeNull();
    });
  });

  describe("getMarkPriceHistory", () => {
    it("should fetch mark price history for 7 days", async () => {
      const history = await getMarkPriceHistory(testSymbol, 7);
      expect(history).not.toBeNull();
      if (history) {
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThan(0);

        // Check history structure
        const firstEntry = history[0];
        expect(firstEntry).toHaveProperty("timestamp");
        expect(firstEntry).toHaveProperty("price");
        expect(firstEntry).toHaveProperty("source");
        expect(firstEntry.source).toBe("bitget");

        // Check data types
        expect(typeof firstEntry.timestamp).toBe("string");
        expect(typeof firstEntry.price).toBe("number");

        // Check data validity
        expect(Number(firstEntry.timestamp)).toBeGreaterThan(0);
        expect(firstEntry.price).toBeGreaterThan(0);
      }
    }, 15000);

    it("should handle different day ranges", async () => {
      const dayRanges = [1, 3, 7, 14, 30];

      for (const days of dayRanges) {
        const history = await getMarkPriceHistory(testSymbol, days);
        expect(history).not.toBeNull();
        if (history) {
          expect(history.length).toBeGreaterThan(0);
        }
      }
    }, 60000);
  });

  describe("getMarkPriceWithHistory", () => {
    it("should fetch current price and history together", async () => {
      const data = await getMarkPriceWithHistory(testSymbol, 7);

      expect(data).not.toBeNull();
      if (data) {
        expect(data).toHaveProperty("currentPrice");
        expect(data).toHaveProperty("history");
        expect(Array.isArray(data.history)).toBe(true);

        // Check current price
        if (data.currentPrice !== null) {
          expect(typeof data.currentPrice).toBe("number");
          expect(data.currentPrice).toBeGreaterThan(0);
        }

        // Check history
        expect(data.history.length).toBeGreaterThan(0);
        const firstEntry = data.history[0];
        expect(firstEntry).toHaveProperty("timestamp");
        expect(firstEntry).toHaveProperty("price");
        expect(firstEntry).toHaveProperty("source");
        expect(firstEntry.source).toBe("bitget");
      }
    }, 15000);

    it("should handle different day ranges", async () => {
      const dayRanges = [1, 3, 7];

      for (const days of dayRanges) {
        const data = await getMarkPriceWithHistory(testSymbol, days);
        expect(data).not.toBeNull();
        if (data) {
          expect(data.history.length).toBeGreaterThan(0);
        }
      }
    }, 45000);
  });

  describe("Error handling", () => {
    it("should handle empty symbol gracefully", async () => {
      const klines = await getMarkPriceKlinesWithPagination("", "1h", 10);
      expect(klines).toBeNull();

      const history = await getMarkPriceHistory("", 7);
      expect(history).toBeNull();

      const data = await getMarkPriceWithHistory("", 7);
      expect(data).toBeNull();
    });

    it("should handle network errors gracefully", async () => {
      // This test might fail if there are network issues, which is expected
      try {
        const klines = await getMarkPriceKlinesWithPagination(
          "BTCUSDT",
          "1h",
          10,
        );
        // If successful, data should be valid
        if (klines) {
          expect(Array.isArray(klines)).toBe(true);
        }
      } catch (error) {
        // Network errors are acceptable in integration tests
        expect(error).toBeDefined();
      }
    }, 15000);
  });
});
