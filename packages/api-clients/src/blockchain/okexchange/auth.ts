/**
 * OKX DEX API authentication and signing utilities
 * Handles OKX API request signature generation
 */

import CryptoJS from "crypto-js";
import { OkxDexConfig, validateConfig } from "./config";

/**
 * Generate OKX DEX API request headers (with signature)
 */
export const createOkxDexHeaders =
  (config: OkxDexConfig) =>
  (
    timestamp: string,
    method: string,
    requestPath: string,
    queryString = "",
  ): Record<string, string> => {
    validateConfig(config);

    const stringToSign = timestamp + method + requestPath + queryString;

    return {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": config.apiKey,
      "OK-ACCESS-SIGN": CryptoJS.enc.Base64.stringify(
        CryptoJS.HmacSHA256(stringToSign, config.secretKey),
      ),
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": config.apiPassphrase,
      "OK-ACCESS-PROJECT": config.projectId,
    };
  };

/**
 * Convenience function to create request headers with signature
 */
export const createSignedHeaders = (
  config: OkxDexConfig,
  method: string,
  requestPath: string,
  queryString?: string,
): Record<string, string> => {
  const timestamp = new Date().toISOString();
  const headerGenerator = createOkxDexHeaders(config);
  return headerGenerator(timestamp, method, requestPath, queryString);
};
