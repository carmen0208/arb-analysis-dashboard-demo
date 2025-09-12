import { describe, it, expect, beforeAll } from "vitest";
import {
  getMarkPriceKlines,
  getMarkPriceHistory,
  getMarkPriceWithHistory,
} from "../../../../src/blockchain/binance/perp";

describe("Binance Mark Price With History Integration", () => {
  const testSymbol = "BTCUSDT"; // 使用 BTCUSDT 作为测试符号

  describe("getMarkPriceWithHistory", () => {
    it("should fetch current price and history data for BTCUSDT in one API call", async () => {
      const result = await getMarkPriceWithHistory(testSymbol, 7);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toHaveProperty("currentPrice");
        expect(result).toHaveProperty("history");
        expect(Array.isArray(result.history)).toBe(true);

        // 验证当前价格
        if (result.currentPrice !== null) {
          expect(typeof result.currentPrice).toBe("number");
          expect(result.currentPrice).toBeGreaterThan(0);
        }

        // 验证历史数据
        expect(result.history.length).toBeGreaterThan(0);
        expect(result.history.length).toBeLessThanOrEqual(168); // 7天 * 24小时

        // 验证历史数据结构
        const firstHistory = result.history[0];
        expect(firstHistory).toHaveProperty("timestamp");
        expect(firstHistory).toHaveProperty("price");
        expect(firstHistory).toHaveProperty("source");
        expect(firstHistory.source).toBe("binance");
        expect(typeof firstHistory.timestamp).toBe("number");
        expect(typeof firstHistory.price).toBe("number");
        expect(firstHistory.price).toBeGreaterThan(0);

        // 验证时间戳是递增的
        for (let i = 1; i < result.history.length; i++) {
          expect(result.history[i].timestamp).toBeGreaterThan(
            result.history[i - 1].timestamp,
          );
        }

        // 验证最新的价格应该是当前价格（如果都有的话）
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

          // 验证数据量符合预期
          if (days <= 1) {
            expect(result.history.length).toBeLessThanOrEqual(1440); // 24小时间隔
          } else if (days <= 7) {
            expect(result.history.length).toBeLessThanOrEqual(days * 24); // 1小时间隔
          } else if (days <= 30) {
            expect(result.history.length).toBeLessThanOrEqual(days * 6); // 4小时间隔
          } else {
            expect(result.history.length).toBeLessThanOrEqual(days); // 1天间隔
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
        expect(result.history.length).toBeLessThanOrEqual(1440); // 默认1天
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

        // 验证数据一致性
        const klinesClosePrices = klines.map((k) => k.close);
        const historyPrices = withHistory.history.map((h) => h.price);

        // 最新的价格应该一致（允许更大的误差范围，因为数据可能有微小差异）
        expect(klinesClosePrices[klinesClosePrices.length - 1]).toBeCloseTo(
          historyPrices[historyPrices.length - 1],
          1,
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

        // 验证数据完全一致
        for (let i = 0; i < history.length; i++) {
          expect(history[i].timestamp).toBe(withHistory.history[i].timestamp);
          expect(history[i].price).toBeCloseTo(withHistory.history[i].price, 2);
          expect(history[i].source).toBe(withHistory.history[i].source);
        }
      }
    });
  });
});
