import { z } from "zod";
import { getLogger, Logger } from "../logger";

const logger: Logger = getLogger("env-validator");

/**
 * Environment variable validation schemas
 */
export const EnvSchemas = {
  // OKX DEX API credentials
  okxDex: z.object({
    OKX_ACCESS_DEX_API_KEY: z.string().min(1, "OKX DEX API key is required"),
    OKX_ACCESS_DEX_SECRET_KEY: z
      .string()
      .min(1, "OKX DEX secret key is required"),
    OKX_ACCESS_DEX_PASSPHRASE: z
      .string()
      .min(1, "OKX DEX passphrase is required"),
    OKX_ACCESS_DEX_PROJECT_ID: z
      .string()
      .min(1, "OKX DEX project ID is required"),
  }),

  // Binance API credentials
  binance: z.object({
    BINANCE_API_KEY: z.string().min(1, "Binance API key is required"),
    BINANCE_SECRET_KEY: z.string().min(1, "Binance secret key is required"),
  }),

  // Bybit API credentials
  bybit: z.object({
    BYBIT_API_KEY: z.string().min(1, "Bybit API key is required"),
    BYBIT_SECRET_KEY: z.string().min(1, "Bybit secret key is required"),
  }),

  // Bitget API credentials
  bitget: z.object({
    BITGET_API_KEY: z.string().min(1, "Bitget API key is required"),
    BITGET_SECRET_KEY: z.string().min(1, "Bitget secret key is required"),
    BITGET_API_PASS: z.string().min(1, "Bitget API pass is required"),
  }),

  // Moralis API credentials
  moralis: z.object({
    MORALIS_API_KEY: z.string().min(1, "Moralis API key is required"),
  }),

  // CoinGecko API credentials
  coingecko: z.object({
    COINGECKO_API_KEY: z.string().optional(),
  }),

  // GitHub API credentials
  github: z.object({
    GITHUB_TOKEN: z.string().min(1, "GitHub token is required"),
  }),

  // Database credentials
  database: z.object({
    DATABASE_URL: z.string().min(1, "Database URL is required"),
  }),

  // Redis credentials
  redis: z.object({
    REDIS_URL: z.string().min(1, "Redis URL is required"),
  }),

  // Blockchain RPC URLs
  blockchain: z.object({
    BINANCE_ALPHA_RPC_URL: z.string().url("Invalid BSC RPC URL"),
    ETHEREUM_RPC_URL: z.string().url("Invalid Ethereum RPC URL").optional(),
    POLYGON_RPC_URL: z.string().url("Invalid Polygon RPC URL").optional(),
  }),
};

/**
 * Validate environment variables for a specific service
 */
export function validateEnvForService<T extends keyof typeof EnvSchemas>(
  service: T,
): z.infer<(typeof EnvSchemas)[T]> {
  try {
    const schema = EnvSchemas[service];
    const result = schema.parse(process.env);

    logger.info(
      `[EnvValidator] Successfully validated environment for ${service}`,
    );
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      logger.error(
        `[EnvValidator] Missing or invalid environment variables for ${service}: ${missingVars}`,
      );
      throw new Error(
        `Missing or invalid environment variables for ${service}: ${missingVars}`,
      );
    }
    throw error;
  }
}

/**
 * Validate all required environment variables
 */
export function validateAllEnv(): void {
  const services: (keyof typeof EnvSchemas)[] = [
    "okxDex",
    "binance",
    "bybit",
    "bitget",
    "moralis",
    "github",
    "database",
    "redis",
    "blockchain",
  ];

  const errors: string[] = [];

  for (const service of services) {
    try {
      validateEnvForService(service);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    logger.error("[EnvValidator] Environment validation failed", { errors });
    throw new Error(`Environment validation failed:\n${errors.join("\n")}`);
  }

  logger.info(
    "[EnvValidator] All environment variables validated successfully",
  );
}

/**
 * Mask sensitive values for logging
 */
export function maskSensitiveValue(
  value: string,
  visibleChars: number = 4,
): string {
  if (value.length <= visibleChars) {
    return "*".repeat(value.length);
  }

  const visible = value.slice(0, visibleChars);
  const masked = "*".repeat(value.length - visibleChars);
  return visible + masked;
}

/**
 * Safe environment variable getter with masking
 */
export function getSafeEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue || "";

  // Log masked value for debugging
  logger.debug(
    `[EnvValidator] Retrieved environment variable: ${key}=${maskSensitiveValue(value)}`,
  );

  return value;
}
