import { type Address, getContract, decodeAbiParameters } from "viem";
import { multicall } from "viem/actions";
import type {
  ExecutorAndDVNConfig,
  ExecutorConfig,
  ULNConfig,
  LayerZeroChainKey,
  ConfigReadRequest,
  DeploymentConfig,
  PeerConnectivity,
} from "../types";
import { createPublicClientForChain } from "../utils/viemClients";
import { getChainDeploymentConfig } from "./deploymentReader";
import logger from "../utils/logger";
// LayerZero Endpoint V2 ABI - corrected functions for configuration reading
const ENDPOINT_V2_ABI = [
  {
    name: "getConfig",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_oapp", type: "address" },
      { name: "_lib", type: "address" },
      { name: "_eid", type: "uint32" },
      { name: "_configType", type: "uint32" },
    ],
    outputs: [{ name: "config", type: "bytes" }],
  },
  {
    name: "getSendLibrary",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "srcEid", type: "uint32" },
    ],
    outputs: [{ name: "lib", type: "address" }],
  },
  {
    name: "getReceiveLibrary",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "srcEid", type: "uint32" },
    ],
    outputs: [{ name: "lib", type: "address" }],
  },
] as const;

// Configuration types for LayerZero V2
const CONFIG_TYPES = {
  EXECUTOR: 1,
  ULN: 2,
} as const;

// ABI structures for decoding configuration data
const EXECUTOR_CONFIG_ABI = [
  {
    type: "tuple",
    components: [
      { name: "maxMessageSize", type: "uint32" },
      { name: "executorAddress", type: "address" },
    ],
  },
] as const;

const ULN_CONFIG_ABI = [
  {
    type: "tuple",
    components: [
      { name: "confirmations", type: "uint64" },
      { name: "requiredDVNCount", type: "uint8" },
      { name: "optionalDVNCount", type: "uint8" },
      { name: "optionalDVNThreshold", type: "uint8" },
      { name: "requiredDVNs", type: "address[]" },
      { name: "optionalDVNs", type: "address[]" },
    ],
  },
] as const;

/**
 * Read executor configuration from LayerZero endpoint using correct V2 approach
 */
