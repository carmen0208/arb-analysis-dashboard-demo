import { getLogger, Logger } from "@dex-ai/core";
import {
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_V3_POOL_ABI,
  ERC20_ABI,
} from "../abis";
import { V3PoolConfig, DEFAULT_CONFIG } from "./config";
import { getTokenInfo, getTokenPriceUSD, type TokenInfo } from "../token";
import { createClient } from "../client";

const logger: Logger = getLogger("blockchain-onchain-pools");

export type TokenPriceInfo = TokenInfo & {
  priceUSD: number;
  tokenBalance: number;
  tokenUSD: number;
};

export interface PoolBaseInfoWithoutTokens {
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  currentTick: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickSpacing: number;
  tokenRatio: number; // token0/token1 ratio
  tokenRatioFromTick: number; // ratio calculated from tick
  tokenRatioFromSqrtPrice: number; // ratio calculated from sqrtPriceX96
}

export interface PoolBaseInfo {
  poolAddress: string;
  token0: TokenPriceInfo;
  token1: TokenPriceInfo;
  currentTick: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickSpacing: number;
  token0Total: number;
  token1Total: number;
  token0TotalUSD: number;
  token1TotalUSD: number;
  totalUSD: number;
  tokenRatio: {
    token0Percent: number;
    token1Percent: number;
  };
  // Raw token ratios (token0/token1)
  rawTokenRatio: number;
  rawTokenRatioFromTick: number;
  rawTokenRatioFromSqrtPrice: number;
  // Adjusted token ratios considering decimals
  adjustedTokenRatio: number;
}

export interface PoolPriceInfo {
  token0Price: number;
  token1Price: number;
  priceRatio: number;
  sqrtPriceX96: bigint;
  tick: number;
  priceFromSqrtPriceX96: number;
  priceFromTick: number;
  priceDifference: number;
  priceDifferencePercent: number;
  adjustedPrice: number;
}

/**
 * 1. Given token0, token1, fee, get pool address
 */
