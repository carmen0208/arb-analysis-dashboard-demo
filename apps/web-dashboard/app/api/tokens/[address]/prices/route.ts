import { NextRequest, NextResponse } from "next/server";
import {
  getMultiSourceTokenPrice,
  getCurrentTokenPrice,
  getHistoricalTokenPrices,
  DEFAULT_CONFIG,
  isValidPlatform,
} from "@dex-ai/api-clients";

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } },
) {
  try {
    const { address } = params;
    const { searchParams } = new URL(req.url);

    // Get query parameters
    const platformParam = searchParams.get("platform") || "ethereum";
    const symbol = searchParams.get("symbol");
    const days = searchParams.get("days") || "1";
    const currency = searchParams.get("currency") || "usd";
    const type = searchParams.get("type") || "full"; // full, current, historical

    // Validate parameters
    if (!address || !symbol) {
      return NextResponse.json(
        { error: "Token address and Symbol is required" },
        { status: 400 },
      );
    }

    // Validate platform parameters
    if (!isValidPlatform(platformParam)) {
      return NextResponse.json(
        { error: `Invalid platform: ${platformParam}` },
        { status: 400 },
      );
    }

    const platform = platformParam;

    const parsedDays = parseInt(days);
    const config = {
      ...DEFAULT_CONFIG,
      defaultDays: parsedDays,
      defaultCurrency: currency,
    };

    let result;
    switch (type) {
      case "current":
        result = await getCurrentTokenPrice(address, symbol, platform, config);
        break;
      case "historical":
        result = await getHistoricalTokenPrices(
          address,
          symbol,
          platform,
          config,
        );
        break;
      case "full":
      default:
        result = await getMultiSourceTokenPrice(
          address,
          symbol,
          platform,
          config,
        );
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        tokenAddress: address,
        platform,
        days: parsedDays,
        currency: config.defaultCurrency,
        type,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching token prices:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch token prices",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
