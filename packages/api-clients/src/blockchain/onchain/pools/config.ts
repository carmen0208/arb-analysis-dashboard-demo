import { mainnet, bsc, polygon, arbitrum, optimism } from "viem/chains";
import logger from "../../../common/logger";

/**
 * V3 Pool Analyzer Configuration
 * Contains Factory addresses and network configurations for different DEXes
 */

// BSC Chain configuration
export const BSC_CONFIG = {
  rpcUrl:
    process.env.BINANCE_ALPHA_RPC_URL || "https://bsc-dataseed.binance.org",
  chainId: 56,
  chainName: "Binance Smart Chain",
} as const;

// DEX configurations for BSC
export const DEX_CONFIGS = {
  // PancakeSwap V3 on BSC
  "pancakeswap-v3-bsc": {
    rpcUrl: BSC_CONFIG.rpcUrl,
    factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    chainId: BSC_CONFIG.chainId,
    dexName: "PancakeSwap V3",
    version: "v3",
    chainName: BSC_CONFIG.chainName,
  },

  // Uniswap V3 on BSC
  "uniswap-v3-bsc": {
    rpcUrl: BSC_CONFIG.rpcUrl,
    factoryAddress: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7", // Uniswap V3 factory on BSC
    chainId: BSC_CONFIG.chainId,
    dexName: "Uniswap V3",
    version: "v3",
    chainName: BSC_CONFIG.chainName,
  },
} as const;

// Type definitions
export type DexConfigKey = keyof typeof DEX_CONFIGS;

// Interface for DEX configuration
export interface V3PoolConfig {
  rpcUrl: string;
  factoryAddress: string;
  chainId: number;
  dexName: string;
  version: string;
  chainName: string;
}

// Default configuration
export const DEFAULT_CONFIG: V3PoolConfig = DEX_CONFIGS["pancakeswap-v3-bsc"];

/**
 * Get DEX configuration
 * @param dexKey DEX configuration key
 * @returns V3PoolConfig configuration object
 */
export function getDexConfig(dexKey: DexConfigKey): V3PoolConfig {
  return DEX_CONFIGS[dexKey];
}

/**
 * Get all available DEX configurations
 * @returns Array of all DEX configuration keys
 */
export function getAvailableDexConfigs(): DexConfigKey[] {
  return Object.keys(DEX_CONFIGS) as DexConfigKey[];
}

/**
 * Get available DEX configurations by chainId
 * @param chainId Chain ID
 * @returns Array of DEX configuration keys available on this chain
 */
export function getDexConfigsByChainId(chainId: number): DexConfigKey[] {
  return Object.entries(DEX_CONFIGS)
    .filter(([_, config]) => config.chainId === chainId)
    .map(([key, _]) => key as DexConfigKey);
}

/**
 * Get the corresponding viem chain object by chainId
 */
export function getChainById(chainId: number) {
  const chains = [mainnet, bsc, polygon, arbitrum, optimism];
  const chain = chains.find((c) => c.id === chainId);

  if (!chain) {
    logger.warn("[V3PoolAnalyzer] Unknown chainId, using BSC", { chainId });
    return bsc;
  }

  return chain;
}

export function getCoinGeckoChainName(chainId: number) {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 56:
      return "binance-smart-chain";
    default:
      return "unknown";
  }
}

/**
 * Validate if DEX configuration is valid
 * @param config V3PoolConfig configuration object
 * @returns Whether the configuration is valid
 */
export function validateConfig(config: V3PoolConfig): boolean {
  return !!(
    config.rpcUrl &&
    config.factoryAddress &&
    config.factoryAddress.match(/^0x[a-fA-F0-9]{40}$/) &&
    config.chainId > 0 &&
    config.dexName
  );
}
