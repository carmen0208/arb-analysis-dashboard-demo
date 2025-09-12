import { NextRequest, NextResponse } from "next/server";
import { blockchain } from "@dex-ai/api-clients";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } },
) {
  try {
    const { address } = params;

    if (!address) {
      return NextResponse.json(
        { error: "Token address is required" },
        { status: 400 },
      );
    }

    // Fetch real token data using the Binance Alpha API
    const client = await blockchain.binanceAlpha.createClient({
      rpcUrl: process.env.BINANCE_ALPHA_RPC_URL,
    });

    // Get token details using the address
    const tokenDetails = await client.fetchToken(address as `0x${string}`);

    if (!tokenDetails) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Construct the token data structure
    const tokenData = {
      address: tokenDetails.address,
      symbol: tokenDetails.symbol,
      name: tokenDetails.name,
      decimals: tokenDetails.decimals || 18,
      platform: tokenDetails.platform,
      verified: tokenDetails.verified || false,
      isVerified: tokenDetails.verified || false,
      // Price data will be fetched separately by the price API
      price: {}, // This will be populated by the price API
      marketCap: 0, // Will be fetched by price API
      volume24h: 0, // Will be fetched by price API
      poolsInfo: {
        totalLiquidity: 0, // Will be fetched by price API
        pools: [], // Will be fetched by price API
      },
      bridgeInfo: {
        isL0Supported: false, // Will be fetched by price API
        supportedChains: [], // Will be fetched by price API
      },
    };

    return NextResponse.json(tokenData);
  } catch (error) {
    console.error("Error fetching token data:", error);
    return NextResponse.json(
      { error: "Failed to fetch token data" },
      { status: 500 },
    );
  }
}
