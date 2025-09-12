// LayerZero integration exports

// Configuration and constants
export {
  LayerZeroMainnetV2EndpointConfig,
  type LayerZeroChainKey,
  type LayerZeroEndpoint,
} from "./constants";

// Types
export type {
  NativeCurrency,
  EndpointConfig,
  LayerZeroDeployment,
  DVNInfo,
  Peer,
  ExecutorConfig,
  DVNConfig,
  ULNConfig,
  ExecutorAndDVNConfig,
  OFTConfiguration,
  OFTAnalysisResult,
  OFTConfigRequest,
  BridgeConfig,
  ContractDetectionResult,
  LayerZeroAPIResponse,
  ViemClientConfig,
} from "./types";

// Services and utilities
export { MetadataExtractor } from "./services/metadataExtractor";

// Deployment configuration services
export {
  getChainDeploymentConfig,
  getAllDeploymentConfigs,
  getEssentialDeploymentAddresses,
  validateChainSupport,
} from "./services/deploymentReader";

// Peer management services
export {
  analyzePeerRelationships,
  validatePeerConnectivity,
} from "./services/peerManager";

// Configuration reading services
export {
  getExecutorConfiguration,
  getDVNConfiguration,
  getExecutorAndDVNConfigs,
  getMultiTargetConfigs,
  validateConfigConsistency,
} from "./services/configReader";

// Main client interface
export {
  LayerZeroClient,
  analyzeOFT,
  checkBridgeAvailability,
  getBridgeInfo,
  validateOFTConfiguration,
} from "./services/client";

// OFT Detection services
export {
  isOFTContract,
  isOFTAdapterContract,
  detectContractType,
  getOFTEndpoint,
  getOFTAdapterToken,
  getAllPeers,
  getPeer,
} from "./services/oftDetector";

// API Detection services
export { getOFTInfoFromAPI } from "./services/apiDetector";

// Viem utilities
export {
  createPublicClientForChain,
  createPublicClientsForChains,
  isViemSupportedChain,
  getChainInfo,
  validateRpcConnection,
} from "./utils/viemClients";

// Import for utility functions
import {
  LayerZeroMainnetV2EndpointConfig,
  type LayerZeroChainKey,
} from "./constants";
import type { EndpointConfig } from "./types";

// Re-export commonly used configurations for convenience
export const LAYERZERO_MAINNET_CHAINS = Object.keys(
  LayerZeroMainnetV2EndpointConfig,
) as LayerZeroChainKey[];

export const LAYERZERO_EID_TO_CHAIN = Object.entries(
  LayerZeroMainnetV2EndpointConfig,
).reduce(
  (acc, [chainKey, config]) => {
    acc[config.eid] = chainKey as LayerZeroChainKey;
    return acc;
  },
  {} as Record<string, LayerZeroChainKey>,
);

/**
 * Get chain configuration by chain key
 */
export function getChainConfig(chainKey: LayerZeroChainKey): EndpointConfig {
  return LayerZeroMainnetV2EndpointConfig[chainKey];
}

/**
 * Get chain configuration by EID
 */
export function getChainConfigByEID(eid: string): EndpointConfig | undefined {
  const chainKey = LAYERZERO_EID_TO_CHAIN[eid];
  return chainKey ? LayerZeroMainnetV2EndpointConfig[chainKey] : undefined;
}

/**
 * Check if a chain is supported
 */
export function isSupportedChain(
  chainKey: string,
): chainKey is LayerZeroChainKey {
  return chainKey in LayerZeroMainnetV2EndpointConfig;
}

/**
 * Get all supported EIDs
 */
export function getSupportedEIDs(): string[] {
  return Object.values(LayerZeroMainnetV2EndpointConfig).map(
    (config) => config.eid,
  );
}
