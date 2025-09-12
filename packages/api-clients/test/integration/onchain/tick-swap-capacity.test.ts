import { describe, it, expect, beforeAll } from "vitest";
import { getTickSwapCapacity } from "../../../src/blockchain/onchain/pools";
import {
  BSC_CONFIG,
  V3PoolConfig,
} from "../../../src/blockchain/onchain/pools/config";

// Test pool address (USDT-BR pool on BSC)
const TEST_POOL_ADDRESS =
  "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

describe("Tick Swap Capacity Integration Tests", () => {
  let swapCapacity: any;
  let swapCapacityWithoutUSD: any;

  beforeAll(async () => {
    // Get tick swap capacity for the test pool (with USD)
    swapCapacity = await getTickSwapCapacity(
      TEST_POOL_ADDRESS,
      BSC_CONFIG as V3PoolConfig,
      true, // includeUSD = true
    );

    // Get tick swap capacity for the test pool (without USD)
    swapCapacityWithoutUSD = await getTickSwapCapacity(
      TEST_POOL_ADDRESS,
      BSC_CONFIG as V3PoolConfig,
      false, // includeUSD = false
    );
  }, 30000); // 30 second timeout

  describe("getTickSwapCapacity with USD", () => {
    it("should return valid tick swap capacity structure", () => {
      expect(swapCapacity).toBeDefined();
      expect(swapCapacity).toHaveProperty("up");
      expect(swapCapacity).toHaveProperty("down");
      expect(swapCapacity).toHaveProperty("current");
    });

    it("should have valid up direction data with USD", () => {
      const up = swapCapacity.up;
      expect(up).toHaveProperty("token0Amount");
      expect(up).toHaveProperty("token1Amount");
      expect(up).toHaveProperty("token0AmountUSD");
      expect(up).toHaveProperty("token1AmountUSD");
      expect(up).toHaveProperty("nextTick");
      expect(up).toHaveProperty("nextRatio");
      expect(up).toHaveProperty("ratioImpact");
      expect(up).toHaveProperty("sqrtRatioNext");
      expect(up).toHaveProperty("direction");
      expect(up.direction).toBe("ratio_up");

      // USD values should be defined when includeUSD is true
      expect(up.token0AmountUSD).toBeDefined();
      expect(up.token1AmountUSD).toBeDefined();
    });

    it("should have valid down direction data with USD", () => {
      const down = swapCapacity.down;
      expect(down).toHaveProperty("token0Amount");
      expect(down).toHaveProperty("token1Amount");
      expect(down).toHaveProperty("token0AmountUSD");
      expect(down).toHaveProperty("token1AmountUSD");
      expect(down).toHaveProperty("prevTick");
      expect(down).toHaveProperty("prevRatio");
      expect(down).toHaveProperty("ratioImpact");
      expect(down).toHaveProperty("sqrtRatioPrev");
      expect(down).toHaveProperty("direction");
      expect(down.direction).toBe("ratio_down");

      // USD values should be defined when includeUSD is true
      expect(down.token0AmountUSD).toBeDefined();
      expect(down.token1AmountUSD).toBeDefined();
    });
  });

  describe("getTickSwapCapacity without USD", () => {
    it("should return valid tick swap capacity structure", () => {
      expect(swapCapacityWithoutUSD).toBeDefined();
      expect(swapCapacityWithoutUSD).toHaveProperty("up");
      expect(swapCapacityWithoutUSD).toHaveProperty("down");
      expect(swapCapacityWithoutUSD).toHaveProperty("current");
    });

    it("should have valid up direction data without USD", () => {
      const up = swapCapacityWithoutUSD.up;
      expect(up).toHaveProperty("token0Amount");
      expect(up).toHaveProperty("token1Amount");
      expect(up).toHaveProperty("nextTick");
      expect(up).toHaveProperty("nextRatio");
      expect(up).toHaveProperty("ratioImpact");
      expect(up).toHaveProperty("sqrtRatioNext");
      expect(up).toHaveProperty("direction");
      expect(up.direction).toBe("ratio_up");

      // USD values should be undefined when includeUSD is false
      expect(up.token0AmountUSD).toBeUndefined();
      expect(up.token1AmountUSD).toBeUndefined();
    });

    it("should have valid down direction data without USD", () => {
      const down = swapCapacityWithoutUSD.down;
      expect(down).toHaveProperty("token0Amount");
      expect(down).toHaveProperty("token1Amount");
      expect(down).toHaveProperty("prevTick");
      expect(down).toHaveProperty("prevRatio");
      expect(down).toHaveProperty("ratioImpact");
      expect(down).toHaveProperty("sqrtRatioPrev");
      expect(down).toHaveProperty("direction");
      expect(down.direction).toBe("ratio_down");

      // USD values should be undefined when includeUSD is false
      expect(down.token0AmountUSD).toBeUndefined();
      expect(down.token1AmountUSD).toBeUndefined();
    });
  });

  describe("Common functionality", () => {
    it("should have valid current state data", () => {
      const current = swapCapacity.current;
      expect(current).toHaveProperty("currentTick");
      expect(current).toHaveProperty("currentRatio");
      expect(current).toHaveProperty("sqrtRatioCurrent");
      expect(current).toHaveProperty("liquidityDistribution");
      expect(current).toHaveProperty("ratioImpact");
      expect(["token0", "token1"]).toContain(current.liquidityDistribution);
    });

    it("should have valid numeric values", () => {
      // Check that amounts are non-negative
      expect(swapCapacity.up.token0Amount).toBeGreaterThanOrEqual(0);
      expect(swapCapacity.up.token1Amount).toBeGreaterThanOrEqual(0);
      expect(swapCapacity.down.token0Amount).toBeGreaterThanOrEqual(0);
      expect(swapCapacity.down.token1Amount).toBeGreaterThanOrEqual(0);

      // Check that ratios are positive
      expect(swapCapacity.current.currentRatio).toBeGreaterThan(0);
      expect(swapCapacity.up.nextRatio).toBeGreaterThan(0);
      expect(swapCapacity.down.prevRatio).toBeGreaterThan(0);

      // Check that ticks are integers
      expect(Number.isInteger(swapCapacity.current.currentTick)).toBe(true);
      expect(Number.isInteger(swapCapacity.up.nextTick)).toBe(true);
      expect(Number.isInteger(swapCapacity.down.prevTick)).toBe(true);
    });

    it("should have correct tick relationships", () => {
      // Next tick should be current tick + 1
      expect(swapCapacity.up.nextTick).toBe(
        swapCapacity.current.currentTick + 1,
      );

      // Previous tick should be current tick - 1
      expect(swapCapacity.down.prevTick).toBe(
        swapCapacity.current.currentTick - 1,
      );
    });

    it("should have valid ratio impact calculations", () => {
      // Ratio impact should be a percentage (can be positive or negative)
      expect(typeof swapCapacity.current.ratioImpact).toBe("number");
      expect(typeof swapCapacity.up.ratioImpact).toBe("number");
      expect(typeof swapCapacity.down.ratioImpact).toBe("number");
    });

    it("should provide meaningful swap capacity information", () => {
      // At least one direction should have some swap capacity
      const hasUpCapacity =
        swapCapacity.up.token0Amount > 0 || swapCapacity.up.token1Amount > 0;
      const hasDownCapacity =
        swapCapacity.down.token0Amount > 0 ||
        swapCapacity.down.token1Amount > 0;

      expect(hasUpCapacity || hasDownCapacity).toBe(true);
    });
  });

  describe("USD Calculation Comparison", () => {
    it("should have same token amounts with and without USD", () => {
      // Token amounts should be identical regardless of USD calculation
      expect(swapCapacity.up.token0Amount).toBe(
        swapCapacityWithoutUSD.up.token0Amount,
      );
      expect(swapCapacity.up.token1Amount).toBe(
        swapCapacityWithoutUSD.up.token1Amount,
      );
      expect(swapCapacity.down.token0Amount).toBe(
        swapCapacityWithoutUSD.down.token0Amount,
      );
      expect(swapCapacity.down.token1Amount).toBe(
        swapCapacityWithoutUSD.down.token1Amount,
      );
    });

    it("should have same ratios with and without USD", () => {
      // Ratios should be identical regardless of USD calculation
      expect(swapCapacity.current.currentRatio).toBe(
        swapCapacityWithoutUSD.current.currentRatio,
      );
      expect(swapCapacity.up.nextRatio).toBe(
        swapCapacityWithoutUSD.up.nextRatio,
      );
      expect(swapCapacity.down.prevRatio).toBe(
        swapCapacityWithoutUSD.down.prevRatio,
      );
    });

    it("should have USD values only when includeUSD is true", () => {
      // With USD
      expect(swapCapacity.up.token0AmountUSD).toBeDefined();
      expect(swapCapacity.up.token1AmountUSD).toBeDefined();
      expect(swapCapacity.down.token0AmountUSD).toBeDefined();
      expect(swapCapacity.down.token1AmountUSD).toBeDefined();

      // Without USD
      expect(swapCapacityWithoutUSD.up.token0AmountUSD).toBeUndefined();
      expect(swapCapacityWithoutUSD.up.token1AmountUSD).toBeUndefined();
      expect(swapCapacityWithoutUSD.down.token0AmountUSD).toBeUndefined();
      expect(swapCapacityWithoutUSD.down.token1AmountUSD).toBeUndefined();
    });
  });

  describe("Swap Capacity Analysis", () => {
    it("should provide liquidity distribution information", () => {
      const distribution = swapCapacity.current.liquidityDistribution;
      expect(["token0", "token1"]).toContain(distribution);

      // Log the distribution for debugging
      console.log(`Liquidity distribution: ${distribution}`);
      console.log(`Current tick: ${swapCapacity.current.currentTick}`);
    });

    it("should calculate USD values correctly when enabled", () => {
      // If we have token amounts, USD values should be calculated
      if (swapCapacity.up.token0Amount > 0) {
        expect(swapCapacity.up.token0AmountUSD).toBeGreaterThan(0);
      }

      if (swapCapacity.up.token1Amount > 0) {
        expect(swapCapacity.up.token1AmountUSD).toBeGreaterThan(0);
      }
    });

    it("should provide price ratio information", () => {
      console.log(
        `Current ratio: ${swapCapacity.current.currentRatio.toFixed(8)}`,
      );
      console.log(`Next ratio: ${swapCapacity.up.nextRatio.toFixed(8)}`);
      console.log(`Previous ratio: ${swapCapacity.down.prevRatio.toFixed(8)}`);
      console.log(
        `Ratio impact: ${swapCapacity.current.ratioImpact.toFixed(4)}%`,
      );
    });
  });
});