export async function getExecutorConfiguration(
  oftContractAddress: string,
  sourceChain: LayerZeroChainKey,
  targetEid: string,
  deploymentConfig: DeploymentConfig,
  sendLibAddress: string,
): Promise<ExecutorConfig | null> {
  try {
    logger.debug("[Config Reader] Reading executor configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
    });

    if (!deploymentConfig.endpointV2?.address) {
      logger.warn("[Config Reader] No endpoint V2 address found", {
        sourceChain,
        deploymentConfig,
      });
      return null;
    }

    const client = createPublicClientForChain(sourceChain);
    const endpointContract = getContract({
      address: deploymentConfig.endpointV2.address as Address,
      abi: ENDPOINT_V2_ABI,
      client,
    });

    logger.debug("[Config Reader] Using provided send library address", {
      contract: oftContractAddress,
      sendLibAddress,
    });

    // Step 2: Get executor configuration using getConfig with type 1 (EXECUTOR)
    const executorConfigBytes = await endpointContract.read.getConfig([
      oftContractAddress as Address,
      sendLibAddress as Address,
      parseInt(targetEid),
      CONFIG_TYPES.EXECUTOR,
    ]);

    logger.debug("[Config Reader] Retrieved executor config bytes", {
      contract: oftContractAddress,
      targetEid,
      configBytes: executorConfigBytes,
    });

    if (!executorConfigBytes || executorConfigBytes === "0x") {
      logger.debug("[Config Reader] No executor config found", {
        contract: oftContractAddress,
        sourceChain,
        targetEid,
      });
      return null;
    }

    // Step 3: Decode the executor configuration
    const [decodedConfig] = decodeAbiParameters(
      EXECUTOR_CONFIG_ABI,
      executorConfigBytes,
    );

    const executorConfig: ExecutorConfig = {
      executorAddress: decodedConfig.executorAddress,
      maxMessageSize: Number(decodedConfig.maxMessageSize),
      executorFeeCap: "0", // Fee cap would need additional contract call
    };

    logger.debug("[Config Reader] Retrieved executor configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
      executorConfig,
    });

    return executorConfig;
  } catch (error) {
    logger.error("[Config Reader] Error reading executor configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Read send and receive ULN configuration from LayerZero endpoint using correct V2 approach
 */
export async function getDVNConfiguration(
  oftContractAddress: string,
  sourceChain: LayerZeroChainKey,
  targetEid: string,
  deploymentConfig: DeploymentConfig,
  sendLibAddress: string,
  receiveLibAddress: string,
): Promise<{
  sendUlnConfig: ULNConfig | null;
  receiveUlnConfig: ULNConfig | null;
} | null> {
  try {
    logger.debug("[Config Reader] Reading DVN configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
    });

    if (!deploymentConfig.endpointV2?.address) {
      logger.warn("[Config Reader] No endpoint V2 address found", {
        sourceChain,
        deploymentConfig,
      });
      return null;
    }

    const client = createPublicClientForChain(sourceChain);
    const endpointContract = getContract({
      address: deploymentConfig.endpointV2.address as Address,
      abi: ENDPOINT_V2_ABI,
      client,
    });

    logger.debug("[Config Reader] Using provided library addresses", {
      contract: oftContractAddress,
      sendLibAddress,
      receiveLibAddress,
    });

    // Step 2: Get ULN configurations for both send and receive
    const [sendUlnConfigBytes, receiveUlnConfigBytes] = await Promise.all([
      endpointContract.read.getConfig([
        oftContractAddress as Address,
        sendLibAddress as Address,
        parseInt(targetEid),
        CONFIG_TYPES.ULN,
      ]),
      endpointContract.read.getConfig([
        oftContractAddress as Address,
        receiveLibAddress as Address,
        parseInt(targetEid),
        CONFIG_TYPES.ULN,
      ]),
    ]);

    logger.debug("[Config Reader] Retrieved ULN config bytes", {
      contract: oftContractAddress,
      targetEid,
      sendConfigBytes: sendUlnConfigBytes,
      receiveConfigBytes: receiveUlnConfigBytes,
    });

    // Step 3: Decode send ULN configuration
    let sendUlnConfig: ULNConfig | null = null;
    if (sendUlnConfigBytes && sendUlnConfigBytes !== "0x") {
      try {
        const [decodedSendConfig] = decodeAbiParameters(
          ULN_CONFIG_ABI,
          sendUlnConfigBytes,
        );

        sendUlnConfig = {
          confirmations: Number(decodedSendConfig.confirmations),
          requiredDVNs: decodedSendConfig.requiredDVNs,
          optionalDVNs: decodedSendConfig.optionalDVNs,
          optionalDVNThreshold: Number(decodedSendConfig.optionalDVNThreshold),
        };
      } catch (decodeError) {
        logger.warn("[Config Reader] Failed to decode send ULN config", {
          contract: oftContractAddress,
          error:
            decodeError instanceof Error
              ? decodeError.message
              : String(decodeError),
        });
      }
    }

    // Step 4: Decode receive ULN configuration
    let receiveUlnConfig: ULNConfig | null = null;
    if (receiveUlnConfigBytes && receiveUlnConfigBytes !== "0x") {
      try {
        const [decodedReceiveConfig] = decodeAbiParameters(
          ULN_CONFIG_ABI,
          receiveUlnConfigBytes,
        );

        receiveUlnConfig = {
          confirmations: Number(decodedReceiveConfig.confirmations),
          requiredDVNs: decodedReceiveConfig.requiredDVNs,
          optionalDVNs: decodedReceiveConfig.optionalDVNs,
          optionalDVNThreshold: Number(
            decodedReceiveConfig.optionalDVNThreshold,
          ),
        };
      } catch (decodeError) {
        logger.warn("[Config Reader] Failed to decode receive ULN config", {
          contract: oftContractAddress,
          error:
            decodeError instanceof Error
              ? decodeError.message
              : String(decodeError),
        });
      }
    }

    const result = {
      sendUlnConfig,
      receiveUlnConfig,
    };

    logger.debug("[Config Reader] Retrieved DVN configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
      sendConfig: sendUlnConfig
        ? {
            confirmations: sendUlnConfig.confirmations,
            requiredDVNCount: sendUlnConfig.requiredDVNs.length,
            optionalDVNCount: sendUlnConfig.optionalDVNs.length,
            optionalDVNThreshold: sendUlnConfig.optionalDVNThreshold,
          }
        : null,
      receiveConfig: receiveUlnConfig
        ? {
            confirmations: receiveUlnConfig.confirmations,
            requiredDVNCount: receiveUlnConfig.requiredDVNs.length,
            optionalDVNCount: receiveUlnConfig.optionalDVNs.length,
            optionalDVNThreshold: receiveUlnConfig.optionalDVNThreshold,
          }
        : null,
    });

    return result;
  } catch (error) {
    logger.error("[Config Reader] Error reading DVN configuration", {
      contract: oftContractAddress,
      sourceChain,
      targetEid,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get comprehensive executor and DVN configuration for a specific target in LayerZero OApp format
 */
export async function getExecutorAndDVNConfigs(
  contractAddress: string,
  sourceChain: LayerZeroChainKey,
  peer: PeerConnectivity,
  _deploymentConfig?: DeploymentConfig,
): Promise<ExecutorAndDVNConfig | null> {
  const { peerAddress, targetEid } = peer;
  try {
    logger.info("[Config Reader] Getting comprehensive config", {
      contract: contractAddress,
      sourceChain,
      targetEid,
    });

    // Get deployment config for source chain
    const deploymentConfig =
      _deploymentConfig || (await getChainDeploymentConfig(sourceChain));

    if (!deploymentConfig) {
      logger.warn(
        "[Config Reader] No deployment config found for source chain",
        {
          sourceChain,
        },
      );
      return null;
    }

    // First get library address to avoid duplicate calls
    const client = createPublicClientForChain(sourceChain);
    // Use multicall to get library address
    const [sendLibAddress, receiveLibAddress] = await multicall(client, {
      contracts: [
        {
          address: deploymentConfig.endpointV2.address as Address,
          abi: ENDPOINT_V2_ABI,
          functionName: "getSendLibrary",
          args: [peerAddress as Address, parseInt(targetEid)],
        },
        {
          address: deploymentConfig.endpointV2.address as Address,
          abi: ENDPOINT_V2_ABI,
          functionName: "getReceiveLibrary",
          args: [peerAddress as Address, parseInt(targetEid)],
        },
      ],
      allowFailure: false,
    });

    logger.debug("[Config Reader] Retrieved library addresses", {
      contract: contractAddress,
      sendLibAddress,
      receiveLibAddress,
    });

    // Get both executor and DVN configurations in parallel using the library addresses
    const [executorConfig, dvnConfigResult] = await Promise.all([
      getExecutorConfiguration(
        contractAddress,
        sourceChain,
        targetEid,
        deploymentConfig,
        sendLibAddress,
      ),
      getDVNConfiguration(
        contractAddress,
        sourceChain,
        targetEid,
        deploymentConfig,
        sendLibAddress,
        receiveLibAddress,
      ),
    ]);

    if (!executorConfig || !dvnConfigResult) {
      logger.warn("[Config Reader] Missing executor or DVN configuration", {
        contract: contractAddress,
        sourceChain,
        targetEid,
        hasExecutorConfig: !!executorConfig,
        hasDvnConfigResult: !!dvnConfigResult,
      });
      return null;
    }

    const { sendUlnConfig, receiveUlnConfig } = dvnConfigResult;

    if (!sendUlnConfig || !receiveUlnConfig) {
      logger.warn("[Config Reader] No valid ULN configuration found", {
        contract: contractAddress,
        sourceChain,
        targetEid,
        hasSendConfig: !!sendUlnConfig,
        hasReceiveConfig: !!receiveUlnConfig,
      });
      return null;
    }

    // Use already obtained library address

    // Construct Sender OApp Config
    const senderOAppConfig = {
      sendLibrary: sendLibAddress,
      sendLibVersion: "V302", // Derived from deployment config
      executor: executorConfig.executorAddress,
      requiredDVNs: sendUlnConfig.requiredDVNs,
      requiredDVNCount: sendUlnConfig.requiredDVNs.length,
      optionalDVNs: sendUlnConfig.optionalDVNs,
      optionalDVNCount: sendUlnConfig.optionalDVNs.length,
      optionalDVNThreshold: sendUlnConfig.optionalDVNThreshold,
      confirmations: sendUlnConfig.confirmations,
    };

    // Construct Receiver OApp Config
    const receiverOAppConfig = {
      ...senderOAppConfig, // Share most configurations
      receiveLibrary: receiveLibAddress,
      receiveLibVersion: "V302", // Derived from deployment config
      requiredDVNs: receiveUlnConfig.requiredDVNs,
      requiredDVNCount: receiveUlnConfig.requiredDVNs.length,
      optionalDVNs: receiveUlnConfig.optionalDVNs,
      optionalDVNCount: receiveUlnConfig.optionalDVNs.length,
      optionalDVNThreshold: receiveUlnConfig.optionalDVNThreshold,
      confirmations: receiveUlnConfig.confirmations,
    };

    const result: ExecutorAndDVNConfig = {
      senderOAppConfig,
      receiverOAppConfig,
    };

    logger.info("[Config Reader] Comprehensive OApp config retrieved", {
      contract: contractAddress,
      sourceChain,
      targetEid,
      summary: {
        hasExecutor: !!executorConfig,
        hasSendUlnConfig: !!sendUlnConfig,
        hasReceiveUlnConfig: !!receiveUlnConfig,
        senderRequiredDVNs: senderOAppConfig.requiredDVNCount,
        senderOptionalDVNs: senderOAppConfig.optionalDVNCount,
        receiverRequiredDVNs: receiverOAppConfig.requiredDVNCount,
        receiverOptionalDVNs: receiverOAppConfig.optionalDVNCount,
        senderConfirmations: senderOAppConfig.confirmations,
        receiverConfirmations: receiverOAppConfig.confirmations,
      },
    });

    return result;
  } catch (error) {
    logger.error("[Config Reader] Error getting comprehensive config", {
      contract: contractAddress,
      sourceChain,
      targetEid,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get configurations for multiple target EIDs efficiently using multicall
 */
export async function getMultiTargetConfigs(
  request: ConfigReadRequest,
): Promise<Record<string, ExecutorAndDVNConfig | null>> {
  try {
    logger.info("[Config Reader] Getting multi-target configurations", {
      contract: request.contractAddress,
      sourceChain: request.chainKey,
      targetCount: request.targetEids.length,
    });

    const results: Record<string, ExecutorAndDVNConfig | null> = {};

    // Process each target EID
    for (const targetEid of request.targetEids) {
      // Find the corresponding peer for this target EID
      const peer = request.peers.find((p) => p.eid === targetEid);
      if (!peer) {
        logger.warn("[Config Reader] No peer found for target EID", {
          targetEid,
          contract: request.contractAddress,
        });
        results[targetEid] = null;
        continue;
      }

      const config = await getExecutorAndDVNConfigs(
        request.contractAddress,
        request.chainKey as LayerZeroChainKey,
        {
          peerAddress: peer.peerAddress,
          targetEid,
        } as PeerConnectivity,
        request.deploymentConfig,
      );

      results[targetEid] = config;
    }

    const successCount = Object.values(results).filter(Boolean).length;

    logger.info("[Config Reader] Multi-target configurations completed", {
      contract: request.contractAddress,
      sourceChain: request.chainKey,
      total: request.targetEids.length,
      successful: successCount,
      failed: request.targetEids.length - successCount,
    });

    return results;
  } catch (error) {
    logger.error("[Config Reader] Error getting multi-target configurations", {
      contract: request.contractAddress,
      sourceChain: request.chainKey,
      targetEids: request.targetEids,
      error: error instanceof Error ? error.message : String(error),
    });

    return request.targetEids.reduce(
      (acc, eid) => ({ ...acc, [eid]: null }),
      {},
    );
  }
}

/**
 * Validate a single ExecutorAndDVNConfig for consistency
 */
export function validateConfigConsistency(config: ExecutorAndDVNConfig): {
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
} {
  try {
    logger.info("[Config Reader] Validating single configuration");

    const issues: Array<{
      issue: string;
      severity: "warning" | "error";
    }> = [];

    // Check executor configuration
    if (
      !config.senderOAppConfig.executor ||
      config.senderOAppConfig.executor ===
        "0x0000000000000000000000000000000000000000"
    ) {
      issues.push({
        issue: "Invalid or missing executor address",
        severity: "error",
      });
    }

    // Check DVN configurations
    if (
      config.senderOAppConfig.requiredDVNCount === 0 &&
      config.senderOAppConfig.optionalDVNCount === 0
    ) {
      issues.push({
        issue: "No DVN configurations found",
        severity: "error",
      });
    }

    if (
      config.senderOAppConfig.requiredDVNs.length === 0 &&
      config.senderOAppConfig.optionalDVNs.length === 0
    ) {
      issues.push({
        issue: "No DVNs configured",
        severity: "error",
      });
    }

    // Check confirmations
    if (config.senderOAppConfig.confirmations === 0) {
      issues.push({
        issue: "Zero confirmations required",
        severity: "warning",
      });
    }

    if (config.receiverOAppConfig.confirmations === 0) {
      issues.push({
        issue: "Zero receiver confirmations required",
        severity: "warning",
      });
    }

    // Check library addresses
    if (
      !config.senderOAppConfig.sendLibrary ||
      config.senderOAppConfig.sendLibrary ===
        "0x0000000000000000000000000000000000000000"
    ) {
      issues.push({
        issue: "Invalid or missing send library address",
        severity: "error",
      });
    }

    if (
      !config.receiverOAppConfig.receiveLibrary ||
      config.receiverOAppConfig.receiveLibrary ===
        "0x0000000000000000000000000000000000000000"
    ) {
      issues.push({
        issue: "Invalid or missing receive library address",
        severity: "error",
      });
    }

    const isValid = issues.filter((i) => i.severity === "error").length === 0;
    const totalDVNs =
      config.senderOAppConfig.requiredDVNCount +
      config.senderOAppConfig.optionalDVNCount;

    const result = {
      isValid,
      issues,
      summary: {
        hasExecutor:
          !!config.senderOAppConfig.executor &&
          config.senderOAppConfig.executor !==
            "0x0000000000000000000000000000000000000000",
        hasDVNs: totalDVNs > 0,
        totalDVNs,
        confirmations: Math.min(
          config.senderOAppConfig.confirmations,
          config.receiverOAppConfig.confirmations,
        ),
      },
    };

    logger.info("[Config Reader] Single configuration validation completed", {
      isValid,
      issues: issues.length,
      summary: result.summary,
    });

    return result;
  } catch (error) {
    logger.error("[Config Reader] Error validating single configuration", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      isValid: false,
      issues: [
        {
          issue: "Validation failed due to error",
          severity: "error",
        },
      ],
      summary: {
        hasExecutor: false,
        hasDVNs: false,
        totalDVNs: 0,
        confirmations: 0,
      },
    };
  }
}
