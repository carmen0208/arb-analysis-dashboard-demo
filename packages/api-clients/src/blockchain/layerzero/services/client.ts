import type {
  OFTAnalysisResult,
  LayerZeroChainKey,
  BridgeConfig,
  ExecutorAndDVNConfig,
  ConfigReadRequest,
} from "../types";
import { detectContractType } from "./oftDetector";
import {
  analyzePeerRelationships,
  validatePeerConnectivity,
} from "./peerManager";
import { getChainDeploymentConfig } from "./deploymentReader";
import {
  getExecutorAndDVNConfigs,
  getMultiTargetConfigs,
  validateConfigConsistency,
} from "./configReader";
import logger from "../utils/logger";

/**
 * Main LayerZero Client for comprehensive OFT analysis
 */
export class LayerZeroClient {
  /**
   * Perform complete analysis of an OFT contract
   */
  static async analyzeOFT(
    contractAddress: string,
    sourceChain: LayerZeroChainKey,
    options?: {
      includeConfigs?: boolean;
    },
  ): Promise<OFTAnalysisResult> {
    try {
      logger.info("[LayerZero Client] Starting comprehensive OFT analysis", {
        contract: contractAddress,
        sourceChain,
        options,
      });

      const includeConfigs = options?.includeConfigs ?? true;

      // Step 1: Basic contract detection
      const contractDetection = await detectContractType(
        contractAddress,
        sourceChain,
      );

      if (contractDetection.contractType === "UNKNOWN") {
        logger.warn("[LayerZero Client] Contract is not an OFT", {
          contract: contractAddress,
          sourceChain,
        });

        return {
          isOFT: false,
          isOFTAdapter: false,
          contractType: "UNKNOWN",
          peers: [],
          supportedChains: [],
          bridgeConfigs: [],
        };
      }

      // Step 2: Analyze peer relationships
      const peerAnalysis = await analyzePeerRelationships(
        contractAddress,
        sourceChain,
      );

      if (peerAnalysis.totalPeers === 0) {
        logger.warn("[LayerZero Client] No peers found for OFT contract", {
          contract: contractAddress,
          sourceChain,
        });

        return {
          isOFT: contractDetection.isOFT,
          isOFTAdapter: contractDetection.isOFTAdapter,
          contractType: contractDetection.contractType,
          peers: [],
          supportedChains: [sourceChain],
          bridgeConfigs: [],
        };
      }

      // Step 3: Get LayerZero deployment information (if needed)
      let layerZeroDeployments = undefined;
      let bridgeConfigs: BridgeConfig[] = peerAnalysis.bridgeConfigs;

      if (includeConfigs && peerAnalysis.peers.length > 0) {
        // Get deployment config for source chain
        const sourceDeployment = await getChainDeploymentConfig(sourceChain);

        if (sourceDeployment) {
          layerZeroDeployments = sourceDeployment;

          // Get configurations for each peer
          const targetEids = peerAnalysis.peers.map((peer) => peer.eid);
          const configRequest: ConfigReadRequest = {
            contractAddress,
            chainKey: sourceChain,
            targetEids,
            deploymentConfig: sourceDeployment,
            peers: peerAnalysis.peers,
          };

          const configs = await getMultiTargetConfigs(configRequest);
          logger.debug("[LayerZero Client] Retrieved multi-target configs", {
            contract: contractAddress,
            sourceChain,
            configKeys: Object.keys(configs),
            totalConfigs: Object.keys(configs).length,
          });

          // Enhance bridge configs with detailed configuration
          bridgeConfigs = peerAnalysis.bridgeConfigs.map((bridgeConfig) => {
            // Find the peer for this target chain
            const targetPeer = peerAnalysis.peers.find(
              (peer) => peer.chainKey === bridgeConfig.toChain,
            );

            if (!targetPeer) {
              logger.warn("[LayerZero Client] No peer found for target chain", {
                targetChain: bridgeConfig.toChain,
                availablePeers: peerAnalysis.peers.map((p) => p.chainKey),
              });
              return bridgeConfig;
            }

            // Find the config using the target peer's EID
            const config = configs[targetPeer.eid];

            if (!config) {
              logger.warn("[LayerZero Client] No config found for target EID", {
                targetEid: targetPeer.eid,
                targetChain: bridgeConfig.toChain,
                availableConfigKeys: Object.keys(configs),
              });
              return bridgeConfig;
            }

            return {
              ...bridgeConfig,
              ...config,
            };
          });
        }
      }

      const result: OFTAnalysisResult = {
        isOFT: contractDetection.isOFT,
        isOFTAdapter: contractDetection.isOFTAdapter,
        contractType: contractDetection.contractType,
        peers: peerAnalysis.peers,
        supportedChains: peerAnalysis.supportedChains,
        bridgeConfigs,
        layerZeroDeployments,
      };

      logger.info("[LayerZero Client] OFT analysis completed", {
        contract: contractAddress,
        sourceChain,
        result: {
          contractType: result.contractType,
          peersCount: result.peers.length,
          supportedChainsCount: result.supportedChains.length,
          bridgeConfigsCount: result.bridgeConfigs.length,
          hasDeploymentConfig: !!result.layerZeroDeployments,
        },
      });

      return result;
    } catch (error) {
      logger.error("[LayerZero Client] Error in OFT analysis", {
        contract: contractAddress,
        sourceChain,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isOFT: false,
        isOFTAdapter: false,
        contractType: "UNKNOWN",
        peers: [],
        supportedChains: [],
        bridgeConfigs: [],
      };
    }
  }

  /**
   * Check if bridging is possible between two specific chains
   */
  static async getBridgeInfo(
    contractAddress: string,
    sourceChain: LayerZeroChainKey,
    targetChain: LayerZeroChainKey,
  ): Promise<{
    isAvailable: boolean;
    directPath: boolean;
    routingPaths?: Array<{
      route: LayerZeroChainKey[];
    }>;
    configuration?: ExecutorAndDVNConfig;
  }> {
    try {
      logger.info("[LayerZero Client] Checking bridge availability", {
        contract: contractAddress,
        sourceChain,
        targetChain,
      });

      // Check direct connectivity first
      const connectivity = await validatePeerConnectivity(
        contractAddress,
        sourceChain,
        targetChain,
      );

      if (connectivity.isConnected) {
        // Get configuration for direct path
        const sourceDeployment = await getChainDeploymentConfig(sourceChain);
        let configuration = undefined;
        if (sourceDeployment) {
          configuration = await getExecutorAndDVNConfigs(
            contractAddress,
            sourceChain,
            connectivity,
            sourceDeployment,
          );
        }

        logger.info("[LayerZero Client] Direct bridge path available", {
          contract: contractAddress,
          sourceChain,
          targetChain,
          hasConfiguration: !!configuration,
        });

        return {
          isAvailable: true,
          directPath: true,
          routingPaths: [
            {
              route: [sourceChain, targetChain],
            },
          ],
          configuration: configuration || undefined,
        };
      }

      logger.info("[LayerZero Client] No bridge paths available", {
        contract: contractAddress,
        sourceChain,
        targetChain,
      });

      return {
        isAvailable: false,
        directPath: false,
        routingPaths: [],
      };
    } catch (error) {
      logger.error("[LayerZero Client] Error checking bridge availability", {
        contract: contractAddress,
        sourceChain,
        targetChain,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAvailable: false,
        directPath: false,
        routingPaths: [],
      };
    }
  }

  /**
   * Get comprehensive bridging information including fees and estimates
   */
  static async checkBridgeAvailability(
    contractAddress: string,
    sourceChain: LayerZeroChainKey,
    targetChain: LayerZeroChainKey,
  ): Promise<{
    isAvailable: boolean;
    directPath: boolean;
    routingPaths?: Array<{
      route: LayerZeroChainKey[];
    }>;
    configuration?: ExecutorAndDVNConfig;
    validation?: {
      isValid: boolean;
      issues: Array<{
        issue: string;
        severity: "warning" | "error";
      }>;
      summary: {
        hasExecutor: boolean;
        hasDVNs: boolean;
        totalDVNs: number;
        confirmations: number;
      };
    };
  }> {
    try {
      logger.info("[LayerZero Client] Getting comprehensive bridge info", {
        contract: contractAddress,
        sourceChain,
        targetChain,
      });

      // Check availability first
      const bridgeInfo = await this.getBridgeInfo(
        contractAddress,
        sourceChain,
        targetChain,
      );

      if (!bridgeInfo.configuration) {
        return {
          isAvailable: false,
          directPath: false,
          routingPaths: [],
        };
      }

      // Validate the configuration
      const validation = validateConfigConsistency(bridgeInfo.configuration);

      // Use validation result to determine availability
      const isAvailable = validation.isValid;

      logger.info("[LayerZero Client] Bridge availability determined", {
        contract: contractAddress,
        sourceChain,
        targetChain,
        isAvailable,
        hasConfiguration: !!bridgeInfo.configuration,
        validationIssues: validation.issues.length,
      });

      return {
        isAvailable,
        directPath: bridgeInfo.directPath,
        routingPaths: bridgeInfo.routingPaths,
        configuration: bridgeInfo.configuration,
        validation,
      };
    } catch (error) {
      logger.error("[LayerZero Client] Error getting bridge info", {
        contract: contractAddress,
        sourceChain,
        targetChain,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAvailable: false,
        directPath: false,
        routingPaths: [],
      };
    }
  }

  /**
   * Validate OFT configuration across all supported chains
   */
  static async validateOFTConfiguration(
    contractAddress: string,
    sourceChain: LayerZeroChainKey,
  ): Promise<{
    isValid: boolean;
    issues: Array<{
      chain: string;
      issue: string;
      severity: "warning" | "error";
    }>;
    summary: {
      totalChains: number;
      validChains: number;
      configurations: number;
    };
  }> {
    try {
      logger.info("[LayerZero Client] Validating OFT configuration", {
        contract: contractAddress,
        sourceChain,
      });

      // Get peer analysis first
      const peerAnalysis = await analyzePeerRelationships(
        contractAddress,
        sourceChain,
      );

      if (peerAnalysis.totalPeers === 0) {
        return {
          isValid: false,
          issues: [
            {
              chain: sourceChain,
              issue: "No peers configured",
              severity: "error",
            },
          ],
          summary: {
            totalChains: 1,
            validChains: 0,
            configurations: 0,
          },
        };
      }

      // Get deployment config
      const sourceDeployment = await getChainDeploymentConfig(sourceChain);

      if (!sourceDeployment) {
        return {
          isValid: false,
          issues: [
            {
              chain: sourceChain,
              issue: "No LayerZero deployment configuration found",
              severity: "error",
            },
          ],
          summary: {
            totalChains: 1,
            validChains: 0,
            configurations: 0,
          },
        };
      }

      // Get configurations first
      const configRequest: ConfigReadRequest = {
        contractAddress,
        chainKey: sourceChain,
        targetEids: peerAnalysis.peers.map((peer) => peer.eid),
        deploymentConfig: sourceDeployment,
        peers: peerAnalysis.peers,
      };

      const configs = await getMultiTargetConfigs(configRequest);

      // Validate configurations individually
      const validations = Object.entries(configs).map(([targetEid, config]) => {
        if (!config) {
          return {
            targetEid,
            isValid: false,
            issues: [
              { issue: "Configuration not found", severity: "error" as const },
            ],
            summary: {
              hasExecutor: false,
              hasDVNs: false,
              totalDVNs: 0,
              confirmations: 0,
            },
          };
        }
        return {
          targetEid,
          ...validateConfigConsistency(config),
        };
      });

      const allValid = validations.every((v) => v.isValid);
      const allIssues = validations.flatMap((v) =>
        (v.issues || []).map((issue) => ({ targetEid: v.targetEid, ...issue })),
      );
      const totalDVNs = validations.reduce(
        (sum, v) => sum + v.summary.totalDVNs,
        0,
      );

      const result = {
        isValid: allValid,
        issues: allIssues.map((inc) => ({
          chain: inc.targetEid,
          issue: inc.issue,
          severity: inc.severity,
        })),
        summary: {
          totalChains: peerAnalysis.supportedChains.length,
          validChains: validations.filter((v) => v.isValid).length,
          configurations: totalDVNs,
        },
      };

      logger.info("[LayerZero Client] OFT configuration validation completed", {
        contract: contractAddress,
        sourceChain,
        isValid: result.isValid,
        issues: result.issues.length,
        summary: result.summary,
      });

      return result;
    } catch (error) {
      logger.error("[LayerZero Client] Error validating OFT configuration", {
        contract: contractAddress,
        sourceChain,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        issues: [
          {
            chain: sourceChain,
            issue: "Configuration validation failed",
            severity: "error",
          },
        ],
        summary: {
          totalChains: 0,
          validChains: 0,
          configurations: 0,
        },
      };
    }
  }
}

// Export functional interfaces for users who prefer non-class approach
export const analyzeOFT = LayerZeroClient.analyzeOFT;
export const checkBridgeAvailability = LayerZeroClient.checkBridgeAvailability;
export const getBridgeInfo = LayerZeroClient.getBridgeInfo;
export const validateOFTConfiguration =
  LayerZeroClient.validateOFTConfiguration;
