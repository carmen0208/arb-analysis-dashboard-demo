import { NextRequest, NextResponse } from "next/server";
import { blockchain } from "@dex-ai/api-clients";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get("chain") || "eth";
    const limit = parseInt(searchParams.get("limit") || "30");

    const tokenAddress = params.address;

    // Get token pool information
    const pools = await blockchain.moralis.getTokenPools({
      tokenAddress,
      chain,
      limit,
    });

    // Filter pools with liquidity > 500K and 24h volume > 0
    const filteredPools = pools.filter((pool) => {
      const liquidity = pool.liquidity_usd || 0;
      const volume24h = pool.volume_24h_usd || 0;
      return liquidity > 500000 && volume24h > 0; // 500K
    });

    // Calculate total liquidity
    const totalLiquidity = filteredPools.reduce((total, pool) => {
      return total + (pool.liquidity_usd || 0);
    }, 0);

    // Calculate total 24-hour trading volume
    const totalVolume24h = filteredPools.reduce((total, pool) => {
      return total + (pool.volume_24h_usd || 0);
    }, 0);

    // Convert to frontend expected format
    const poolsInfo = {
      totalLiquidity,
      totalVolume24h,
      pools: filteredPools.map((pool) => ({
        address: pool.pair_address,
        platform: pool.exchange_name || "Unknown Exchange",
        exchange_address: pool.exchange_address,
        pair: `${pool.token0.token_name}/${pool.token1.token_name}`,
        liquidity: pool.liquidity_usd || 0,
        volume24h: pool.volume_24h_usd || 0,
        token0: {
          address: pool.token0.token_address,
          symbol: pool.token0.token_name,
          liquidity: pool.token0.liquidity_usd || 0,
        },
        token1: {
          address: pool.token1.token_address,
          symbol: pool.token1.token_name,
          liquidity: pool.token1.liquidity_usd || 0,
        },
        exchangeLogo: pool.exchange_logo,
        pairLabel: pool.pair_label,
      })),
    };

    return NextResponse.json(poolsInfo);
  } catch (error) {
    console.error("Error fetching token pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch token pools" },
      { status: 500 },
    );
  }
}
