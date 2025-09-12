import { RestClientV5 } from "bybit-api";

/**
 * Get Bybit contract minimum order unit (qtyStep) and minimum order quantity (minOrderQty)
 * @param symbol Contract name, e.g. BTCUSDT
 * @param useTestnet Whether to use testnet
 */
export async function getInstrumentInfo(
  symbol: string,
  useTestnet: boolean = true,
): Promise<{ qtyStep: number; minOrderQty: number }> {
  const client = new RestClientV5({
    demoTrading: useTestnet,
  });
  const res = await client.getInstrumentsInfo({
    category: "linear",
    symbol,
  });
  if (!res.result || !res.result.list || res.result.list.length === 0) {
    throw new Error(`No instrument info found for symbol: ${symbol}`);
  }
  const info = res.result.list[0];
  return {
    qtyStep: Number(info.lotSizeFilter.qtyStep),
    minOrderQty: Number(info.lotSizeFilter.minOrderQty),
  };
}
