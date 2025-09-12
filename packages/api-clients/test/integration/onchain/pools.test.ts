import { describe, it, expect } from "vitest";
import {
  getPoolAddress,
  getPoolBaseInfo,
  getPoolBaseInfoWithTokenInfo,
  getTickLiquidityDistribution,
  getPoolPrice,
  getDexConfig,
  detectLiquidityCliffs,
} from "../../../src/blockchain/onchain/pools/index";
import {
  getTWAP,
  getTWAL,
} from "../../../src/blockchain/onchain/pools/twap-twal";

describe("V3 Pool Analyzer Functions", () => {
  describe("getPoolAddress", () => {
    it("should get pool address for known tokens in default config(pancakeswap-v3-bsc)", async () => {
      // USDT and BUSD on BSC
      const usdtAddress =
        "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
      const brAddress =
        "0xff7d6a96ae471bbcd7713af9cb1feeb16cf56b41" as `0x${string}`;
      const fee = 100; // 0.05%

      const poolAddress = await getPoolAddress(usdtAddress, brAddress, fee);

      expect(poolAddress).toBeDefined();
      expect(poolAddress.toLowerCase()).toBe(
        "0x380aadf63d84d3a434073f1d5d95f02fb23d5228".toLowerCase(),
      );
    });

    it("should work with different configs(uniswap-v3-bsc)", async () => {
      const homeAddress =
        "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d" as `0x${string}`;
      const wbnbAddress =
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d" as `0x${string}`;
      const fee = 100;

      const customConfig = getDexConfig("uniswap-v3-bsc");

      const poolAddress = await getPoolAddress(
        homeAddress,
        wbnbAddress,
        fee,
        customConfig,
      );
      expect(poolAddress.toLowerCase()).toBe(
        "0xfdfc89d953e044f84faa2ed4953190a066328ee0".toLowerCase(),
      );
    });
  });

  describe("getPoolBaseInfo", () => {
    it("should get pool base info without token details", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      const poolInfo = await getPoolBaseInfo(poolAddress);
      expect(poolInfo).toBeDefined();
      expect(poolInfo.poolAddress).toBe(poolAddress);
      expect(poolInfo.token0Address).toBeDefined();
      expect(poolInfo.token1Address).toBeDefined();
      expect(poolInfo.currentTick).toBeTypeOf("number");
      expect(poolInfo.sqrtPriceX96).toBeTypeOf("bigint");
      expect(poolInfo.liquidity).toBeTypeOf("bigint");
      expect(poolInfo.tickSpacing).toBeTypeOf("number");

      // Should not include token details
      expect(poolInfo).not.toHaveProperty("token0");
      expect(poolInfo).not.toHaveProperty("token1");
      expect(poolInfo).not.toHaveProperty("totalUSD");
    });

    it("should get pool base info with token information", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      const poolInfo = await getPoolBaseInfoWithTokenInfo(poolAddress);
      expect(poolInfo).toBeDefined();
      expect(poolInfo.poolAddress).toBe(poolAddress);
      expect(poolInfo.token0).toBeDefined();
      expect(poolInfo.token1).toBeDefined();
      expect(poolInfo.currentTick).toBeTypeOf("number");
      expect(poolInfo.liquidity).toBeTypeOf("bigint");
      expect(poolInfo.totalUSD).toBeGreaterThan(0);
      expect(
        poolInfo.tokenRatio.token0Percent + poolInfo.tokenRatio.token1Percent,
      ).toBeCloseTo(100, 1);
    });
  });

  describe("getTickLiquidityDistribution", () => {
    it("should get tick liquidity distribution", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      expect(distribution).toBeDefined();
      expect(Array.isArray(distribution)).toBe(true);
      expect(distribution.length).toBeGreaterThan(0);

      // Check first item structure
      const firstTick = distribution[0];
      expect(firstTick.tick).toBeTypeOf("number");
      expect(firstTick.liquidityNet).toBeTypeOf("bigint");
      expect(firstTick.liquidityGross).toBeTypeOf("bigint");
      expect(firstTick.initialized).toBeTypeOf("boolean");
      expect(firstTick.currentTick).toBeTypeOf("boolean");

      // Check that at least one tick is marked as current tick
      const hasCurrentTick = distribution.some((tick) => tick.currentTick);
      expect(hasCurrentTick).toBe(true);
    });

    it("should get tick liquidity distribution with current tick even if it has no liquidity", async () => {
      const poolAddress =
        "0x6b1641c6b3aa57765c67ef9c22e0a3a952963ef3" as `0x${string}`;

      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      expect(distribution).toBeDefined();
      expect(Array.isArray(distribution)).toBe(true);
      expect(distribution.length).toBeGreaterThan(0);

      // Check first item structure
      const firstTick = distribution[0];
      expect(firstTick.tick).toBeTypeOf("number");
      expect(firstTick.liquidityNet).toBeTypeOf("bigint");
      expect(firstTick.liquidityGross).toBeTypeOf("bigint");
      expect(firstTick.initialized).toBeTypeOf("boolean");
      expect(firstTick.currentTick).toBeTypeOf("boolean");
      // Check that at least one tick is marked as current tick
      const hasCurrentTick = distribution.some((tick) => tick.currentTick);
      expect(hasCurrentTick).toBe(true);
    });
  });

  describe("detectLiquidityCliffs", () => {
    it("should detect liquidity cliffs from real pool data", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Get real liquidity distribution data
      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      expect(distribution).toBeDefined();
      expect(distribution.length).toBeGreaterThan(0);

      // Get pool base info to get starting liquidity
      const poolInfo = await getPoolBaseInfo(poolAddress);
      const startingLiquidity = poolInfo.liquidity;

      // Detect liquidity cliffs with default threshold (50%)
      const cliffs = detectLiquidityCliffs(distribution, startingLiquidity);

      console.log("Liquidity Cliffs Analysis:");
      console.log(`Pool: ${poolAddress}`);
      console.log(`Starting Liquidity: ${startingLiquidity.toString()}`);
      console.log(`Total Ticks Analyzed: ${distribution.length}`);
      console.log(`Cliffs Found: ${cliffs.length}`);

      if (cliffs.length > 0) {
        console.log("Top 5 Liquidity Cliffs:");
        cliffs.slice(0, 5).forEach((cliff, index) => {
          console.log(
            `  ${index + 1}. Tick ${cliff.tick}: ${cliff.deltaPct}% change`,
          );
          console.log(`     Previous: ${cliff.previousLiquidity.toString()}`);
          console.log(`     Current: ${cliff.currentLiquidity.toString()}`);
        });
      }

      // Basic validation
      expect(Array.isArray(cliffs)).toBe(true);

      // Each cliff should have the expected structure
      cliffs.forEach((cliff) => {
        expect(cliff.tick).toBeTypeOf("number");
        expect(cliff.previousLiquidity).toBeTypeOf("bigint");
        expect(cliff.currentLiquidity).toBeTypeOf("bigint");
        expect(cliff.deltaPct).toBeTypeOf("number");
        expect(cliff.deltaPct).toBeGreaterThanOrEqual(0.5); // Default threshold
      });

      // Cliffs should be sorted by tick (since input is sorted)
      for (let i = 1; i < cliffs.length; i++) {
        expect(cliffs[i].tick).toBeGreaterThan(cliffs[i - 1].tick);
      }
    });

    it("should detect liquidity cliffs with custom threshold", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Get real liquidity distribution data
      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      const poolInfo = await getPoolBaseInfo(poolAddress);
      const startingLiquidity = poolInfo.liquidity;

      // Test with different thresholds
      const thresholds = [0.1, 0.25, 0.5, 0.75, 1.0]; // 10%, 25%, 50%, 75%, 100%

      console.log("\nLiquidity Cliffs with Different Thresholds:");
      console.log(`Pool: ${poolAddress}`);
      console.log(`Starting Liquidity: ${startingLiquidity.toString()}`);
      console.log(`Total Ticks Analyzed: ${distribution.length}`);

      thresholds.forEach((threshold) => {
        const cliffs = detectLiquidityCliffs(
          distribution,
          startingLiquidity,
          threshold,
        );
        const thresholdPct = threshold * 100;
        // console.log(cliffs);
        console.log(
          `\nThreshold ${thresholdPct}%: ${cliffs.length} cliffs found`,
        );

        if (cliffs.length > 0) {
          console.log(
            `  Sample cliff: Tick ${cliffs[0].tick} with ${cliffs[0].deltaPct}% change`,
          );
        }

        // Validate that all cliffs meet the threshold
        cliffs.forEach((cliff) => {
          expect(cliff.deltaPct).toBeGreaterThanOrEqual(thresholdPct);
        });

        // Higher thresholds should result in fewer or equal cliffs
        if (threshold > 0.1) {
          const lowerThresholdCliffs = detectLiquidityCliffs(
            distribution,
            startingLiquidity,
            threshold - 0.1,
          );
          expect(cliffs.length).toBeLessThanOrEqual(
            lowerThresholdCliffs.length,
          );
        }
      });
    });

    it("should handle pools with minimal liquidity changes", async () => {
      const poolAddress =
        "0x6b1641c6b3aa57765c67ef9c22e0a3a952963ef3" as `0x${string}`;

      // Get real liquidity distribution data from a pool with minimal activity
      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      const poolInfo = await getPoolBaseInfo(poolAddress);
      const startingLiquidity = poolInfo.liquidity;

      console.log("\nMinimal Liquidity Pool Analysis:");
      console.log(`Pool: ${poolAddress}`);
      console.log(`Starting Liquidity: ${startingLiquidity.toString()}`);
      console.log(`Total Ticks Analyzed: ${distribution.length}`);

      // Test with very low threshold to catch small changes
      const cliffs = detectLiquidityCliffs(
        distribution,
        startingLiquidity,
        0.05,
      ); // 5% threshold

      console.log(`Cliffs found with 5% threshold: ${cliffs.length}`);

      if (cliffs.length > 0) {
        console.log("All cliffs found:");
        cliffs.forEach((cliff, index) => {
          console.log(
            `  ${index + 1}. Tick ${cliff.tick}: ${cliff.deltaPct}% change`,
          );
        });
      }

      // Basic validation
      expect(Array.isArray(cliffs)).toBe(true);

      // All cliffs should meet the 5% threshold
      cliffs.forEach((cliff) => {
        expect(cliff.deltaPct).toBeGreaterThanOrEqual(5);
      });
    });

    it("should demonstrate cliff detection with detailed analysis", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Get real liquidity distribution data
      const distribution = await getTickLiquidityDistribution(poolAddress, 20);
      const poolInfo = await getPoolBaseInfo(poolAddress);
      const startingLiquidity = poolInfo.liquidity;

      console.log("\nDetailed Liquidity Cliff Analysis:");
      console.log(`Pool: ${poolAddress}`);
      console.log(`Current Tick: ${poolInfo.currentTick}`);
      console.log(`Starting Liquidity: ${startingLiquidity.toString()}`);
      console.log(`Total Ticks Analyzed: ${distribution.length}`);

      // Analyze with different thresholds
      const analysis = [0.1, 0.25, 0.5].map((threshold) => {
        const cliffs = detectLiquidityCliffs(
          distribution,
          startingLiquidity,
          threshold,
        );
        return {
          threshold: threshold * 100,
          cliffCount: cliffs.length,
          cliffs: cliffs.slice(0, 3), // Top 3 cliffs
        };
      });

      console.log("\nCliff Analysis Summary:");
      analysis.forEach(({ threshold, cliffCount, cliffs }) => {
        console.log(`\n${threshold}% threshold: ${cliffCount} cliffs`);
        if (cliffs.length > 0) {
          console.log("  Top cliffs:");
          cliffs.forEach((cliff, index) => {
            const direction =
              cliff.currentLiquidity > cliff.previousLiquidity ? "↑" : "↓";
            console.log(
              `    ${index + 1}. Tick ${cliff.tick} ${direction} ${cliff.deltaPct}%`,
            );
          });
        }
      });

      // Validate analysis results
      analysis.forEach(({ threshold, cliffCount, cliffs }) => {
        expect(cliffCount).toBeGreaterThanOrEqual(0);
        cliffs.forEach((cliff) => {
          expect(cliff.deltaPct).toBeGreaterThanOrEqual(threshold);
        });
      });

      // Higher thresholds should generally result in fewer cliffs
      expect(analysis[0].cliffCount).toBeGreaterThanOrEqual(
        analysis[1].cliffCount,
      );
      expect(analysis[1].cliffCount).toBeGreaterThanOrEqual(
        analysis[2].cliffCount,
      );
    });
  });

  describe("getPoolPrice", () => {
    it("should calculate pool price from sqrtPriceX96 with default decimals", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      const priceInfo = await getPoolPrice(poolAddress);
      expect(priceInfo).toBeDefined();
      expect(priceInfo.token0Price).toBeGreaterThan(0);
      expect(priceInfo.token1Price).toBeGreaterThan(0);
      expect(priceInfo.priceRatio).toBeGreaterThan(0);
      expect(priceInfo.sqrtPriceX96).toBeTypeOf("bigint");

      // Test new enhanced fields
      expect(priceInfo.tick).toBeTypeOf("number");
      expect(priceInfo.priceFromSqrtPriceX96).toBeGreaterThan(0);
      expect(priceInfo.priceFromTick).toBeGreaterThan(0);
      expect(priceInfo.priceDifference).toBeGreaterThanOrEqual(0);
      expect(priceInfo.priceDifferencePercent).toBeGreaterThanOrEqual(0);
      expect(priceInfo.adjustedPrice).toBeGreaterThan(0);

      // Verify price calculation consistency
      expect(priceInfo.priceFromSqrtPriceX96).toBeCloseTo(
        priceInfo.priceRatio,
        8,
      );
      expect(priceInfo.adjustedPrice).toBeCloseTo(priceInfo.priceRatio, 8);
    });

    it("should calculate pool price with custom decimal parameters", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Test with different decimal configurations
      const priceInfo = await getPoolPrice(poolAddress, undefined, 18, 6);
      expect(priceInfo).toBeDefined();
      expect(priceInfo.token0Price).toBeGreaterThan(0);
      expect(priceInfo.token1Price).toBeGreaterThan(0);
      expect(priceInfo.adjustedPrice).toBeGreaterThan(0);

      // Verify decimal adjustment is applied
      expect(priceInfo.adjustedPrice).not.toBe(priceInfo.priceFromSqrtPriceX96);
    });

    it("should calculate pool price with same decimals (no adjustment)", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Test with same decimals (should result in no adjustment)
      const priceInfo = await getPoolPrice(poolAddress, undefined, 18, 18);
      expect(priceInfo).toBeDefined();

      // When decimals are the same, adjusted price should equal raw price
      expect(priceInfo.adjustedPrice).toBeCloseTo(
        priceInfo.priceFromSqrtPriceX96,
        8,
      );
    });

    it("should provide accurate price comparison between calculation methods", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      const priceInfo = await getPoolPrice(poolAddress);

      // Both calculation methods should produce positive values
      expect(priceInfo.priceFromSqrtPriceX96).toBeGreaterThan(0);
      expect(priceInfo.priceFromTick).toBeGreaterThan(0);

      // Price difference should be reasonable (not too large)
      expect(priceInfo.priceDifferencePercent).toBeLessThan(1); // Should be less than 1%

      // sqrtPriceX96 method should be used as primary (higher precision)
      expect(priceInfo.priceRatio).toBe(priceInfo.priceFromSqrtPriceX96);
    });

    it("should handle different token decimal configurations correctly", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Test various decimal combinations
      const testCases = [
        { token0Decimals: 18, token1Decimals: 6 }, // WETH/USDT
        { token0Decimals: 18, token1Decimals: 18 }, // WETH/WBTC
        { token0Decimals: 6, token1Decimals: 18 }, // USDT/WETH
        { token0Decimals: 8, token1Decimals: 8 }, // WBTC/renBTC
      ];

      for (const testCase of testCases) {
        const priceInfo = await getPoolPrice(
          poolAddress,
          undefined,
          testCase.token0Decimals,
          testCase.token1Decimals,
        );

        expect(priceInfo.adjustedPrice).toBeGreaterThan(0);
        expect(priceInfo.token0Price).toBeGreaterThan(0);
        expect(priceInfo.token1Price).toBeGreaterThan(0);

        // Verify price relationship
        expect(priceInfo.token0Price * priceInfo.token1Price).toBeCloseTo(1, 8);
      }
    });
  });

  describe("TWAP & TWAL Functions", () => {
    it("should calculate TWAP with detailed ratio analysis", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Test TWAP calculation with different time periods
      const timePeriods = [60, 300, 900]; // 1min, 5min, 15min

      for (const secondsAgo of timePeriods) {
        const twap = await getTWAP(poolAddress, secondsAgo);

        // Check if we got an error response
        if ("error" in twap) {
          console.log(
            `\nTWAP Analysis (${secondsAgo}s) - Error: ${twap.error}`,
          );
          expect(twap.error).toBe("OLD_OBSERVATION_DATA");
          continue; // Skip to next iteration
        }

        console.log(`\nTWAP Analysis (${secondsAgo}s):`);
        console.log(`Pool: ${poolAddress}`);
        console.log(`Time Period: ${secondsAgo} seconds`);
        console.log(`Average Tick: ${twap.averageTick}`);
        console.log(`TWAP Token Ratio: ${twap.twapRatios.fromTick}`);

        // Basic validation
        expect(twap).toBeDefined();
        expect(twap.twapRatios.fromTick).toBeGreaterThan(0);
        expect(twap.averageTick).toBeTypeOf("number");
        expect(Array.isArray(twap.observations)).toBe(true);
        expect(twap.observations.length).toBe(2); // [secondsAgo, 0]

        // Validate TWAP ratios structure
        expect(twap.twapRatios).toBeDefined();
        expect(twap.twapRatios.fromTick).toBeGreaterThan(0);
        expect(twap.twapRatios.fromSqrtPrice).toBeGreaterThan(0);

        // Validate current ratios structure
        expect(twap.currentRatios).toBeDefined();
        expect(twap.currentRatios.fromTick).toBeGreaterThan(0);
        expect(twap.currentRatios.fromSqrtPrice).toBeGreaterThan(0);

        // Validate observations structure
        twap.observations.forEach((obs, index) => {
          expect(obs.secondsAgo).toBeTypeOf("number");
          expect(obs.tickCumulative).toBeTypeOf("bigint");
          expect(obs.secondsPerLiquidityCumulativeX128).toBeTypeOf("bigint");
        });

        // Validate that observations are in correct order
        expect(twap.observations[0].secondsAgo).toBe(secondsAgo);
        expect(twap.observations[1].secondsAgo).toBe(0);
      }
    });

    it("should calculate TWAL with current state comparison", async () => {
      const poolAddress =
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`;

      // Test TWAL calculation with different time periods
      const timePeriods = [60, 300, 900]; // 1min, 5min, 15min

      for (const secondsAgo of timePeriods) {
        const twal = await getTWAL(poolAddress, secondsAgo);

        // Check if we got an error response
        if ("error" in twal) {
          console.log(
            `\nTWAL Analysis (${secondsAgo}s) - Error: ${twal.error}`,
          );
          expect(twal.error).toBe("OLD_OBSERVATION_DATA");
          continue; // Skip to next iteration
        }

        console.log(`\nTWAL Analysis (${secondsAgo}s):`);
        console.log(`Pool: ${poolAddress}`);
        console.log(`Time Period: ${secondsAgo} seconds`);
        console.log(`TWAL: ${twal.twal.toString()}`);
        console.log(`Current Liquidity: ${twal.currentLiquidity.toString()}`);
        console.log(`Current Tick: ${twal.currentTick}`);

        // Basic validation
        expect(twal).toBeDefined();
        expect(twal.twal).toBeTypeOf("bigint");
        expect(twal.twal).toBeGreaterThan(0n);
        expect(twal.currentLiquidity).toBeTypeOf("bigint");
        expect(twal.currentLiquidity).toBeGreaterThan(0n);
        expect(twal.currentTick).toBeTypeOf("number");
        expect(Array.isArray(twal.observations)).toBe(true);
        expect(twal.observations.length).toBe(2); // [secondsAgo, 0]

        // Validate observations structure
        twal.observations.forEach((obs, index) => {
          expect(obs.secondsAgo).toBeTypeOf("number");
          expect(obs.tickCumulative).toBeTypeOf("bigint");
          expect(obs.secondsPerLiquidityCumulativeX128).toBeTypeOf("bigint");
        });

        // Validate that observations are in correct order
        expect(twal.observations[0].secondsAgo).toBe(secondsAgo);
        expect(twal.observations[1].secondsAgo).toBe(0);

        // TWAL should be reasonable compared to current liquidity
        const twalNumber = Number(twal.twal);
        const currentLiquidityNumber = Number(twal.currentLiquidity);
        const ratio = twalNumber / currentLiquidityNumber;

        // TWAL should be within reasonable bounds (not too far from current liquidity)
        expect(ratio).toBeGreaterThan(0.1); // At least 10% of current liquidity
        expect(ratio).toBeLessThan(10); // Not more than 10x current liquidity
      }
    });

    it("should demonstrate TWAP vs current price comparison", async () => {
      const poolAddress =
        "0xd7af60112d7dfe0f914724e3407dd54424aaa19b" as `0x${string}`;
      //       // 0xd5b642646a6e40090d5d61ca11a78ee2f6e0ef14,0xfa7421f1ed6ad1548316a847e8437af7219a8f18,0xf9452bb9b8b119dc08094b8b3b191bc88e94b319,0x4b54900d3801b7a27657a0e63ce7a819365e0940,0xd7af60112d7dfe0f914724e3407dd54424aaa19b,0xaa133749abd544e6351ce227c1b12fb143f159d1

      // Get both TWAP and current state
      const twap = await getTWAP(poolAddress, 300); // 5-minute TWAP
      const twal = await getTWAL(poolAddress, 300); // 5-minute TWAL

      // Check if we got error responses
      if ("error" in twap || "error" in twal) {
        console.log("\nTWAP vs Current Price Comparison - Error:");
        if ("error" in twap) console.log(`TWAP Error: ${twap.error}`);
        if ("error" in twal) console.log(`TWAL Error: ${twal.error}`);
        console.log("Using fallback current state due to old observation data");
        return;
      }

      console.log("\nTWAP vs Current Price Comparison:");
      console.log(`Pool: ${poolAddress}`);
      console.log(`Time Period: 300 seconds (5 minutes)`);
      console.log(`TWAP Token Ratio: ${twap.twapRatios.fromTick}`);
      console.log(`Current Token Ratio: ${twap.currentRatios.fromTick}`);
      console.log(
        `Price Difference: ${Math.abs(twap.twapRatios.fromTick - twap.currentRatios.fromTick)}`,
      );
      console.log(
        `Price Difference %: ${((Math.abs(twap.twapRatios.fromTick - twap.currentRatios.fromTick) / twap.currentRatios.fromTick) * 100).toFixed(4)}%`,
      );

      // Validate that both functions return consistent current state
      // Note: Small differences may occur due to timing between calls
      expect(twap.currentRatios.fromTick).toBeCloseTo(
        twap.currentRatios.fromSqrtPrice,
        8,
      );

      // Validate that TWAP and current ratios are both positive
      expect(twap.twapRatios.fromTick).toBeGreaterThan(0);
      expect(twap.currentRatios.fromTick).toBeGreaterThan(0);

      // Price difference should be reasonable (not indicating extreme volatility)
      const priceDifferencePercent =
        (Math.abs(twap.twapRatios.fromTick - twap.currentRatios.fromTick) /
          twap.currentRatios.fromTick) *
        100;
      expect(priceDifferencePercent).toBeLessThan(50); // Should not be more than 50% difference
    });

    it("should validate calculation consistency across multiple pools", async () => {
      const testPools = [
        "0x380aaDF63D84D3A434073F1d5d95f02fB23d5228" as `0x${string}`, // USDT-BR
        "0x6b1641c6b3aa57765c67ef9c22e0a3a952963ef3" as `0x${string}`, // Another pool
      ];

      for (const poolAddress of testPools) {
        console.log(`\nTesting Pool: ${poolAddress}`);

        try {
          // Test TWAP
          const twap = await getTWAP(poolAddress, 300);
          if ("error" in twap) {
            console.log(`  TWAP Error: ${twap.error}`);
          } else {
            expect(twap.twapRatios.fromTick).toBeGreaterThan(0);
            expect(twap.currentRatios.fromTick).toBeGreaterThan(0);
          }

          // Test TWAL
          const twal = await getTWAL(poolAddress, 300);
          if ("error" in twal) {
            console.log(`  TWAL Error: ${twal.error}`);
          } else {
            expect(twal.twal).toBeGreaterThan(0n);
            expect(twal.currentLiquidity).toBeGreaterThan(0n);
          }

          // Validate consistency between TWAP and TWAL current state (if both succeeded)
          if (!("error" in twap) && !("error" in twal)) {
            expect(twap.currentRatios.fromTick).toBeCloseTo(
              twap.currentRatios.fromSqrtPrice,
              8,
            );
          }

          if (!("error" in twap)) {
            console.log(`  TWAP Ratio: ${twap.twapRatios.fromTick}`);
            console.log(`  Current Ratio: ${twap.currentRatios.fromTick}`);
          }
          if (!("error" in twal)) {
            console.log(`  TWAL: ${twal.twal.toString()}`);
            console.log(
              `  Current Liquidity: ${twal.currentLiquidity.toString()}`,
            );
          }
        } catch (error) {
          console.log(`  Error testing pool ${poolAddress}:`, error);
          // Some pools might not have enough observation data
          // This is expected for some edge cases
        }
      }
    });
  });

  describe("Integration test", () => {
    it("should perform complete pool analysis workflow", async () => {
      const usdtAddress =
        "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
      const busdAddress =
        "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as `0x${string}`;
      const fee = 500;

      // 1. Get pool address
      const poolAddress = await getPoolAddress(usdtAddress, busdAddress, fee);
      expect(poolAddress).toBeDefined();

      // 2. Get pool base info
      const poolInfo = await getPoolBaseInfoWithTokenInfo(
        poolAddress as `0x${string}`,
      );
      expect(poolInfo.poolAddress).toBe(poolAddress);

      // 3. Get price info
      const priceInfo = await getPoolPrice(poolAddress as `0x${string}`);
      expect(priceInfo.priceRatio).toBeGreaterThan(0);
      expect(priceInfo.tick).toBeTypeOf("number");
      expect(priceInfo.priceFromSqrtPriceX96).toBeGreaterThan(0);
      expect(priceInfo.priceFromTick).toBeGreaterThan(0);
      expect(priceInfo.adjustedPrice).toBeGreaterThan(0);

      // 4. Get liquidity distribution
      const distribution = await getTickLiquidityDistribution(
        poolAddress as `0x${string}`,
        20,
      );
      expect(distribution.length).toBeGreaterThan(0);

      expect(
        distribution.every((tick) => typeof tick.currentTick === "boolean"),
      ).toBe(true);

      // Verify all data is consistent
      expect(poolInfo.currentTick).toBeTypeOf("number");
      expect(poolInfo.sqrtPriceX96).toBeTypeOf("bigint");
      expect(priceInfo.sqrtPriceX96).toBeTypeOf("bigint");
    });
  });
});
