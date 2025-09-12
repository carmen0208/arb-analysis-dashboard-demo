import { createClient } from "../client";
import { V3PoolConfig, DEFAULT_CONFIG } from "./config";
import { TickMath } from "@uniswap/v3-sdk";
import { UNISWAP_V3_POOL_ABI } from "../abis";
import { type TokenInfo } from "../token";
import { getLogger, Logger } from "@dex-ai/core";
import { getPoolBaseInfoWithTokenInfo } from "./core";

const logger: Logger = getLogger("blockchain-onchain-pools");

// Q96 constant
const Q96 = 2n ** 96n;

/**
 * TickBitmap helper functions
 *
 * Uniswap V3 uses TickBitmap to efficiently store and find initialized ticks
 * Each tick is compressed into a bitmap index for fast positioning
 */

/**
 * Compress tick to bitmap index
 *
 * Mathematical principles:
 * - tick is the logarithmic representation of price: price = 1.0001^tick
 * - Due to tickSpacing, not every tick can be used
 * - Compression formula: compressed = floor(tick / tickSpacing)
 * - For negative ticks, special handling is needed to match V3 behavior
 *
 * @param tick - Original tick value
 * @param spacing - Tick spacing
 * @returns Compressed index
 */
function compressTick(tick: number, spacing: number): number {
  // For negative ticks, if dividing by spacing has remainder, need to round down
  // This ensures consistency with V3 contract behavior
  let c = Math.floor(tick / spacing);
  if (tick < 0 && tick % spacing !== 0) c -= 1;
  return c;
}

/**
 * Calculate position in bitmap from compressed index
 *
 * Bitmap structure:
 * - Each word contains 256 bits (8 bits = 1 byte)
 * - Word index: compressed >> 8 (right shift 8 bits, equivalent to dividing by 256)
 * - Bit index: compressed & 0xff (AND operation, take last 8 bits)
 *
 * @param compressed - Compressed tick index
 * @returns { word: number; bit: number } Position in bitmap
 */
function position(compressed: number): { word: number; bit: number } {
  const word = compressed >> 8; // Calculate word index (0-255)
  const bit = compressed & 0xff; // Calculate bit index (0-255)
  return { word, bit };
}

/**
 * Get all bits set to 1 from bitmap word
 *
 * Bit operation principles:
 * - Iterate through 256 bits (0-255)
 * - Use bitwise AND to check each bit: bitmap & (1 << i)
 * - If result is not 0, the bit is 1
 *
 * @param bitmap - 256-bit bitmap
 * @returns Array of bit positions set to 1 (0-255)
 */
function getSetBits(bitmap: bigint): number[] {
  const setBits: number[] = [];
  for (let i = 0; i < 256; i++) {
    // Check if the i-th bit is 1
    const mask = 1n << BigInt(i);
    if ((bitmap & mask) !== 0n) {
      setBits.push(i);
    }
  }
  return setBits;
}

export interface LiquidityInfo {
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
  availableLiquidity: bigint; // Available liquidity for this tick (currentLiquidity for current tick, liquidityNet for others)
  token0AmountAdjusted: number; // token0 amount adjusted for decimals
  token1AmountAdjusted: number; // token1 amount adjusted for decimals
  token0TotalUSDAdjusted: number; // token0 USD value adjusted for decimals
  token1TotalUSDAdjusted: number; // token1 USD value adjusted for decimals
  totalUSDAdjusted: number; // total USD value
  initialized: boolean;
  currentTick: boolean; // indicates if this is the current tick
}

export interface TickData {
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
  tickCumulativeOutside: bigint;
  secondsPerLiquidityOutsideX128: bigint;
  secondsOutside: number;
  initialized: boolean;
}

export interface SwapAmountInfo {
  token0AmountAdjusted: number; // token0 amount adjusted for decimals
  token1AmountAdjusted: number; // token1 amount adjusted for decimals
  token0TotalUSDAdjusted?: number; // token0 USD value adjusted for decimals
  token1TotalUSDAdjusted?: number; // token1 USD value adjusted for decimals
  nextTick: number;
  nextRatio: number;
  ratioImpact: number;
  sqrtRatioNext: string;
  direction: "ratio_up";
}

