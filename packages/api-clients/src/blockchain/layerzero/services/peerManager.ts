import type {
  Peer,
  LayerZeroChainKey,
  BridgeConfig,
  PeerConnectivity,
} from "../types";
import { LayerZeroMainnetV2EndpointConfig } from "../constants";
import { getAllPeers, getPeer } from "./oftDetector";
import logger from "../utils/logger";

/**
 * Analyze peer relationships for an OFT contract
 */
export async function analyzePeerRelationships(
  contractAddress: string,
  sourceChain: LayerZeroChainKey,
): Promise<{
  peers: Peer[];
  bridgeConfigs: BridgeConfig[];
  totalPeers: number;
  supportedChains: LayerZeroChainKey[];
}> {
  try {
    logger.info("[Peer Manager] Analyzing peer relationships", {
      contract: contractAddress,
      sourceChain,
    });

    // Get all peers using the optimized multicall approach
    const peersResult = await getAllPeers(contractAddress, sourceChain);

    if (peersResult.totalPeers === 0) {
      logger.info("[Peer Manager] No peers found for contract", {
        contract: contractAddress,
        sourceChain,
      });

      return {
        peers: [],
        bridgeConfigs: [],
        totalPeers: 0,
        supportedChains: [],
      };
    }

    // Create bridge configurations for each peer
    const bridgeConfigs: BridgeConfig[] = [];
    const supportedChains: LayerZeroChainKey[] = [sourceChain];

    for (const peer of peersResult.peers) {
      // Add to supported chains if not already included
      if (!supportedChains.includes(peer.chainKey as LayerZeroChainKey)) {
        supportedChains.push(peer.chainKey as LayerZeroChainKey);
      }

      // Create bridge config
      const bridgeConfig: BridgeConfig = {
        fromChain: sourceChain,
        toChain: peer.chainKey,
        isAvailable: peer.isActive,
        // Additional config will be populated by config reader
      };

      bridgeConfigs.push(bridgeConfig);
    }

    logger.info("[Peer Manager] Peer analysis completed", {
      contract: contractAddress,
      sourceChain,
      totalPeers: peersResult.totalPeers,
      supportedChains: supportedChains.length,
      bridgeConfigs: bridgeConfigs.length,
    });

    // Convert peer format to match interface
    const convertedPeers: Peer[] = peersResult.peers.map((peer) => ({
      eid: peer.eid,
      chainKey: peer.chainKey,
      peerAddress: peer.peerAddress,
      isActive: peer.isActive,
    }));

    return {
      peers: convertedPeers,
      bridgeConfigs,
      totalPeers: peersResult.totalPeers,
      supportedChains,
    };
  } catch (error) {
    logger.error("[Peer Manager] Error analyzing peer relationships", {
      contract: contractAddress,
      sourceChain,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      peers: [],
      bridgeConfigs: [],
      totalPeers: 0,
      supportedChains: [],
    };
  }
}

/**
 * Validate peer connectivity between two chains
 */
export async function validatePeerConnectivity(
  contractAddress: string,
  sourceChain: LayerZeroChainKey,
  targetChain: LayerZeroChainKey,
): Promise<PeerConnectivity> {
  try {
    logger.debug("[Peer Manager] Validating peer connectivity", {
      contract: contractAddress,
      sourceChain,
      targetChain,
    });

    const sourceConfig =
      sourceChain in LayerZeroMainnetV2EndpointConfig
        ? LayerZeroMainnetV2EndpointConfig[sourceChain as LayerZeroChainKey]
        : undefined;
    const targetConfig =
      targetChain in LayerZeroMainnetV2EndpointConfig
        ? LayerZeroMainnetV2EndpointConfig[targetChain as LayerZeroChainKey]
        : undefined;

    if (!sourceConfig || !targetConfig) {
      logger.warn("[Peer Manager] Unsupported chain in connectivity check", {
        sourceChain,
        targetChain,
        hasSourceConfig: !!sourceConfig,
        hasTargetConfig: !!targetConfig,
      });

      return {
        isConnected: false,
        peerAddress: "",
        sourceEid: sourceConfig?.eid || "",
        targetEid: targetConfig?.eid || "",
      };
    }
    // Get all peers for the contract
    const targetPeer = await getPeer(contractAddress, sourceChain, targetChain);
    // Check if target chain is in the peers list

    const result = {
      isConnected: !!targetPeer?.isActive,
      peerAddress: targetPeer?.peerAddress || "",
      sourceEid: sourceConfig.eid,
      targetEid: targetConfig.eid,
    };

    logger.debug("[Peer Manager] Peer connectivity validation completed", {
      contract: contractAddress,
      sourceChain,
      targetChain,
      result,
    });

    return result;
  } catch (error) {
    logger.error("[Peer Manager] Error validating peer connectivity", {
      contract: contractAddress,
      sourceChain,
      targetChain,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      isConnected: false,
      peerAddress: "",
      sourceEid: "",
      targetEid: "",
    };
  }
}
