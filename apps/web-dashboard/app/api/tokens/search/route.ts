import { NextRequest, NextResponse } from "next/server";
import { blockchain } from "@dex-ai/api-clients";
const API_KEY = process.env.API_KEY;

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!API_KEY || apiKey !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchQuery = request.nextUrl.searchParams.get("q")?.toLowerCase();

  if (!searchQuery) {
    return NextResponse.json([]);
  }

  try {
    const client = await blockchain.binanceAlpha.createClient({
      rpcUrl: process.env.BINANCE_ALPHA_RPC_URL,
    });
    const tokens = await client.fetchTokens(searchQuery);

    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search tokens" },
      { status: 500 },
    );
  }
}
