import axios, { type AxiosInstance } from "axios";
import type {
  LayerZeroMetadataAPIResponse,
  LayerZeroChainKey,
  DeploymentConfig,
} from "../types";
import {
  LayerZeroMainnetV2EndpointConfig,
  type LayerZeroEndpoint,
} from "../constants";
import logger from "../utils/logger";

// LayerZero metadata API endpoint
const LAYERZERO_METADATA_ENDPOINT =
  "https://metadata.layerzero-api.com/v1/metadata";

/**
 * Create HTTP client for LayerZero metadata API
 */
function createMetadataAPIClient(): AxiosInstance {
  return axios.create({
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "0xDevAI-LayerZero-Client/1.0",
    },
  });
}

/**
 * Get LayerZero deployment configuration for a specific chain
 */
export async function getChainDeploymentConfig(
  chainKey: LayerZeroChainKey,
): Promise<DeploymentConfig | null> {
  try {
    logger.info("[Deployment Reader] Getting deployment config for chain", {
      chain: chainKey,
    });

    const client = createMetadataAPIClient();
    const response = await client.get<LayerZeroMetadataAPIResponse>(
      LAYERZERO_METADATA_ENDPOINT,
    );
    if (!response.data || typeof response.data !== "object") {
      logger.warn("[Deployment Reader] Invalid metadata API response", {
        chain: chainKey,
        responseType: typeof response.data,
      });
      return null;
    }
    const dvns = response.data[chainKey].dvns;
    const deploymentConfigs = response.data[chainKey].deployments;
    const deploymentConfig = deploymentConfigs.find((config) =>
      Object.keys(config).includes("endpointV2"),
    );

    if (!deploymentConfig) {
      logger.warn("[Deployment Reader] No deployment config found for chain", {
        chain: chainKey,
      });
      return null;
    }

    logger.info("[Deployment Reader] Retrieved deployment config", {
      chain: chainKey,
      hasEndpointV2: !!deploymentConfig.endpointV2,
      hasSendUln302: !!deploymentConfig.sendUln302,
      hasReceiveUln302: !!deploymentConfig.receiveUln302,
      hasExecutor: !!deploymentConfig.executor,
      dvnCount: dvns ? Object.keys(dvns).length : 0,
    });

    return deploymentConfig;
  } catch (error) {
    logger.error("[Deployment Reader] Error getting deployment config", {
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get all available LayerZero deployment configurations
 */
export async function getAllDeploymentConfigs(): Promise<LayerZeroMetadataAPIResponse | null> {
  try {
    logger.info("[Deployment Reader] Getting all deployment configs");

    const client = createMetadataAPIClient();
    const response = await client.get<LayerZeroMetadataAPIResponse>(
      LAYERZERO_METADATA_ENDPOINT,
    );

    if (!response.data || typeof response.data !== "object") {
      logger.warn("[Deployment Reader] Invalid metadata API response", {
        responseType: typeof response.data,
      });
      return null;
    }

    const chainCount = Object.keys(response.data).length;

    logger.info("[Deployment Reader] Retrieved all deployment configs", {
      totalChains: chainCount,
    });

    return response.data;
  } catch (error) {
    logger.error("[Deployment Reader] Error getting all deployment configs", {
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get essential LayerZero deployment addresses for a chain
 */
export async function getEssentialDeploymentAddresses(
  chainKey: LayerZeroChainKey,
): Promise<{
  endpointV2?: string;
  sendUln301?: string;
  receiveUln301?: string;
  executor?: string;
} | null> {
  try {
    const deploymentConfig = await getChainDeploymentConfig(chainKey);

    if (!deploymentConfig) {
      return null;
    }

    const addresses = {
      endpointV2: deploymentConfig.endpointV2?.address,
      sendUln301: deploymentConfig.sendUln301?.address,
      receiveUln301: deploymentConfig.receiveUln301?.address,
      executor: deploymentConfig.executor?.address,
    };

    logger.debug("[Deployment Reader] Extracted essential addresses", {
      chain: chainKey,
      addresses,
    });

    return addresses;
  } catch (error) {
    logger.error(
      "[Deployment Reader] Error getting essential deployment addresses",
      {
        chain: chainKey,
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return null;
  }
}

/**
 * Validate LayerZero chain support and get EID
 */
export function validateChainSupport(chainKey: string): {
  isSupported: boolean;
  eid?: string;
  config?: LayerZeroEndpoint;
} {
  const config =
    chainKey in LayerZeroMainnetV2EndpointConfig
      ? LayerZeroMainnetV2EndpointConfig[chainKey as LayerZeroChainKey]
      : undefined;

  if (!config) {
    return { isSupported: false };
  }

  return {
    isSupported: true,
    eid: config.eid,
    config,
  };
}
