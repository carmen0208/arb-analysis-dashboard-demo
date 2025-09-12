import Moralis from "moralis";
import dotenv from "dotenv";
import axios, { AxiosInstance } from "axios";
import logger from "../../common/logger";

dotenv.config();

let moralisStarted = false;
const MORALIS_BASE_URL = "https://deep-index.moralis.io/api/v2.2";
const MORALIS_SOLANA_BASE_URL = "https://solana-gateway.moralis.io";
const apiKey = process.env.MORALIS_API_KEY || "";
/**
 * Initializes Moralis SDK if not already started and returns the Moralis instance.
 * Loads the API key from process.env.MORALIS_API_KEY.
 */
export async function createMoralisClient(): Promise<typeof Moralis> {
  if (!moralisStarted) {
    if (apiKey === "") {
      throw new Error("MORALIS_API_KEY is not set in environment variables");
    }
    await Moralis.start({ apiKey });
    moralisStarted = true;
  }
  return Moralis;
}

/**
 * Creates an Axios instance with appropriate headers and config for MORALIS API
 */
export function createApiClient({
  apiKey,
  baseURL,
}: {
  apiKey: string;
  baseURL: string;
}): AxiosInstance {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    logger.info("[MORALIS Client] Using API Key from environment variable");
  } else {
    logger.warn(
      "[MORALIS Client] MORALIS_API_KEY not set. Using public API (rate limits may apply)",
    );
  }

  return axios.create({
    baseURL,
    headers: headers,
    timeout: 15000, // Default timeout
  });
}

// Singleton API client instance
export const apiClient = createApiClient({ apiKey, baseURL: MORALIS_BASE_URL });
export const solanaApiClient = createApiClient({
  apiKey,
  baseURL: MORALIS_SOLANA_BASE_URL,
});
