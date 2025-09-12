import { describe, it, expect } from "vitest";
import {
  getMarkPriceKlines,
  getMarkPriceHistory,
} from "../../../../src/blockchain/binance/perp";

describe("Binance Mark Price History Integration", () => {
  const testSymbol = "BTCUSDT"; // 使用 BTCUSDT 作为测试符号

  describe("getMarkPriceKlines", () => {
    it("should fetch klines data for BTCUSDT", async () => {
      const klines = await getMarkPriceKlines(testSymbol, "1m", 10);
      expect(klines).not.toBeNull();
      if (klines) {
        expect(Array.isArray(klines)).toBe(true);
        expect(klines.length).toBeGreaterThan(0);
        expect(klines.length).toBeLessThanOrEqual(10);

        // 验证数据结构
        const firstKline = klines[0];
        expect(firstKline).toHaveProperty("timestamp");
        expect(firstKline).toHaveProperty("open");
        expect(firstKline).toHaveProperty("high");
        expect(firstKline).toHaveProperty("low");
        expect(firstKline).toHaveProperty("close");
        expect(firstKline).toHaveProperty("volume");
        expect(firstKline).toHaveProperty("source");

        expect(typeof firstKline.timestamp).toBe("number");
        expect(typeof firstKline.open).toBe("number");
        expect(typeof firstKline.high).toBe("number");
        expect(typeof firstKline.low).toBe("number");
        expect(typeof firstKline.close).toBe("number");
        expect(typeof firstKline.volume).toBe("number");
        expect(firstKline.source).toBe("binance");

        // 验证价格逻辑
        expect(firstKline.high).toBeGreaterThanOrEqual(firstKline.open);
        expect(firstKline.high).toBeGreaterThanOrEqual(firstKline.close);
        expect(firstKline.low).toBeLessThanOrEqual(firstKline.open);
        expect(firstKline.low).toBeLessThanOrEqual(firstKline.close);
      }
    }, 15000);

    it("should handle different intervals", async () => {
      const intervals = ["1h", "4h", "1d"] as const;

      for (const interval of intervals) {
        const klines = await getMarkPriceKlines(testSymbol, interval, 5);

        expect(klines).not.toBeNull();
        if (klines) {
          expect(klines.length).toBeGreaterThan(0);
          expect(klines.length).toBeLessThanOrEqual(5);
        }
      }
    }, 20000);

    it("should handle invalid symbol gracefully", async () => {
      const klines = await getMarkPriceKlines("INVALID_SYMBOL", "1h", 10);
      expect(klines).toBeNull();
    });
  });

  describe("getMarkPriceHistory", () => {
    it("should fetch 7 days of price history", async () => {
      const history = await getMarkPriceHistory(testSymbol, 7);

      expect(history).not.toBeNull();
      if (history) {
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThan(0);

        // 验证数据结构
        const firstPrice = history[0];
        expect(firstPrice).toHaveProperty("timestamp");
        expect(firstPrice).toHaveProperty("price");
        expect(firstPrice).toHaveProperty("source");

        expect(typeof firstPrice.timestamp).toBe("number");
        expect(typeof firstPrice.price).toBe("number");
        expect(firstPrice.source).toBe("binance");

        // 验证价格为正数
        expect(firstPrice.price).toBeGreaterThan(0);
      }
    }, 15000);

    it("should handle different day ranges", async () => {
      const dayRanges = [1, 7, 30] as const;

      for (const days of dayRanges) {
        const history = await getMarkPriceHistory(testSymbol, days);

        expect(history).not.toBeNull();
        if (history) {
          expect(history.length).toBeGreaterThan(0);

          // 验证时间戳是递增的
          for (let i = 1; i < history.length; i++) {
            expect(history[i].timestamp).toBeGreaterThan(
              history[i - 1].timestamp,
            );
          }
        }
      }
    }, 30000);

    it("should handle invalid symbol gracefully", async () => {
      const history = await getMarkPriceHistory("INVALID_SYMBOL", 7);
      expect(history).toBeNull();
    });
  });
});
