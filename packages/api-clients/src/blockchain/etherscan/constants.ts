/**
 * Constants for Etherscan API Client
 */

// Unified Etherscan V2 API endpoint for all chains
export const ETHERSCAN_V2_BASE_URL = "https://api.etherscan.io/v2/api";

// Cache duration for token transactions (5 minutes)
export const CACHE_DURATION = 5 * 60 * 1000;

// Supported chains
export enum ChainId {
  ETHEREUM = 1,
  BSC = 56,
  POLYGON = 137,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  BASE = 8453,
}

// Chain configuration - simplified for V2 API
export const CHAIN_CONFIG = {
  [ChainId.ETHEREUM]: {
    name: "Ethereum",
    chainId: ChainId.ETHEREUM,
    explorer: "https://etherscan.io",
  },
  [ChainId.BSC]: {
    name: "BSC",
    chainId: ChainId.BSC,
    explorer: "https://bscscan.com",
  },
  [ChainId.POLYGON]: {
    name: "Polygon",
    chainId: ChainId.POLYGON,
    explorer: "https://polygonscan.com",
  },
  [ChainId.ARBITRUM]: {
    name: "Arbitrum",
    chainId: ChainId.ARBITRUM,
    explorer: "https://arbiscan.io",
  },
  [ChainId.OPTIMISM]: {
    name: "Optimism",
    chainId: ChainId.OPTIMISM,
    explorer: "https://optimistic.etherscan.io",
  },
  [ChainId.BASE]: {
    name: "Base",
    chainId: ChainId.BASE,
    explorer: "https://basescan.org",
  },
} as const;
