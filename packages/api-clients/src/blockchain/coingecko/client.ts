/**
 * Axios API Client Configuration for CoinGecko
 */
import axios, { AxiosInstance } from "axios";
import logger from "../../common/logger";
import { COINGECKO_BASE_URL } from "./constants";
import dotenv from "dotenv";

dotenv.config();

/**
 * Creates an Axios instance with appropriate headers and config for CoinGecko API
 */
export function createApiClient(apiKey: string): AxiosInstance {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
    logger.info("[CoinGecko Client] Using API Key from environment variable");
  } else {
    logger.warn(
      "[CoinGecko Client] COINGECKO_API_KEY not set. Using public API (rate limits may apply)",
    );
  }

  return axios.create({
    baseURL: COINGECKO_BASE_URL,
    headers: headers,
    timeout: 15000, // Default timeout
  });
}

// Singleton API client instance
const apiKey = process.env.COINGECKO_API_KEY || "";
export const apiClient = createApiClient(apiKey);
