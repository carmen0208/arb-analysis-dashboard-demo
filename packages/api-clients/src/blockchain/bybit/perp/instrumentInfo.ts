import { RestClientV5 } from "bybit-api";

/**
 * 获取 Bybit 合约的最小下单单位（qtyStep）和最小下单量（minOrderQty）
 * @param symbol 合约名称，如 BTCUSDT
 * @param useTestnet 是否使用测试网
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
