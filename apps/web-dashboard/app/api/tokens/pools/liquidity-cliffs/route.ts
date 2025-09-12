import { NextRequest, NextResponse } from "next/server";
import { detectLiquidityCliffs } from "@dex-ai/api-clients";

interface LiquidityInfo {
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
  availableLiquidity: bigint;
  token0AmountAdjusted: number;
  token1AmountAdjusted: number;
  token0TotalUSDAdjusted: number;
  token1TotalUSDAdjusted: number;
  totalUSDAdjusted: number;
  initialized: boolean;
  currentTick: boolean;
}

interface SerializedTick {
  tick: number;
  liquidityNet: string;
  liquidityGross: string;
  availableLiquidity: string;
  token0AmountAdjusted: number;
  token1AmountAdjusted: number;
  token0TotalUSDAdjusted: number;
  token1TotalUSDAdjusted: number;
  totalUSDAdjusted: number;
  initialized: boolean;
  currentTick: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticks, startingLiquidity, thresholdPct = 0.2 } = body;

    if (!ticks || !Array.isArray(ticks)) {
      return NextResponse.json(
        { error: "Invalid ticks data" },
        { status: 400 },
      );
    }

    if (!startingLiquidity) {
      return NextResponse.json(
        { error: "Missing startingLiquidity" },
        { status: 400 },
      );
    }

    // Convert serialized ticks to LiquidityInfo format
    const liquidityInfos: LiquidityInfo[] = ticks.map(
      (tick: SerializedTick) => ({
        tick: tick.tick,
        liquidityNet: BigInt(tick.liquidityNet),
        liquidityGross: BigInt(tick.liquidityGross),
        availableLiquidity: BigInt(tick.availableLiquidity),
        token0AmountAdjusted: tick.token0AmountAdjusted,
        token1AmountAdjusted: tick.token1AmountAdjusted,
        token0TotalUSDAdjusted: tick.token0TotalUSDAdjusted,
        token1TotalUSDAdjusted: tick.token1TotalUSDAdjusted,
        totalUSDAdjusted: tick.totalUSDAdjusted,
        initialized: tick.initialized,
        currentTick: tick.currentTick,
      }),
    );

    // Sort ticks by tick value to ensure proper order
    const sortedTicks = [...liquidityInfos].sort((a, b) => a.tick - b.tick);

    // Use the detectLiquidityCliffs function from api-client
    const cliffs = detectLiquidityCliffs(
      sortedTicks,
      BigInt(startingLiquidity),
      thresholdPct,
    );

    // Convert BigInt values back to strings for JSON serialization
    const serializedCliffs = cliffs.map((cliff) => ({
      tick: cliff.tick,
      previousLiquidity: cliff.previousLiquidity.toString(),
      currentLiquidity: cliff.currentLiquidity.toString(),
      deltaPct: cliff.deltaPct,
    }));

    return NextResponse.json({ cliffs: serializedCliffs });
  } catch (error) {
    console.error("Error detecting liquidity cliffs:", error);
    return NextResponse.json(
      { error: "Failed to detect liquidity cliffs" },
      { status: 500 },
    );
  }
}