export interface SwapAmountInfoDown {
  token0AmountAdjusted: number; // token0 amount adjusted for decimals
  token1AmountAdjusted: number; // token1 amount adjusted for decimals
  token0TotalUSDAdjusted?: number; // token0 USD value adjusted for decimals
  token1TotalUSDAdjusted?: number; // token1 USD value adjusted for decimals
  prevTick: number;
  prevRatio: number;
  ratioImpact: number;
  sqrtRatioPrev: string;
  direction: "ratio_down";
}

export interface CurrentTickInfo {
  currentTick: number;
  currentRatio: number;
  sqrtRatioCurrent: number;
  liquidityDistribution: "token0" | "token1";
  ratioImpact: number;
}

export interface TickSwapCapacity {
  up: SwapAmountInfo;
  down: SwapAmountInfoDown;
  current: CurrentTickInfo;
}

/**
 * Calculate token amounts for a given tick
 *
 * In Uniswap V3:
 * - For current tick: available liquidity is the current active liquidity
 * - For other ticks: available liquidity should be calculated by accumulating liquidityNet
 *   from the current tick to the target tick
 */
function calculateTokenAmounts(
  tick: number,
  liquidityNet: bigint,
  currentTick: number,
  token0Info: TokenInfo,
  token1Info: TokenInfo,
  availableLiquidity: bigint, // Pass the calculated available liquidity
): {
  token0AmountAdjusted: number;
  token1AmountAdjusted: number;
  token0TotalUSDAdjusted: number;
  token1TotalUSDAdjusted: number;
  totalUSDAdjusted: number;
  availableLiquidity: bigint;
} {
  if (availableLiquidity === 0n) {
    return {
      token0AmountAdjusted: 0,
      token1AmountAdjusted: 0,
      token0TotalUSDAdjusted: 0,
      token1TotalUSDAdjusted: 0,
      totalUSDAdjusted: 0,
      availableLiquidity: 0n,
    };
  }

  // ✅ Safe bigint handling to avoid precision loss
  // Use TickMath for sqrt ratio calculations
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
  const sqrtRatioCurrentX96 = TickMath.getSqrtRatioAtTick(currentTick);

  let token0Amount = 0;
  let token1Amount = 0;

  // Calculate token amounts based on tick position relative to current price
  if (tick < currentTick) {
    // tick below current price, mainly token1
    // Use string conversion for safe bigint arithmetic
    const sqrtDiff =
      Number(sqrtRatioCurrentX96.toString()) - Number(sqrtRatioX96.toString());
    token1Amount = (Number(availableLiquidity) * sqrtDiff) / Number(Q96);
  } else if (tick > currentTick) {
    // tick above current price, mainly token0
    const sqrtDiff =
      Number(sqrtRatioX96.toString()) - Number(sqrtRatioCurrentX96.toString());
    token0Amount = (Number(availableLiquidity) * sqrtDiff) / Number(Q96);
  } else {
    // tick equals current price, need to calculate based on liquidity distribution
    const sqrtCurrent = Number(sqrtRatioCurrentX96.toString());
    token0Amount = Number(availableLiquidity) / sqrtCurrent;
    token1Amount = (Number(availableLiquidity) * sqrtCurrent) / Number(Q96);
  }

  // Adjust for token decimals
  const token0AmountAdjusted =
    Math.abs(token0Amount) / Math.pow(10, token0Info.decimals);
  const token1AmountAdjusted =
    Math.abs(token1Amount) / Math.pow(10, token1Info.decimals);

  // Calculate USD values
  const token0TotalUSDAdjusted =
    token0AmountAdjusted * (token0Info.priceUSD || 0.1);
  const token1TotalUSDAdjusted =
    token1AmountAdjusted * (token1Info.priceUSD || 0.1);
  const totalUSDAdjusted = token0TotalUSDAdjusted + token1TotalUSDAdjusted;

  return {
    token0AmountAdjusted,
    token1AmountAdjusted,
    token0TotalUSDAdjusted,
    token1TotalUSDAdjusted,
    totalUSDAdjusted,
    availableLiquidity,
  };
}

/**
 * Read tickBitmap words and extract initialized ticks
 */
