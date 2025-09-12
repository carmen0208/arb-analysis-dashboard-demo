import axios, { type AxiosInstance } from "axios";
import type { LayerZeroAPIResponse } from "../types";
import type { LayerZeroChainKey } from "../constants";
import logger from "../utils/logger";

// LayerZero API endpoints
const LAYERZERO_API_BASE = "https://metadata.layerzero-api.com/v1/metadata";
const LAYERZERO_OFT_LIST_ENDPOINT = `${LAYERZERO_API_BASE}/experiment/ofts/list`;

/**
 * Create HTTP client for LayerZero API
 */
function createLayerZeroAPIClient(): AxiosInstance {
  return axios.create({
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "0xDevAI-LayerZero-Client/1.0",
    },
  });
}

/**
 * Get OFT information from LayerZero API using direct contract address filter
 */
export async function getOFTInfoFromAPI(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<LayerZeroAPIResponse | null> {
  try {
    logger.info("[API Detection] Getting OFT info from LayerZero API", {
      contract: contractAddress,
      chain: chainKey,
    });

    const client = createLayerZeroAPIClient();
    // Use contractAddresses parameter to filter directly
    const url = `${LAYERZERO_OFT_LIST_ENDPOINT}?chainNames=${chainKey}&contractAddresses=${contractAddress}`;

    logger.debug(
      "[API Detection] Fetching OFT info from API with contract filter",
      {
        url,
        contract: contractAddress,
        chain: chainKey,
      },
    );

    const response = await client.get<LayerZeroAPIResponse>(url);

    if (!response.data || typeof response.data !== "object") {
      return null;
    }

    const tokenCount = Object.keys(response.data).length;

    if (tokenCount === 0) {
      logger.debug("[API Detection] No OFT info found for contract", {
        contract: contractAddress,
        chain: chainKey,
      });
      return null;
    }

    // Return the raw API response format as requested
    logger.info("[API Detection] Retrieved OFT info from API", {
      contract: contractAddress,
      chain: chainKey,
      tokensFound: tokenCount,
    });

    return response.data;
  } catch (error) {
    logger.error("[API Detection] Error getting OFT info from API", {
      contract: contractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
