/**
 * Blockchain API Clients - CoinGecko (Functional Approach)
 */

export * from "./coingecko";
export * from "./moralis";

// Export aggregator with namespace to avoid name collisions
import * as pancake from "./pancake";
import * as aggregator from "./aggregator";
export { aggregator, pancake };
export * as binanceAlpha from "./binance/alpha";
export * as binancePerp from "./binance/perp";
export * as bybitPerp from "./bybit/perp";
export * as bitgetPerp from "./bitget/perp";
export * as moralis from "./moralis";
export * as coingecko from "./coingecko";
export * as etherscan from "./etherscan";

export * from "./okexchange/dex";
export * from "./types";

// Export onchain functionality
export * as onchain from "./onchain";
