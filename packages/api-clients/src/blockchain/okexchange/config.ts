/**
 * OKX DEX API 配置管理
 * 处理配置接口定义、环境变量解析和配置验证
 */

import { getLogger, Logger } from "@dex-ai/core";
const logger: Logger = getLogger("blockchain-okexchange");

/**
 * OKX DEX API配置接口
 */
export interface OkxDexConfig {
  apiKey: string;
  secretKey: string;
  apiPassphrase: string;
  projectId: string;
}

/**
 * OKX DEX多配置接口（用于轮换）
 */
export interface OkxDexMultiConfig {
  configs: OkxDexConfig[];
  rotationEnabled?: boolean;
}

/**
 * 从环境变量获取默认配置
 */
export const getDefaultOkxDexConfig = (): OkxDexConfig => ({
  apiKey: process.env.OKX_ACCESS_DEX_API_KEY || "",
  secretKey: process.env.OKX_ACCESS_DEX_SECRET_KEY || "",
  apiPassphrase: process.env.OKX_ACCESS_DEX_PASSPHRASE || "",
  projectId: process.env.OKX_ACCESS_DEX_PROJECT_ID || "",
});

/**
 * 从环境变量获取多配置（用于轮换）
 * 支持格式：OKX_ACCESS_DEX_CONFIGS=key1:secret1:passphrase1:project1,key2:secret2:passphrase2:project2
 */
export const getMultiOkxDexConfigFromEnv = (): OkxDexMultiConfig => {
  const configsEnv = process.env.OKX_ACCESS_DEX_CONFIGS;

  if (!configsEnv) {
    // Fallback to single config
    const singleConfig = getDefaultOkxDexConfig();
    return {
      configs: singleConfig.apiKey ? [singleConfig] : [],
      rotationEnabled: false,
    };
  }

  try {
    const configs = configsEnv
      .split(",")
      .map((configStr) => {
        const [apiKey, secretKey, apiPassphrase, projectId] = configStr
          .trim()
          .split(":");
        return { apiKey, secretKey, apiPassphrase, projectId };
      })
      .filter(
        (config) =>
          config.apiKey &&
          config.secretKey &&
          config.apiPassphrase &&
          config.projectId,
      );

    logger.debug(
      `[OKX DEX Config] Found ${configs.length} API configurations for rotation`,
    );

    return {
      configs,
      rotationEnabled: configs.length > 1,
    };
  } catch (error) {
    logger.error(
      "[OKX DEX Config] Error parsing multi-config from environment",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    // Fallback to single config
    const singleConfig = getDefaultOkxDexConfig();
    return {
      configs: singleConfig.apiKey ? [singleConfig] : [],
      rotationEnabled: false,
    };
  }
};

/**
 * 验证配置是否完整
 */
export const validateConfig = (config: OkxDexConfig): void => {
  const { apiKey, secretKey, apiPassphrase, projectId } = config;
  if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
    throw new Error("Missing required OKX DEX configuration");
  }
};

/**
 * 配置常量
 */
export const OKX_CONFIG_CONSTANTS = {
  // OKX DEX 率限：1分钟1次调用
  // RATE_LIMIT_WINDOW: 60000, // 60秒
  RATE_LIMIT_WINDOW: 1000, // 1秒
  MAX_WAIT_TIME: 65000, // 最大等待时间：65秒（比率限窗口稍长）
  API_BASE_URL: "https://web3.okx.com/api/v5/",
} as const;

export const DEFAULT_SLIPPAGE = "0.005"; // 默认0.5%
