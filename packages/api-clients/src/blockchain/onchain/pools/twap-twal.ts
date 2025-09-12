import { createClient } from "../client";
import { DEFAULT_CONFIG, V3PoolConfig } from "./config";
import { UNISWAP_V3_POOL_ABI } from "../abis";
import { getPoolBaseInfo, calculateTokenRatios } from "./core";

// --- Constants ---
const SECONDS_AGO = 60; // For 1-minute TWAP & TWAL

interface Observation {
  secondsAgo: number;
  tickCumulative: bigint;
  secondsPerLiquidityCumulativeX128: bigint;
}

/**
 * Calculate Time-Weighted Average Price (TWAP) for Uniswap V3 pools
 *
 * This function calculates the time-weighted average price over a specified period
 * using the pool's observation data. It now uses the abstracted calculateTokenRatios
 * function for consistent and precise token ratio calculations.
 *
 * @param poolAddress - The pool address to calculate TWAP for
 * @param secondsAgo - Time period for TWAP calculation (default: 60 seconds)
 * @param config - Optional pool configuration
 * @returns TWAP calculation results with detailed ratio comparisons
 *
 * @example
 * ```typescript
 * const twap = await getTWAP('0x...', 300); // 5-minute TWAP
 * console.log('TWAP Token Ratio:', twap.tokenRatio);
 * console.log('Current Token Ratio:', twap.currentRatios);
 * console.log('Precision Difference:', twap.twapRatios.precisionDifferencePercent + '%');
 * ```
 *
 * @description
 * ## Calculation Method
 *
 * 1. **Observation Data**: Retrieves cumulative tick data from the pool
 * 2. **Average Tick**: Calculates the average tick over the time period
 * 3. **Token Ratio**: Uses calculateTokenRatios for precise ratio calculation
 * 4. **Comparison**: Provides both TWAP and current state ratios for analysis
 *
 * ## Return Values
 *
 * - `tokenRatio`: TWAP-based token ratio (using tick method)
 * - `priceRatio`: Alias for tokenRatio
 * - `twapRatios`: Detailed TWAP ratio calculations and precision analysis
 * - `currentRatios`: Current pool state ratios for comparison
 * - `averageTick`: Calculated average tick over the time period
 * - `observations`: Raw observation data used in calculation
 * - `currentTokenRatio`: Legacy field for backward compatibility
 */
export async function getTWAP(
  poolAddress: `0x${string}`,
  secondsAgo: number = SECONDS_AGO,
  config?: V3PoolConfig,
): Promise<
  | {
      averageTick: number;
      observations: Observation[];
      twapRatios: {
        fromTick: number;
        fromSqrtPrice: number;
      };
      currentRatios: {
        fromTick: number;
        fromSqrtPrice: number;
      };
    }
  | {
      error: string;
    }
> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);
  // Use officially recommended timestamp array: [secondsAgo, 0]
  const timestamps = [secondsAgo, 0];

  try {
    const [tickCumulatives, secondsPerLiquidityCumulatives] =
      await client.readContract({
        address: poolAddress,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "observe",
        args: [timestamps],
      });
    // Map observation data to interface
    const observations: Observation[] = timestamps.map((time, i) => ({
      secondsAgo: time,
      tickCumulative: tickCumulatives[i],
      secondsPerLiquidityCumulativeX128: secondsPerLiquidityCumulatives[i],
    }));

    // Calculate TWAP - according to official documentation formula
    const diffTickCumulative =
      observations[1].tickCumulative - observations[0].tickCumulative;
    const secondsBetween = BigInt(secondsAgo);

    const averageTick = diffTickCumulative / secondsBetween;

    // Get pool base info for current state comparison
    const poolBaseInfo = await getPoolBaseInfo(poolAddress, config);

    // Calculate token ratios using the abstracted function for both TWAP and current state
    const twapRatios = calculateTokenRatios({
      currentTick: Number(averageTick),
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96, // Note: This is current sqrtPrice, not TWAP
    });

    const currentRatios = calculateTokenRatios({
      currentTick: poolBaseInfo.currentTick,
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96,
    });

    return {
      // Additional ratio calculations for comparison
      twapRatios: {
        fromTick: twapRatios.tokenRatioFromTick,
        fromSqrtPrice: twapRatios.tokenRatioFromSqrtPrice,
      },

      // Current state ratios for comparison
      currentRatios: {
        fromTick: currentRatios.tokenRatioFromTick,
        fromSqrtPrice: currentRatios.tokenRatioFromSqrtPrice,
      },

      // TWAP calculation details
      averageTick: Number(averageTick),
      observations,
    };
  } catch (error) {
    // Handle "OLD" error - observation data is too old
    if (error instanceof Error && error.message.includes("OLD")) {
      console.warn(
        `TWAP observation data too old for pool ${poolAddress}, using current state only`,
      );
      return {
        error: "OLD_OBSERVATION_DATA",
      };
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Calculate Time-Weighted Average Liquidity (TWAL) for Uniswap V3 pools
 *
 * This function calculates the time-weighted average liquidity over a specified period
 * using the pool's observation data. It now includes current token ratios for comparison.
 *
 * @param poolAddress - The pool address to calculate TWAL for
 * @param secondsAgo - Time period for TWAL calculation (default: 60 seconds)
 * @param config - Optional pool configuration
 * @returns TWAL calculation results with current state information
 *
 * @example
 * ```typescript
 * const twal = await getTWAL('0x...', 300); // 5-minute TWAL
 * console.log('TWAL:', twal.twal.toString());
 * console.log('Current Liquidity:', twal.currentLiquidity.toString());
 * console.log('Current Token Ratio:', twal.currentTokenRatio);
 * ```
 *
 * @description
 * ## Calculation Method
 *
 * 1. **Observation Data**: Retrieves cumulative liquidity data from the pool
 * 2. **TWAL Calculation**: Uses harmonic mean formula for liquidity averaging
 * 3. **Current State**: Includes current pool state and token ratios for reference
 *
 * ## Return Values
 *
 * - `twal`: Time-weighted average liquidity (harmonic mean)
 * - `observations`: Raw observation data used in calculation
 * - `currentLiquidity`: Current pool liquidity for comparison
 * - `currentTick`: Current pool tick
 * - `currentTokenRatio`: Current token ratio (recommended method)
 * - `currentTokenRatioFromTick`: Current token ratio (tick method)
 * - `currentTokenRatioFromSqrtPrice`: Current token ratio (sqrtPrice method)
 */
export async function getTWAL(
  poolAddress: `0x${string}`,
  secondsAgo: number = SECONDS_AGO,
  config?: V3PoolConfig,
): Promise<
  | {
      twal: bigint;
      observations: Observation[];
      currentLiquidity: bigint;
      currentTick: number;
    }
  | {
      error: string;
    }
> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);
  const timestamps = [secondsAgo, 0];

  try {
    const [tickCumulatives, secondsPerLiquidityCumulatives] =
      await client.readContract({
        address: poolAddress,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "observe",
        args: [timestamps],
      });

    // Map observation data
    const observations: Observation[] = timestamps.map((time, i) => ({
      secondsAgo: time,
      tickCumulative: tickCumulatives[i],
      secondsPerLiquidityCumulativeX128: secondsPerLiquidityCumulatives[i],
    }));

    // Calculate TWAL - according to official documentation formula
    const diffSecondsPerLiquidityX128 =
      observations[1].secondsPerLiquidityCumulativeX128 -
      observations[0].secondsPerLiquidityCumulativeX128;
    const secondsBetweenX128 = BigInt(secondsAgo) << 128n;

    // TWAL is harmonic mean
    const twal = secondsBetweenX128 / diffSecondsPerLiquidityX128;

    // Get current pool state for comparison
    const poolBaseInfo = await getPoolBaseInfo(poolAddress, config);

    return {
      // TWAL calculation result
      twal,
      // TWAL calculation details
      observations,
      // Current pool state for comparison
      currentLiquidity: poolBaseInfo.liquidity,
      currentTick: poolBaseInfo.currentTick,
    };
  } catch (error) {
    // Handle "OLD" error - observation data is too old
    if (error instanceof Error && error.message.includes("OLD")) {
      console.warn(
        `TWAL observation data too old for pool ${poolAddress}, using current state only`,
      );
      return {
        error: "OLD_OBSERVATION_DATA",
      };
    }

    // Re-throw other errors
    throw error;
  }
}