async function readBitmapWords(
  client: ReturnType<typeof createClient>,
  poolAddress: `0x${string}`,
  currentWord: number,
  wordRange: number,
  tickSpacingNum: number,
): Promise<number[]> {
  // Collect all words to read around the current word
  const wordsToRead: number[] = [];
  for (let i = -wordRange; i <= wordRange; i++) {
    wordsToRead.push(currentWord + i);
  }

  // Read all bitmap words using multicall
  const bitmapContracts = wordsToRead.map((word) => ({
    address: poolAddress,
    abi: UNISWAP_V3_POOL_ABI,
    functionName: "tickBitmap" as const,
    args: [word],
  }));

  logger.info("[V3PoolAnalyzer] Reading bitmap words", {
    poolAddress,
    wordsToRead: wordsToRead.length,
    wordRange: [-wordRange, wordRange],
    contracts: bitmapContracts.length,
  });

  const bitmapResults = await client.multicall({
    contracts: bitmapContracts,
    allowFailure: true,
    batchSize: 4096,
  });

  // Extract all initialized ticks from bitmap words
  const allTicks: number[] = [];
  let nonZeroBitmaps = 0;

  for (let i = 0; i < bitmapResults.length; i++) {
    const result = bitmapResults[i];
    if (result.status === "success" && result.result !== undefined) {
      const bitmap = BigInt(result.result as string | number | bigint);
      if (bitmap !== 0n) {
        nonZeroBitmaps++;
        // Get all set bits from this bitmap word
        const setBits = getSetBits(bitmap);
        for (const bit of setBits) {
          // Reconstruct tick from word and bit position
          const compressed = (wordsToRead[i] << 8) + bit;
          const tick = compressed * tickSpacingNum;
          allTicks.push(tick);
        }
        logger.debug("[V3PoolAnalyzer] Found non-zero bitmap", {
          word: wordsToRead[i],
          bitmap: bitmap.toString(),
          setBits: setBits.length,
          ticks: setBits.map((bit) => {
            const compressed = (wordsToRead[i] << 8) + bit;
            return compressed * tickSpacingNum;
          }),
        });
      }
    } else {
      logger.warn("[V3PoolAnalyzer] Failed to read bitmap word", {
        word: wordsToRead[i],
        error: result.error?.message || "Unknown error",
      });
    }
  }

  logger.info("[V3PoolAnalyzer] Bitmap analysis results", {
    poolAddress,
    totalWords: wordsToRead.length,
    nonZeroBitmaps,
    totalTicksFound: allTicks.length,
  });

  return allTicks;
}

/**
 * Calculate active liquidity for all ticks by accumulating liquidityNet
 *
 * This function implements the correct Uniswap V3 active liquidity calculation:
 * - Start with currentLiquidity at the current tick
 * - For subsequent ticks: add liquidityNet
 * - For previous ticks: subtract liquidityNet
 */
function calculateActiveLiquidityForTicks(
  ticks: { tick: number; liquidityNet: bigint }[],
  currentTick: number,
  currentLiquidity: bigint,
): Map<number, bigint> {
  const activeLiquidityMap = new Map<number, bigint>();

  // Sort ticks by tick value
  const sortedTicks = [...ticks].sort((a, b) => a.tick - b.tick);

  // Find current tick index
  const currentTickIndex = sortedTicks.findIndex((t) => t.tick === currentTick);

  if (currentTickIndex === -1) {
    // Current tick not in list, use currentLiquidity as base
    activeLiquidityMap.set(currentTick, currentLiquidity);
  } else {
    // Set current tick liquidity
    activeLiquidityMap.set(currentTick, currentLiquidity);

    // Calculate subsequent ticks (upward)
    let runningLiquidity = currentLiquidity;
    for (let i = currentTickIndex + 1; i < sortedTicks.length; i++) {
      const tickData = sortedTicks[i];
      runningLiquidity = runningLiquidity + tickData.liquidityNet;
      activeLiquidityMap.set(tickData.tick, runningLiquidity);
    }

    // Calculate previous ticks (downward)
    runningLiquidity = currentLiquidity;
    for (let i = currentTickIndex - 1; i >= 0; i--) {
      const tickData = sortedTicks[i];
      runningLiquidity = runningLiquidity - tickData.liquidityNet;
      activeLiquidityMap.set(tickData.tick, runningLiquidity);
    }
  }

  return activeLiquidityMap;
}

