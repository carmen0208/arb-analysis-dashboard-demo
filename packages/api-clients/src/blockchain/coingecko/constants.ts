/**
 * Constants for CoinGecko API Client
 */
// No longer need path as core cache handles it

export const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
export const CACHE_DURATION = 60 * 60 * 1000; // Cache for 1 hour
// CACHE_DIR and CACHE_FILE_PATH are now managed by @dex-ai/core/cache

// Chain ID to CoinGecko platform ID mapping
export const CHAIN_TO_PLATFORM_MAP: Record<number, string> = {
  1: "ethereum", // Ethereum Mainnet
  56: "binance-smart-chain", // BSC
  137: "polygon-pos", // Polygon
  42161: "arbitrum-one", // Arbitrum One
  10: "optimistic-ethereum", // Optimism
  8453: "base", // Base
  534352: "scroll", // Scroll
  324: "zksync-era", // zkSync Era
  5000: "mantle", // Mantle
  43114: "avalanche", // Avalanche C-Chain
};

/**
 * Get CoinGecko platform ID from chain ID
 */
export function getPlatformFromChainId(chainId: number): string | null {
  return CHAIN_TO_PLATFORM_MAP[chainId] || null;
}
