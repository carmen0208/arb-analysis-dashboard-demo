/**
 * OKX DEX API 认证和签名工具
 * 处理OKX API请求的签名生成
 */

import CryptoJS from "crypto-js";
import { OkxDexConfig, validateConfig } from "./config";

/**
 * 生成OKX DEX API请求头（带签名）
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
 * 创建带签名的请求头的便捷函数
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