/**
 * Process tick data and convert to LiquidityInfo format
 */
async function processTickData(
  client: ReturnType<typeof createClient>,
  poolAddress: `0x${string}`,
  uniqueTicks: number[],
  currentTick: number,
  token0Info: TokenInfo,
  token1Info: TokenInfo,
  currentLiquidity: bigint,
): Promise<LiquidityInfo[]> {
  const tickContracts = uniqueTicks.map((tick) => ({
    address: poolAddress,
    abi: UNISWAP_V3_POOL_ABI,
    functionName: "ticks" as const,
    args: [tick],
  }));

  const tickResults = await client.multicall({
    contracts: tickContracts,
    allowFailure: true,
    batchSize: 4096,
  });

  // First pass: collect all tick data
  const tickDataMap = new Map<
    number,
    { liquidityNet: bigint; liquidityGross: bigint; initialized: boolean }
  >();

  for (let i = 0; i < tickResults.length; i++) {
    const result = tickResults[i];
    const tick = uniqueTicks[i];

    if (result.status === "success" && result.result !== undefined) {
      const tickData = result.result as readonly [
        bigint, // liquidityGross
        bigint, // liquidityNet
        bigint, // feeGrowthOutside0X128
        bigint, // feeGrowthOutside1X128
        bigint, // tickCumulativeOutside
        bigint, // secondsPerLiquidityOutsideX128
        number, // secondsOutside
        boolean, // initialized
      ];

      const liquidityNet = BigInt(tickData[1]);
      const liquidityGross = BigInt(tickData[0]);
      const initialized = Boolean(tickData[7]);

      // Always include current tick, or include other ticks with liquidity
      if (
        tick === currentTick ||
        liquidityNet !== 0n ||
        liquidityGross !== 0n
      ) {
        tickDataMap.set(tick, { liquidityNet, liquidityGross, initialized });
      }
    }
  }

  // Calculate active liquidity for all ticks
  const ticksForCalculation = Array.from(tickDataMap.entries()).map(
    ([tick, data]) => ({
      tick,
      liquidityNet: data.liquidityNet,
    }),
  );

  const activeLiquidityMap = calculateActiveLiquidityForTicks(
    ticksForCalculation,
    currentTick,
    currentLiquidity,
  );

  // Second pass: create LiquidityInfo objects
  const liquidityInfos: LiquidityInfo[] = [];

  for (const [tick, tickData] of tickDataMap) {
    const isCurrentTick = tick === currentTick;
    const availableLiquidity = activeLiquidityMap.get(tick) || 0n;

    const {
      token0AmountAdjusted,
      token1AmountAdjusted,
      token0TotalUSDAdjusted,
      token1TotalUSDAdjusted,
      totalUSDAdjusted,
    } = calculateTokenAmounts(
      tick,
      tickData.liquidityNet,
      currentTick,
      token0Info,
      token1Info,
      availableLiquidity,
    );

    liquidityInfos.push({
      tick,
      liquidityNet: tickData.liquidityNet,
      liquidityGross: tickData.liquidityGross,
      availableLiquidity,
      token0AmountAdjusted,
      token1AmountAdjusted,
      token0TotalUSDAdjusted,
      token1TotalUSDAdjusted,
      totalUSDAdjusted,
      initialized: tickData.initialized,
      currentTick: isCurrentTick,
    });
  }

  // Sort by tick
  return liquidityInfos.sort((a, b) => a.tick - b.tick);
}

/**
 * Get tick and liquidity distribution by pool address using tickBitmap
 */