export async function getPoolAddress(
  token0Address: `0x${string}`,
  token1Address: `0x${string}`,
  fee: number,
  config?: V3PoolConfig,
): Promise<string> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);

  try {
    // Ensure token addresses are sorted lexicographically
    const [tokenA, tokenB] = [token0Address, token1Address].sort();

    const poolAddress = await client.readContract({
      address: finalConfig.factoryAddress as `0x${string}`,
      abi: UNISWAP_V3_FACTORY_ABI,
      functionName: "getPool",
      args: [tokenA, tokenB, fee],
    });

    logger.info("[V3PoolAnalyzer] Got pool address", {
      token0: token0Address,
      token1: token1Address,
      fee,
      poolAddress: poolAddress as string,
    });

    return poolAddress as string;
  } catch (error) {
    logger.error("[V3PoolAnalyzer] Error getting pool address", {
      token0: token0Address,
      token1: token1Address,
      fee,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 2. Get pool base info
 */
export async function getPoolBaseInfo(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig,
): Promise<PoolBaseInfoWithoutTokens> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);

  try {
    // Get pool basic information using multicall
    const poolData = await client.multicall({
      contracts: [
        {
          address: poolAddress,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "slot0",
        },
        {
          address: poolAddress,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "liquidity",
        },
        {
          address: poolAddress,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "tickSpacing",
        },
        {
          address: poolAddress,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "token0",
        },
        {
          address: poolAddress,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "token1",
        },
      ],
      allowFailure: false,
      batchSize: 4096,
    });

    const [slot0, liquidity, tickSpacing, token0Address, token1Address] =
      poolData;

    const slot0Data = slot0 as readonly [
      bigint,
      number,
      number,
      number,
      number,
      number,
      boolean,
    ];
    const currentTick = Number(slot0Data[1]);
    const sqrtPriceX96 = BigInt(slot0Data[0]);
    const tickSpacingNum = Number(tickSpacing);

    // Calculate token ratios using the abstracted function
    const tokenRatios = calculateTokenRatios({
      currentTick,
      sqrtPriceX96,
    });

    const result: PoolBaseInfoWithoutTokens = {
      poolAddress,
      token0Address: token0Address as string,
      token1Address: token1Address as string,
      currentTick,
      sqrtPriceX96,
      liquidity: BigInt(liquidity),
      tickSpacing: tickSpacingNum,
      tokenRatio: tokenRatios.tokenRatio,
      tokenRatioFromTick: tokenRatios.tokenRatioFromTick,
      tokenRatioFromSqrtPrice: tokenRatios.tokenRatioFromSqrtPrice,
    };

    logger.info("[V3PoolAnalyzer] Got pool base info without tokens", {
      poolAddress,
      token0Address: token0Address as string,
      token1Address: token1Address as string,
      currentTick,
    });

    return result;
  } catch (error) {
    logger.error("[V3PoolAnalyzer] Error getting pool base info", {
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 3. Get pool base info with token information
 */
export async function getPoolBaseInfoWithTokenInfo(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig,
): Promise<PoolBaseInfo> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);

  try {
    // Get pool base info first
    const poolBaseInfo = await getPoolBaseInfo(poolAddress, finalConfig);

    // Get token information
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(poolBaseInfo.token0Address as `0x${string}`, finalConfig),
      getTokenInfo(poolBaseInfo.token1Address as `0x${string}`, finalConfig),
    ]);

    // Get token balances in the pool using multicall
    const balanceData = await client.multicall({
      contracts: [
        {
          address: poolBaseInfo.token0Address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [poolAddress],
        },
        {
          address: poolBaseInfo.token1Address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [poolAddress],
        },
      ],
      allowFailure: false,
      batchSize: 4096,
    });

    const [token0Balance, token1Balance] = balanceData;

    // Convert balances to correct decimal places
    const token0Total =
      Number(token0Balance) / Math.pow(10, token0Info.decimals);
    const token1Total =
      Number(token1Balance) / Math.pow(10, token1Info.decimals);

    // Calculate USD value (using simplified prices here, in real applications can be obtained from CoinGecko, etc.)
    const token0PriceUSD = await getTokenPriceUSD(
      finalConfig.chainId,
      poolBaseInfo.token0Address as `0x${string}`,
      token0Info.symbol,
    );
    const token1PriceUSD = await getTokenPriceUSD(
      finalConfig.chainId,
      poolBaseInfo.token1Address as `0x${string}`,
      token1Info.symbol,
    );

    const token0TotalUSD = token0Total * token0PriceUSD;
    const token1TotalUSD = token1Total * token1PriceUSD;
    const totalUSD = token0TotalUSD + token1TotalUSD;

    // Calculate ratios
    const token0Percent = totalUSD > 0 ? (token0TotalUSD / totalUSD) * 100 : 0;
    const token1Percent = totalUSD > 0 ? (token1TotalUSD / totalUSD) * 100 : 0;

    // Calculate token ratios with decimal adjustment using the abstracted function
    const tokenRatios = calculateTokenRatios({
      currentTick: poolBaseInfo.currentTick,
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96,
      token0Decimals: token0Info.decimals,
      token1Decimals: token1Info.decimals,
    });

    const result: PoolBaseInfo = {
      poolAddress: poolBaseInfo.poolAddress,
      token0: {
        ...token0Info,
        priceUSD: token0PriceUSD,
        tokenBalance: token0Total,
        tokenUSD: token0TotalUSD,
      },
      token1: {
        ...token1Info,
        priceUSD: token1PriceUSD,
        tokenBalance: token1Total,
        tokenUSD: token1TotalUSD,
      },
      currentTick: poolBaseInfo.currentTick,
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96,
      liquidity: poolBaseInfo.liquidity,
      tickSpacing: poolBaseInfo.tickSpacing,
      token0Total,
      token1Total,
      token0TotalUSD,
      token1TotalUSD,
      totalUSD,
      tokenRatio: {
        token0Percent,
        token1Percent,
      },
      // Raw token ratios (token0/token1)
      rawTokenRatio: tokenRatios.tokenRatio,
      rawTokenRatioFromTick: tokenRatios.tokenRatioFromTick,
      rawTokenRatioFromSqrtPrice: tokenRatios.tokenRatioFromSqrtPrice,
      // Adjusted token ratios considering decimals
      adjustedTokenRatio: tokenRatios.adjustedTokenRatio,
    };

    logger.info("[V3PoolAnalyzer] Got pool base info with tokens", {
      poolAddress,
      token0Symbol: token0Info.symbol,
      token1Symbol: token1Info.symbol,
      currentTick: poolBaseInfo.currentTick,
      totalUSD: result.totalUSD.toFixed(2),
    });

    return result;
  } catch (error) {
    logger.error("[V3PoolAnalyzer] Error getting pool base info with tokens", {
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 4. Calculate pool price from sqrtPriceX96
 */
export async function getPoolPrice(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig,
  token0Decimals: number = 18,
  token1Decimals: number = 18,
): Promise<PoolPriceInfo> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);

  try {
    const slot0 = await client.readContract({
      address: poolAddress,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "slot0",
    });

    const slot0Data = slot0 as readonly [
      bigint,
      number,
      number,
      number,
      number,
      number,
      boolean,
    ];

    const sqrtPriceX96 = BigInt(slot0Data[0]);
    const tick = Number(slot0Data[1]);

    // Calculate price using both methods for comparison
    const priceFromSqrtPriceX96 = calculatePriceFromSqrtPriceX96(sqrtPriceX96);
    const priceFromTick = calculatePriceFromTick(tick);

    // Calculate difference for precision analysis
    const priceDifference = Math.abs(priceFromSqrtPriceX96 - priceFromTick);
    const priceDifferencePercent =
      (priceDifference / priceFromSqrtPriceX96) * 100;

    // Use sqrtPriceX96 method for higher precision (as recommended)
    const priceRatio = priceFromSqrtPriceX96;

    // Adjust price for decimals
    const adjustedPrice = adjustPriceForDecimals(
      priceRatio,
      token0Decimals,
      token1Decimals,
    );

    const result: PoolPriceInfo = {
      token0Price: 1 / adjustedPrice,
      token1Price: adjustedPrice,
      priceRatio: adjustedPrice,
      sqrtPriceX96,
      tick,
      priceFromSqrtPriceX96,
      priceFromTick,
      priceDifference,
      priceDifferencePercent,
      adjustedPrice,
    };

    logger.info(
      "[V3PoolAnalyzer] Calculated pool price with enhanced precision",
      {
        poolAddress,
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick,
        priceFromSqrtPriceX96: priceFromSqrtPriceX96.toFixed(8),
        priceFromTick: priceFromTick.toFixed(8),
        priceDifference: priceDifference.toFixed(8),
        priceDifferencePercent: priceDifferencePercent.toFixed(4),
        adjustedPrice: adjustedPrice.toFixed(8),
        token0Decimals,
        token1Decimals,
      },
    );

    return result;
  } catch (error) {
    logger.error("[V3PoolAnalyzer] Error calculating pool price", {
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Calculate token ratios using different methods for comparison and precision analysis
 *
 * This function provides three different approaches to calculate the token0/token1 ratio:
 * 1. From tick: Uses the standard Uniswap V3 tick-to-price formula
 * 2. From sqrtPriceX96: Uses the more precise sqrtPriceX96 calculation
 * 3. Adjusted: Considers token decimals for real-world price representation
 *
 * @param currentTick - Current pool tick from slot0
 * @param sqrtPriceX96 - Current sqrt price in X96 format from slot0
 * @param token0Decimals - Number of decimals for token0 (default: 18)
 * @param token1Decimals - Number of decimals for token1 (default: 18)
 * @returns Object containing different token ratio calculations
 *
 * @example
 * ```typescript
 * // Basic usage
 * const ratios = calculateTokenRatios({
 *   currentTick: 276325,
 *   sqrtPriceX96: 177184290212345678901234567890n,
 * });
 * console.log('Token Ratio:', ratios.tokenRatio);
 *
 * // With decimal adjustment
 * const ratiosWithDecimals = calculateTokenRatios({
 *   currentTick: 276325,
 *   sqrtPriceX96: 177184290212345678901234567890n,
 *   token0Decimals: 18, // USDC
 *   token1Decimals: 6,  // USDT
 * });
 * console.log('Adjusted Ratio:', ratiosWithDecimals.adjustedTokenRatio);
 *
 * // Compare precision
 * console.log('Precision Difference:', ratios.precisionDifferencePercent + '%');
 * ```
 *
 * @description
 * ## Calculation Methods
 *
 * ### 1. Tick-based Calculation
 * Uses the standard Uniswap V3 formula: `price = 1.0001^tick`
 * - Pros: Simple and widely used
 * - Cons: May have precision limitations for extreme tick values
 *
 * ### 2. SqrtPriceX96-based Calculation
 * Uses the exact sqrt price from the pool: `price = (sqrtPriceX96 / 2^96)^2`
 * - Pros: Highest precision, uses exact pool state
 * - Cons: More complex calculation
 *
 * ### 3. Decimal-adjusted Calculation
 * Accounts for different token decimal places for real-world price representation
 * - Formula: `adjustedPrice = rawPrice * 10^(token0Decimals - token1Decimals)`
 * - Example: USDC (6 decimals) vs USDT (6 decimals) = no adjustment
 * - Example: WETH (18 decimals) vs USDC (6 decimals) = multiply by 10^12
 *
 * ## Return Values
 *
 * - `tokenRatio`: Recommended ratio using sqrtPriceX96 method
 * - `tokenRatioFromTick`: Ratio calculated from tick
 * - `tokenRatioFromSqrtPrice`: Ratio calculated from sqrtPriceX96
 * - `adjustedTokenRatio`: Decimal-adjusted ratio for real-world use
 * - `precisionDifference`: Absolute difference between tick and sqrtPrice methods
 * - `precisionDifferencePercent`: Percentage difference for precision analysis
 *
 * ## Use Cases
 *
 * - **High-frequency trading**: Use `tokenRatio` (sqrtPriceX96 method)
 * - **Price feeds**: Use `adjustedTokenRatio` for real-world representation
 * - **Precision analysis**: Compare `precisionDifferencePercent`
 * - **Backward compatibility**: Use `tokenRatioFromTick` for existing systems
 */
export function calculateTokenRatios({
  currentTick,
  sqrtPriceX96,
  token0Decimals = 18,
  token1Decimals = 18,
}: {
  currentTick: number;
  sqrtPriceX96: bigint;
  token0Decimals?: number;
  token1Decimals?: number;
}) {
  // Method 1: Calculate ratio from tick using Uniswap V3 formula
  // Formula: price = 1.0001^tick
  // This is the standard method but may have precision limitations
  const tokenRatioFromTick = Math.pow(1.0001, currentTick);

  // Method 2: Calculate ratio from sqrtPriceX96 for higher precision
  // Formula: price = (sqrtPriceX96 / 2^96)^2
  // This method provides better precision as it uses the exact sqrt price from the pool
  const Q96 = 2n ** 96n;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const tokenRatioFromSqrtPrice = sqrtPrice * sqrtPrice;

  // Method 3: Calculate decimal-adjusted ratio for real-world representation
  // This accounts for the different decimal places of tokens
  // Example: If token0 has 18 decimals and token1 has 6 decimals,
  // we need to adjust by 10^(18-6) = 10^12
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  const adjustedTokenRatio = tokenRatioFromSqrtPrice * decimalAdjustment;

  // Recommended method: Use sqrtPriceX96 for highest precision
  const recommendedTokenRatio = tokenRatioFromSqrtPrice;

  return {
    // Raw token ratios (token0/token1) without decimal adjustment
    tokenRatio: recommendedTokenRatio, // Recommended: highest precision
    tokenRatioFromTick, // Standard method: may have precision limitations
    tokenRatioFromSqrtPrice, // High precision: uses exact sqrt price

    // Decimal-adjusted ratio for real-world price representation
    adjustedTokenRatio,

    // Additional information for debugging and comparison
    decimalAdjustment,
    sqrtPrice,
    currentTick,
    sqrtPriceX96: sqrtPriceX96.toString(),

    // Precision comparison
    precisionDifference: Math.abs(tokenRatioFromSqrtPrice - tokenRatioFromTick),
    precisionDifferencePercent:
      (Math.abs(tokenRatioFromSqrtPrice - tokenRatioFromTick) /
        tokenRatioFromSqrtPrice) *
      100,
  };
}

/**
 * Example function demonstrating how to use calculateTokenRatios
 * This function shows different ways to calculate and compare token ratios
 *
 * @param poolAddress - The pool address to analyze
 * @param config - Optional pool configuration
 * @returns Detailed token ratio analysis
 */
export async function analyzeTokenRatios(
  poolAddress: `0x${string}`,
  config?: V3PoolConfig,
) {
  try {
    // Get pool base info
    const poolBaseInfo = await getPoolBaseInfo(poolAddress, config);

    // Calculate token ratios using the abstracted function
    const ratios = calculateTokenRatios({
      currentTick: poolBaseInfo.currentTick,
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96,
    });

    // Get detailed token info for decimal adjustment
    const poolWithTokens = await getPoolBaseInfoWithTokenInfo(
      poolAddress,
      config,
    );

    const ratiosWithDecimals = calculateTokenRatios({
      currentTick: poolBaseInfo.currentTick,
      sqrtPriceX96: poolBaseInfo.sqrtPriceX96,
      token0Decimals: poolWithTokens.token0.decimals,
      token1Decimals: poolWithTokens.token1.decimals,
    });

    return {
      poolInfo: {
        address: poolAddress,
        token0: poolWithTokens.token0.symbol,
        token1: poolWithTokens.token1.symbol,
        currentTick: poolBaseInfo.currentTick,
        liquidity: poolBaseInfo.liquidity.toString(),
      },
      rawRatios: {
        recommended: ratios.tokenRatio,
        fromTick: ratios.tokenRatioFromTick,
        fromSqrtPrice: ratios.tokenRatioFromSqrtPrice,
        precisionDifference: ratios.precisionDifference,
        precisionDifferencePercent: ratios.precisionDifferencePercent,
      },
      adjustedRatios: {
        adjusted: ratiosWithDecimals.adjustedTokenRatio,
        decimalAdjustment: ratiosWithDecimals.decimalAdjustment,
        token0Decimals: poolWithTokens.token0.decimals,
        token1Decimals: poolWithTokens.token1.decimals,
      },
      interpretation: {
        // What the ratios mean
        token0PerToken1: ratios.tokenRatio,
        token1PerToken0: 1 / ratios.tokenRatio,
        adjustedToken0PerToken1: ratiosWithDecimals.adjustedTokenRatio,
        adjustedToken1PerToken0: 1 / ratiosWithDecimals.adjustedTokenRatio,
      },
    };
  } catch (error) {
    logger.error("[TokenRatioAnalyzer] Error analyzing token ratios", {
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Calculate price from sqrtPriceX96 with higher precision
 * @param sqrtPriceX96 - The sqrtPriceX96 value from pool
 * @returns The calculated price
 */
function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const Q96 = BigInt(2) ** BigInt(96);

  // price = (sqrtPriceX96 / 2^96)^2
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

/**
 * Calculate price from tick
 * @param tick - The tick value from pool
 * @returns The calculated price
 */
function calculatePriceFromTick(tick: number): number {
  // price = 1.0001^tick
  return Math.exp(tick * Math.log(1.0001));
}

/**
 * Adjust price for token decimals
 * @param price - Raw price from calculation
 * @param token0Decimals - Decimals of token0
 * @param token1Decimals - Decimals of token1
 * @returns Adjusted price
 */
function adjustPriceForDecimals(
  price: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  return price * decimalAdjustment;
}
