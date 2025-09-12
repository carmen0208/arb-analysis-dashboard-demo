// Common type definitions for OKX DEX & Gate Futures
import { WebsocketClientV2 } from "bitget-api";
export * from "./aggregator/types";

export interface DexToken {
  chainId?: number;
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
}

export type ByBitTicker = {
  symbol: string;
  lastPrice: string;
  indexPrice: string;
  markPrice: string;
  prevPrice24h: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice1h: string;
  openInterest: string;
  openInterestValue: string;
  turnover24h: string;
  volume24h: string;
  fundingRate: string;
  nextFundingTime: string;
  predictedDeliveryPrice: string;
  basisRate: string;
  deliveryFeeRate: string;
  deliveryTime: string;
  ask1Size: string;
  bid1Price: string;
  ask1Price: string;
  bid1Size: string;
  basis: string;
};

export type BitgetWebsocketClientV2 = WebsocketClientV2;

export interface DexPair {
  chainId?: number;
  chainName?: string;
  base: Partial<DexToken>;
  ticker: Partial<DexToken>;
  pairSymbol: string; // e.g. "ETH/USDT"
  exchange: "okx dex" | "gate" | "Bybit Futures";
  extra?: string;
}

export interface DexPairWithPrice extends DexPair {
  price?: {
    latestPrice?: number;
    bid1Price?: number;
    ask1Price?: number;
  };
}

interface SwapQuoteToken {
  decimal: string;
  isHoneyPot: boolean;
  taxRate: string;
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenUnitPrice: string;
}

export interface DexRouter {
  routerAddress: string;
  routerName: string;
  fee: string;
  gasEstimate: string;
  path?: string[];
}

export interface QuoteComparison {
  dexName: string;
  price: string;
  priceImpact: string;
  gasFee: string;
  slippage: string;
  route?: string[];
}

export interface SwapQuote {
  chainId: string;
  chainIndex: string;
  contextSlot: number;
  dexRouterList: DexRouter[];
  estimateGasFee: string;
  fromToken: SwapQuoteToken;
  fromTokenAmount: string;
  priceImpactPercentage: string;
  quoteCompareList: QuoteComparison[];
  swapMode: string;
  toToken: SwapQuoteToken;
  toTokenAmount: string;
  tradeFee: string;
}

export interface OrderBook {
  bids: [string, string][]; // [price, amount]
  asks: [string, string][];
}

export interface GateFuturesOrder {
  contract: string;
  size: number;
  price?: string;
  tif?: string;
  reduceOnly?: boolean;
  text?: string;
}

export interface GateFuturesOrderResult {
  orderId: string;
  status: "open" | "finished" | "cancelled" | "failed";
  message?: string;
}

export interface ApiKeyConfig {
  label: string; // User-defined name
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX specific
  type: "okx" | "gate";
}

export interface UserSettings {
  refreshInterval: number; // Polling interval (seconds)
  okxApiKeys: ApiKeyConfig[];
  gateApiKeys: ApiKeyConfig[];
  walletPrivateKey?: string;
}

/**
 * Blockchain Platform Enum
 *
 * This enum defines all supported blockchain platforms in the system.
 * Each platform has a unique identifier that matches the API expectations.
 */

export enum BlockchainPlatform {
  // Major Layer 1 platforms
  ETHEREUM = "ethereum",
  BINANCE_SMART_CHAIN = "binance-smart-chain",
  POLYGON = "polygon",
  AVALANCHE = "avalanche-c",
  SOLANA = "solana",
  SUI = "sui",

  // Layer 2 platforms
  ARBITRUM_ONE = "arbitrum-one",
  OPTIMISM = "op-mainnet",
  BASE = "base",
  SCROLL = "scroll",
  ZKSYNC_ERA = "zksync-era",

  // Other platforms
  MANTLE = "mantle",
  SONIC = "sonic",
}

/**
 * Platform information including display name and additional metadata
 */
export interface PlatformInfo {
  id: BlockchainPlatform;
  displayName: string;
  chainId?: number;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: string;
  rpcUrl?: string;
}

/**
 * Platform registry with detailed information for each platform
 */
