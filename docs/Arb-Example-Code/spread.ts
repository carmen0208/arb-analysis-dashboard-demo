import { ArbitrageSignal, TokenInfo } from "../types";
import { PriceData } from "../exchanges/types";

/**
 * Detect arbitrage signals based on price spread between Exchange A and Exchange B (using ask1/bid1).
 * @param pricesA Map<address, PriceData> - Price data from Exchange A (includes ask1/bid1)
 * @param pricesB Map<address, PriceData> - Price data from Exchange B (includes ask1/bid1)
 * @param addressToToken Map<string, TokenInfo> - Mapping from address to token info
 * @param threshold number - Spread ratio threshold (e.g., 0.02 means 2%)
 * @returns ArbitrageSignal[]
 */
export function detectLargeSpread(
  pricesA: Map<string, PriceData>,
  pricesB: Map<string, PriceData>,
  addressToToken: Map<string, TokenInfo>,
  threshold: number = 0.02,
): ArbitrageSignal[] {
  const signals: ArbitrageSignal[] = [];

  // Normalize all keys in pricesB to lowercase for case-insensitive matching
  const pricesBLower = new Map<string, PriceData>();
  for (const [addr, priceData] of pricesB.entries()) {
    pricesBLower.set(addr.toLowerCase(), priceData);
  }

  for (const [address, priceDataA] of pricesA.entries()) {
    const addressLower = address.toLowerCase();
    const priceDataB = pricesBLower.get(addressLower);
    if (!priceDataB || priceDataA.ask1Price <= 0 || priceDataB.bid1Price <= 0) {
      continue;
    }

    const token = addressToToken.get(addressLower);
    if (!token) {
      console.warn(
        `[detectLargeSpread] Token not found for address: ${address}`,
      );
      continue;
    }

    // New spread calculation formula: (B Bid 1 - A Ask 1) / (B Bid 1 + A Ask 1) * 2 * 100
    const bidB = priceDataB.bid1Price; // Exchange B's best bid price
    const askA = priceDataA.ask1Price; // Exchange A's best ask price

    const spread = ((bidB - askA) / (bidB + askA)) * 2;
    const spreadPercent = spread * 100;

    if (spread >= threshold) {
      signals.push({
        type: "large_spread",
        token: token.symbol,
        message: `💰 ${token.symbol} price spread detected: A Ask1=${askA.toFixed(6)}, B Bid1=${bidB.toFixed(6)}, spread=${spreadPercent.toFixed(2)}%`,
        data: {
          symbol: token.symbol,
          address: token.address,
          askA,
          bidB,
          spreadPercent,
          spread,
        },
      });
    } else {
      logger.debug("detectLargeSpread", {
        token: token.symbol,
        address: token.address,
        bidB,
        askA,
        spread,
        spreadPercent,
        threshold,
      });
    }
  }
  return signals;
}
