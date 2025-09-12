import { NextRequest, NextResponse } from "next/server";
import { getTickLiquidityDistribution, blockchain } from "@dex-ai/api-clients";

// Helper function to convert BigInt values to strings for JSON serialization
function serializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }

  return obj;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  try {
    const poolAddress = params.address as `0x${string}`;

    // Validate pool address format
    if (!poolAddress.startsWith("0x") || poolAddress.length !== 42) {
      return NextResponse.json(
        { error: "Invalid pool address format" },
        { status: 400 },
      );
    }

    // Get both pool base info and liquidity distribution data
    const [poolBaseInfo, liquidityDistribution] = await Promise.all([
      blockchain.onchain.pools.getPoolBaseInfoWithTokenInfo(poolAddress),
      getTickLiquidityDistribution(poolAddress, 10), // Get 10 ticks around current tick
    ]);

    // Serialize BigInt values before returning
    const serializedData = {
      poolBaseInfo: serializeBigInts(poolBaseInfo),
      liquidityDistribution: serializeBigInts(liquidityDistribution),
    };

    return NextResponse.json(serializedData);
  } catch (error) {
    console.error("Error fetching liquidity distribution:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch liquidity distribution",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
