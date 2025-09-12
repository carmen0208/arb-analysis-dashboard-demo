/**
 * Integration tests for CoinGecko Top Pools API
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getTopPoolsByNetwork,
  getAllTopPoolsByNetwork,
  getTopPoolsWithRetry,
} from "../../../src/blockchain/coingecko/pools";
import { validateEnv, requiredCoinGeckoEnvVars } from "../../integration/setup";

describe("CoinGecko Top Pools API Integration", () => {
  beforeAll(() => {
    validateEnv(requiredCoinGeckoEnvVars);
  });

  describe("getTopPoolsByNetwork", () => {
    it("should fetch top pools for ethereum network (single page)", async () => {
      const pools = await getTopPoolsByNetwork("eth", { page: 1 });

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
      expect(pools.length).toBeLessThanOrEqual(20); // Max 20 per page
      // Check first pool structure
      if (pools.length > 0) {
        const firstPool = pools[0];
        expect(firstPool).toHaveProperty("id");
        expect(firstPool).toHaveProperty("type");
        expect(firstPool).toHaveProperty("attributes");
        expect(firstPool.attributes).toHaveProperty("address");
        expect(firstPool.attributes).toHaveProperty("name");
        expect(firstPool.attributes).toHaveProperty("base_token_price_usd");
        expect(firstPool.attributes).toHaveProperty("quote_token_price_usd");
        expect(firstPool.relationships).toHaveProperty("base_token");
        expect(firstPool.relationships).toHaveProperty("quote_token");
      }
    });

    it("should fetch top pools for binance-smart-chain network", async () => {
      const pools = await getTopPoolsByNetwork("bsc");

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
    });

    it("should handle invalid network gracefully", async () => {
      const pools = await getTopPoolsByNetwork("invalid-network");

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBe(0);
    });
  });

  describe("getAllTopPoolsByNetwork", () => {
    it("should fetch multiple pages of top pools for binance smart chain", async () => {
      const pools = await getAllTopPoolsByNetwork("bsc", 3); // Fetch 3 pages

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
      expect(pools.length).toBeLessThanOrEqual(60); // 3 pages * 20 pools max

      // Check that we have pools from different pages
      const uniqueAddresses = new Set(
        pools.map((pool) => pool.attributes.address),
      );
      expect(uniqueAddresses.size).toBe(pools.length); // No duplicates
    });

    it("should respect maxPages limit", async () => {
      const pools = await getAllTopPoolsByNetwork("bsc", 2); // Only 2 pages

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeLessThanOrEqual(40); // 2 pages * 20 pools max
    });

    it("should handle network with few pools", async () => {
      const pools = await getAllTopPoolsByNetwork("polygon-pos", 5);

      expect(Array.isArray(pools)).toBe(true);
      // Some networks might have fewer pools
    });
  });

  describe("getTopPoolsWithRetry", () => {
    it("should fetch pools with retry mechanism", async () => {
      const pools = await getTopPoolsWithRetry("bsc", 2, {}, 2);

      expect(Array.isArray(pools)).toBe(true);
      // Should work normally without needing retries
    });

    it("should handle errors gracefully", async () => {
      const pools = await getTopPoolsWithRetry("invalid-network", 2, {}, 1);

      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBe(0);
    });
  });

  describe("Pool Data Structure", () => {
    it("should have correct pool token structure", async () => {
      const pools = await getTopPoolsByNetwork("bsc", { page: 1 });

      if (pools.length > 0) {
        const pool = pools[0];

        // Check that relationships exist
        expect(pool.relationships).toBeDefined();
        expect(pool.relationships.base_token).toBeDefined();
        expect(pool.relationships.quote_token).toBeDefined();

        // Check that data exists in relationships
        expect(pool.relationships.base_token.data).toBeDefined();
        expect(pool.relationships.quote_token.data).toBeDefined();

        // Check basic structure of token data
        const baseToken = pool.relationships.base_token.data;
        const quoteToken = pool.relationships.quote_token.data;

        // Check that tokens have basic properties (adjust based on actual API response)
        expect(typeof baseToken).toBe("object");
        expect(typeof quoteToken).toBe("object");
      }
    });

    it("should have price and volume data", async () => {
      const pools = await getTopPoolsByNetwork("ethereum", { page: 1 });

      if (pools.length > 0) {
        const pool = pools[0];
        const attrs = pool.attributes;

        expect(typeof attrs.base_token_price_usd).toBe("number");
        expect(typeof attrs.quote_token_price_usd).toBe("number");
        expect(typeof attrs.volume_usd.h24).toBe("number");
        expect(typeof attrs.reserve_in_usd).toBe("number");
      }
    });
  });
});