export const PLATFORM_REGISTRY: Record<BlockchainPlatform, PlatformInfo> = {
  [BlockchainPlatform.ETHEREUM]: {
    id: BlockchainPlatform.ETHEREUM,
    displayName: "Ethereum",
    chainId: 1,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://etherscan.io",
  },
  [BlockchainPlatform.BINANCE_SMART_CHAIN]: {
    id: BlockchainPlatform.BINANCE_SMART_CHAIN,
    displayName: "BNB Chain",
    chainId: 56,
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    blockExplorer: "https://bscscan.com",
  },
  [BlockchainPlatform.POLYGON]: {
    id: BlockchainPlatform.POLYGON,
    displayName: "Polygon",
    chainId: 137,
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    blockExplorer: "https://polygonscan.com",
  },
  [BlockchainPlatform.AVALANCHE]: {
    id: BlockchainPlatform.AVALANCHE,
    displayName: "Avalanche C-Chain",
    chainId: 43114,
    nativeCurrency: {
      name: "AVAX",
      symbol: "AVAX",
      decimals: 18,
    },
    blockExplorer: "https://snowtrace.io",
  },
  [BlockchainPlatform.SOLANA]: {
    id: BlockchainPlatform.SOLANA,
    displayName: "Solana",
    nativeCurrency: {
      name: "SOL",
      symbol: "SOL",
      decimals: 9,
    },
    blockExplorer: "https://solscan.io",
  },
  [BlockchainPlatform.SUI]: {
    id: BlockchainPlatform.SUI,
    displayName: "Sui",
    nativeCurrency: {
      name: "SUI",
      symbol: "SUI",
      decimals: 9,
    },
    blockExplorer: "https://suiexplorer.com",
  },
  [BlockchainPlatform.ARBITRUM_ONE]: {
    id: BlockchainPlatform.ARBITRUM_ONE,
    displayName: "Arbitrum One",
    chainId: 42161,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://arbiscan.io",
  },
  [BlockchainPlatform.OPTIMISM]: {
    id: BlockchainPlatform.OPTIMISM,
    displayName: "OP Mainnet",
    chainId: 10,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://optimistic.etherscan.io",
  },
  [BlockchainPlatform.BASE]: {
    id: BlockchainPlatform.BASE,
    displayName: "Base",
    chainId: 8453,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://basescan.org",
  },
  [BlockchainPlatform.SCROLL]: {
    id: BlockchainPlatform.SCROLL,
    displayName: "Scroll",
    chainId: 534352,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://scrollscan.com",
  },
  [BlockchainPlatform.ZKSYNC_ERA]: {
    id: BlockchainPlatform.ZKSYNC_ERA,
    displayName: "zkSync Era",
    chainId: 324,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorer: "https://explorer.zksync.io",
  },
  [BlockchainPlatform.MANTLE]: {
    id: BlockchainPlatform.MANTLE,
    displayName: "Mantle",
    chainId: 5000,
    nativeCurrency: {
      name: "MNT",
      symbol: "MNT",
      decimals: 18,
    },
    blockExplorer: "https://explorer.mantle.xyz",
  },
  [BlockchainPlatform.SONIC]: {
    id: BlockchainPlatform.SONIC,
    displayName: "Sonic",
    nativeCurrency: {
      name: "SONIC",
      symbol: "SONIC",
      decimals: 18,
    },
  },
};

/**
 * Get platform information by platform ID
 */
export function getPlatformInfo(platformId: BlockchainPlatform): PlatformInfo {
  return PLATFORM_REGISTRY[platformId];
}

/**
 * Get all available platforms
 */
export function getAllPlatforms(): PlatformInfo[] {
  return Object.values(PLATFORM_REGISTRY);
}

/**
 * Get platform display name by platform ID
 */
export function getPlatformDisplayName(platformId: BlockchainPlatform): string {
  return PLATFORM_REGISTRY[platformId]?.displayName || platformId;
}

/**
 * Check if a platform ID is valid
 */
export function isValidPlatform(
  platformId: string,
): platformId is BlockchainPlatform {
  return Object.values(BlockchainPlatform).includes(
    platformId as BlockchainPlatform,
  );
}