export async function getTickLiquidityDistribution(
  poolAddress: `0x${string}`,
  wordRange: number = 10,
  config?: V3PoolConfig,
): Promise<LiquidityInfo[]> {
  const finalConfig = config || DEFAULT_CONFIG;
  const client = createClient(finalConfig);

  try {
    // Get pool base info with token information using core method
    const poolBaseInfo = await getPoolBaseInfoWithTokenInfo(
      poolAddress,
      finalConfig,
    );
    const {
      currentTick,
      tickSpacing: tickSpacingNum,
      liquidity,
      token0: token0Info,
      token1: token1Info,
    } = poolBaseInfo;

    // Calculate the compressed tick and word position
    const compressed = compressTick(currentTick, tickSpacingNum);
    const { word: currentWord } = position(compressed);

    logger.info(
      "[V3PoolAnalyzer] Getting tick liquidity distribution using tickBitmap",
      {
        poolAddress,
        currentTick,
        tickSpacing: tickSpacingNum,
        compressed,
        currentWord,
        wordRange,
      },
    );

    // Step 1: Read bitmap words and extract ticks
    const allTicks = await readBitmapWords(
      client,
      poolAddress,
      currentWord,
      wordRange,
      tickSpacingNum,
    );

    // Step 2: Prepare unique ticks including current tick
    const uniqueTicks = [...new Set(allTicks)].sort((a, b) => a - b);
    if (!uniqueTicks.includes(currentTick)) {
      uniqueTicks.push(currentTick);
      uniqueTicks.sort((a, b) => a - b);
    }

    logger.info("[V3PoolAnalyzer] Found initialized ticks from tickBitmap", {
      poolAddress,
      totalTicks: uniqueTicks.length,
      wordRange,
      currentTickIncluded: uniqueTicks.includes(currentTick),
    });

    if (uniqueTicks.length === 0) return [];

    // Step 3: Read tick data and process results
    return await processTickData(
      client,
      poolAddress,
      uniqueTicks,
      currentTick,
      token0Info,
      token1Info,
      liquidity,
    );
  } catch (error) {
    logger.error("[V3PoolAnalyzer] Error getting tick liquidity distribution", {
      poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Detects liquidity cliffs based on changes in active liquidity across ticks.
 *
 * @param ticks Sorted array of initialized ticks with liquidityNet
 * @param startingLiquidity Active liquidity at current tick (e.g. from slot0)
 * @param thresholdPct Threshold (e.g. 0.5 = 50%) for what is considered a "cliff"
 * @returns Array of cliffs with tick index and percent delta
 */
export function detectLiquidityCliffs(
  ticks: LiquidityInfo[],
  startingLiquidity: bigint,
  thresholdPct: number = 0.2,
): {
  tick: number;
  previousLiquidity: bigint;
  currentLiquidity: bigint;
  deltaPct: number;
}[] {
  const cliffs: {
    tick: number;
    previousLiquidity: bigint;
    currentLiquidity: bigint;
    deltaPct: number;
  }[] = [];

  // Sort ticks by tick value to ensure proper order
  const sortedTicks = [...ticks].sort((a, b) => a.tick - b.tick);

  // Find current tick (the one with currentTick: true)
  const currentTickData = sortedTicks.find((t) => t.currentTick);
  if (!currentTickData) {
    return cliffs; // No current tick found
  }

  const currentTickValue = currentTickData.tick;

  // Calculate active liquidity for all ticks using the correct Uniswap V3 logic
  const activeLiquidityMap = calculateActiveLiquidityForTicks(
    sortedTicks.map((t) => ({ tick: t.tick, liquidityNet: t.liquidityNet })),
    currentTickValue,
    startingLiquidity,
  );

  // Process ticks in order to detect cliffs
  for (let i = 0; i < sortedTicks.length; i++) {
    const tick = sortedTicks[i];
    const currentLiquidity = activeLiquidityMap.get(tick.tick) || 0n;

    // For cliff detection, we need to compare with the previous tick's liquidity
    if (i > 0) {
      const previousTick = sortedTicks[i - 1];
      const previousLiquidity = activeLiquidityMap.get(previousTick.tick) || 0n;

      if (previousLiquidity === 0n) continue;

      const delta =
        currentLiquidity > previousLiquidity
          ? currentLiquidity - previousLiquidity
          : previousLiquidity - currentLiquidity;

      const deltaPct = Number(delta) / Number(previousLiquidity);

      if (deltaPct >= thresholdPct) {
        cliffs.push({
          tick: tick.tick,
          previousLiquidity,
          currentLiquidity,
          deltaPct: Math.round(deltaPct * 10000) / 100, // two decimals
        });
      }
    }
  }

  return cliffs;
}
