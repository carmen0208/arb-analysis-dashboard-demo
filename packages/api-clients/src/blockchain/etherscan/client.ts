/**
 * Axios API Client Configuration for Etherscan V2
 */
import axios, { AxiosInstance } from "axios";
import { getLogger, Logger } from "@dex-ai/core";
import { CHAIN_CONFIG, ChainId, ETHERSCAN_V2_BASE_URL } from "./constants";
import dotenv from "dotenv";

dotenv.config();

const logger: Logger = getLogger("etherscan-client");

/**
 * Creates an Axios instance with appropriate headers and config for Etherscan V2 API
 * All chains now use the same unified API endpoint with chainid parameter
 */
export function createApiClient(
  chainId: ChainId,
  apiKey: string,
): AxiosInstance {
  const chainConfig = CHAIN_CONFIG[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    logger.info("[Etherscan V2 Client] Using API Key for chain", {
      chainId,
      chainName: chainConfig.name,
    });
  } else {
    logger.warn(
      "[Etherscan V2 Client] API Key not set for chain. Rate limits may apply",
      { chainId, chainName: chainConfig.name },
    );
  }

  return axios.create({
    baseURL: ETHERSCAN_V2_BASE_URL,
    headers: headers,
    timeout: 30000, // 30 second timeout for blockchain API calls
  });
}

/**
 * Get API key for specific chain
 */
export function getApiKey(chainId: ChainId): string {
  const chainConfig = CHAIN_CONFIG[chainId];
  const envVarName = `${chainConfig.name.toUpperCase()}_ETHERSCAN_API_KEY`;
  return process.env[envVarName] || process.env.ETHERSCAN_API_KEY || "";
}

/**
 * Create API client for specific chain
 */
export function getApiClient(chainId: ChainId): AxiosInstance {
  const apiKey = getApiKey(chainId);
  return createApiClient(chainId, apiKey);
}

// Pre-configured clients for common chains
export const bscClient = getApiClient(ChainId.BSC);
export const ethereumClient = getApiClient(ChainId.ETHEREUM);
