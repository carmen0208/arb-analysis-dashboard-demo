import { describe, it, expect } from "vitest";
import {
  getMarkPriceKlines,
  getMarkPriceHistory,
  getMarkPriceWithHistory,
} from "../../../../src/blockchain/binance/perp";

describe("Binance Mark Price With History Integration", () => {
  const testSymbol = "BTCUSDT"; // Use BTCUSDT as test symbol

  describe("getMarkPriceWithHistory", () => {
    it("should fetch current price and history data for BTCUSDT in one API call", async () => {
      const result = await getMarkPriceWithHistory(testSymbol, 7);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toHaveProperty("currentPrice");
        expect(result).toHaveProperty("history");
        expect(Array.isArray(result.history)).toBe(true);

        // Verify current price
        if (result.currentPrice !== null) {
          expect(typeof result.currentPrice).toBe("number");
          expect(result.currentPrice).toBeGreaterThan(0);
        }

        // Verify historical data
        expect(result.history.length).toBeGreaterThan(0);
        expect(result.history.length).toBeLessThanOrEqual(168); // 7 days * 24 hours

        // Verify historical data structure
        const firstHistory = result.history[0];
        expect(firstHistory).toHaveProperty("timestamp");
        expect(firstHistory).toHaveProperty("price");
        expect(firstHistory).toHaveProperty("source");
        expect(firstHistory.source).toBe("binance");
        expect(typeof firstHistory.timestamp).toBe("number");
        expect(typeof firstHistory.price).toBe("number");
        expect(firstHistory.price).toBeGreaterThan(0);

        // Verify timestamps are ascending
        for (let i = 1; i < result.history.length; i++) {
          expect(result.history[i].timestamp).toBeGreaterThan(
            result.history[i - 1].timestamp,
          );
        }

        // Verify the latest price should be the current price (if both exist)
        if (result.currentPrice !== null && result.history.length > 0) {
          const latestHistoryPrice =
            result.history[result.history.length - 1].price;
          expect(latestHistoryPrice).toBeCloseTo(result.currentPrice, 2);
        }
      }
    });

    it("should handle different time periods correctly", async () => {
      const periods = [1, 7, 30];

      for (const days of periods) {
        const result = await getMarkPriceWithHistory(testSymbol, days);

        expect(result).not.toBeNull();
        if (result) {
          expect(result.history.length).toBeGreaterThan(0);

          // Verify data volume meets expectations
          if (days <= 1) {
            expect(result.history.length).toBeLessThanOrEqual(1440); // 24-hour interval
          } else if (days <= 7) {
            expect(result.history.length).toBeLessThanOrEqual(days * 24); // 1-hour interval
          } else if (days <= 30) {
            expect(result.history.length).toBeLessThanOrEqual(days * 6); // 4-hour interval
          } else {
            expect(result.history.length).toBeLessThanOrEqual(days); // 1-day interval
          }
        }
      }
    });

    it("should handle invalid symbol gracefully", async () => {
      const result = await getMarkPriceWithHistory("INVALID_SYMBOL", 7);
      expect(result).toBeNull();
    });

    it("should handle edge case with 0 days", async () => {
      const result = await getMarkPriceWithHistory(testSymbol, 0);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.history.length).toBeLessThanOrEqual(1440); // Default 1 day
      }
    });
  });

  describe("Integration with existing methods", () => {
    it("should be consistent with getMarkPriceKlines", async () => {
      const klines = await getMarkPriceKlines(testSymbol, "1h", 24);
      const withHistory = await getMarkPriceWithHistory(testSymbol, 1);

      expect(klines).not.toBeNull();
      expect(withHistory).not.toBeNull();

      if (klines && withHistory) {
        expect(klines.length).toBeGreaterThan(0);
        expect(withHistory.history.length).toBeGreaterThan(0);

        // Verify data consistency
        const klinesClosePrices = klines.map((k) => k.close);
        const historyPrices = withHistory.history.map((h) => h.price);

        // Latest prices should be consistent (allow larger error margin due to potential data differences)
        expect(klinesClosePrices[klinesClosePrices.length - 1]).toBeCloseTo(
          historyPrices[historyPrices.length - 1],
          0, // Allow larger error margin, precision set to 0
        );
      }
    });

    it("should be consistent with getMarkPriceHistory", async () => {
      const history = await getMarkPriceHistory(testSymbol, 7);
      const withHistory = await getMarkPriceWithHistory(testSymbol, 7);

      expect(history).not.toBeNull();
      expect(withHistory).not.toBeNull();

      if (history && withHistory) {
        expect(history.length).toBe(withHistory.history.length);

        // Verify data is completely consistent
        for (let i = 0; i < history.length; i++) {
          expect(history[i].timestamp).toBe(withHistory.history[i].timestamp);
          expect(history[i].price).toBeCloseTo(withHistory.history[i].price, 2);
          expect(history[i].source).toBe(withHistory.history[i].source);
        }
      }
    });
  });
});
