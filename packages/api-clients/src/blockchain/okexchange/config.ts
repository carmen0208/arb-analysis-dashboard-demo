/**
 * OKX DEX API Configuration Management
 * Handles configuration interface definitions, environment variable parsing, and configuration validation
 */

import {
  getLogger,
  Logger,
  validateEnvForService,
  maskSensitiveValue,
} from "@dex-ai/core";
const logger: Logger = getLogger("blockchain-okexchange");

/**
 * OKX DEX API Configuration Interface
 */
export interface OkxDexConfig {
  apiKey: string;
  secretKey: string;
  apiPassphrase: string;
  projectId: string;
}

/**
 * OKX DEX Multi-Configuration Interface (for rotation)
 */
export interface OkxDexMultiConfig {
  configs: OkxDexConfig[];
  rotationEnabled?: boolean;
}

/**
 * Get default configuration from environment variables
 */
export const getDefaultOkxDexConfig = (): OkxDexConfig => {
  try {
    const envConfig = validateEnvForService("okxDex");
    return {
      apiKey: envConfig.OKX_ACCESS_DEX_API_KEY,
      secretKey: envConfig.OKX_ACCESS_DEX_SECRET_KEY,
      apiPassphrase: envConfig.OKX_ACCESS_DEX_PASSPHRASE,
      projectId: envConfig.OKX_ACCESS_DEX_PROJECT_ID,
    };
  } catch (error) {
    logger.warn(
      "[OKX DEX Config] Environment validation failed, using fallback",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return {
      apiKey: process.env.OKX_ACCESS_DEX_API_KEY || "",
      secretKey: process.env.OKX_ACCESS_DEX_SECRET_KEY || "",
      apiPassphrase: process.env.OKX_ACCESS_DEX_PASSPHRASE || "",
      projectId: process.env.OKX_ACCESS_DEX_PROJECT_ID || "",
    };
  }
};

/**
 * Get multi-configuration from environment variables (for rotation)
 * Supports format: OKX_ACCESS_DEX_CONFIGS=key1:secret1:passphrase1:project1,key2:secret2:passphrase2:project2
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
 * Validate configuration completeness
 */
export const validateConfig = (config: OkxDexConfig): void => {
  const { apiKey, secretKey, apiPassphrase, projectId } = config;
  if (!apiKey || !secretKey || !apiPassphrase || !projectId) {
    throw new Error("Missing required OKX DEX configuration");
  }

  // Log masked values for debugging
  logger.debug("[OKX DEX Config] Validating configuration", {
    apiKeyMasked: maskSensitiveValue(apiKey),
    hasSecret: !!secretKey,
    hasPassphrase: !!apiPassphrase,
    hasProjectId: !!projectId,
  });
};

/**
 * Configuration Constants
 */
export const OKX_CONFIG_CONSTANTS = {
  // OKX DEX Rate Limit: 1 call per minute
  // RATE_LIMIT_WINDOW: 60000, // 60 seconds
  RATE_LIMIT_WINDOW: 1000, // 1 second
  MAX_WAIT_TIME: 65000, // Maximum wait time: 65 seconds (slightly longer than rate limit window)
  API_BASE_URL: "https://web3.okx.com/api/v5/",
} as const;

export const DEFAULT_SLIPPAGE = "0.005"; // Default 0.5%
