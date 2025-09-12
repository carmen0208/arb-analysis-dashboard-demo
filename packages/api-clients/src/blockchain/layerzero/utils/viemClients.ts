import { createPublicClient, http, type PublicClient } from "viem";
import {
  mainnet,
  bsc,
  polygon,
  arbitrum,
  optimism,
  base,
  avalanche,
} from "viem/chains";
import type { LayerZeroChainKey, LayerZeroEndpoint } from "../constants";
import { LayerZeroMainnetV2EndpointConfig } from "../constants";
import logger from "./logger";

// Define supported chains mapping to viem chains
const VIEM_CHAINS = {
  ethereum: mainnet,
  bsc,
  polygon,
  arbitrum,
  optimism,
  base,
  avalanche,
  // Note: mantle, zkevm, sei, solana, sonic, hyperliquid need custom chain definitions
} as const;

type SupportedViemChain = keyof typeof VIEM_CHAINS;

/**
 * Check if a LayerZero chain is supported by viem
 */
export function isViemSupportedChain(
  chainKey: LayerZeroChainKey,
): chainKey is SupportedViemChain {
  return chainKey in VIEM_CHAINS;
}

/**
 * Create a custom chain definition for chains not supported by viem
 */
function createCustomChain(config: LayerZeroEndpoint) {
  return {
    id: config.nativeChainId,
    name: config.name,
    network: config.name.toLowerCase().replace(/\s+/g, "-"),
    nativeCurrency: {
      name:
        ("name" in config.nativeCurrency
          ? config.nativeCurrency.name
          : config.nativeCurrency.symbol) || config.nativeCurrency.symbol,
      symbol: config.nativeCurrency.symbol,
      decimals: config.nativeCurrency.decimals,
    },
    rpcUrls: {
      default: {
        http: [config.rpc],
      },
      public: {
        http: [config.rpc],
      },
    },
    blockExplorers: undefined, // We can add these later if needed
  };
}

/**
 * Create a public client for a specific LayerZero chain
 */
export function createPublicClientForChain(
  chainKey: LayerZeroChainKey,
  customRpc?: string,
): PublicClient {
  const config = LayerZeroMainnetV2EndpointConfig[chainKey];
  const rpcUrl = customRpc || config.rpc;

  logger.debug(`[Viem Client] Creating client for ${chainKey}`, {
    chainId: config.nativeChainId,
    rpc: rpcUrl,
  });

  // Use predefined viem chain if available
  if (isViemSupportedChain(chainKey)) {
    return createPublicClient({
      chain: VIEM_CHAINS[chainKey],
      transport: http(rpcUrl),
    }) as PublicClient;
  }

  // Create custom chain for unsupported chains
  const customChain = createCustomChain(config);
  logger.debug(`[Viem Client] Using custom chain definition for ${chainKey}`, {
    chainId: customChain.id,
    name: customChain.name,
  });

  return createPublicClient({
    chain: customChain,
    transport: http(rpcUrl),
  }) as PublicClient;
}

/**
 * Create multiple public clients for an array of chains
 */
export function createPublicClientsForChains(
  chainKeys: LayerZeroChainKey[],
): Record<LayerZeroChainKey, PublicClient> {
  const clients: Record<string, PublicClient> = {};

  for (const chainKey of chainKeys) {
    try {
      clients[chainKey] = createPublicClientForChain(chainKey);
      logger.debug(`[Viem Client] Successfully created client for ${chainKey}`);
    } catch (error) {
      logger.error(`[Viem Client] Failed to create client for ${chainKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return clients as Record<LayerZeroChainKey, PublicClient>;
}

/**
 * Get chain configuration and client info
 */
export function getChainInfo(chainKey: LayerZeroChainKey) {
  const config = LayerZeroMainnetV2EndpointConfig[chainKey];
  const isViemSupported = isViemSupportedChain(chainKey);

  return {
    config,
    isViemSupported,
    viemChain: isViemSupported ? VIEM_CHAINS[chainKey] : undefined,
    customChain: !isViemSupported ? createCustomChain(config) : undefined,
  };
}

/**
 * Validate RPC connection for a chain
 */
export async function validateRpcConnection(
  chainKey: LayerZeroChainKey,
  customRpc?: string,
): Promise<boolean> {
  try {
    const client = createPublicClientForChain(chainKey, customRpc);
    const blockNumber = await client.getBlockNumber();

    logger.debug(`[Viem Client] RPC validation successful for ${chainKey}`, {
      blockNumber: blockNumber.toString(),
      rpc: customRpc || LayerZeroMainnetV2EndpointConfig[chainKey].rpc,
    });

    return true;
  } catch (error) {
    logger.warn(`[Viem Client] RPC validation failed for ${chainKey}`, {
      error: error instanceof Error ? error.message : String(error),
      rpc: customRpc || LayerZeroMainnetV2EndpointConfig[chainKey].rpc,
    });

    return false;
  }
}
