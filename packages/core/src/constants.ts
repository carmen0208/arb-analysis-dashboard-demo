/**
 * Core Constants
 *
 * Centralized management of magic numbers and configuration values
 * used across the application to improve maintainability and type safety.
 */

/**
 * Time-related constants (in milliseconds)
 */
export const TIME_CONSTANTS = {
  /** Rate limit window duration */
  RATE_LIMIT_WINDOW: 60 * 1000, // 60 seconds

  /** Maximum wait time for rate limit */
  MAX_WAIT_TIME: 65 * 1000, // 65 seconds

  /** Default cache TTL */
  DEFAULT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  /** Short cache TTL */
  SHORT_CACHE_TTL: 60 * 1000, // 1 minute

  /** Minutes per day */
  MINUTES_PER_DAY: 1440,

  /** Default retry delay */
  DEFAULT_RETRY_DELAY: 2000, // 2 seconds

  /** API call delay for rate limiting */
  API_CALL_DELAY: 100, // 100ms
} as const;

/**
 * API-related constants
 */
export const API_CONSTANTS = {
  /** Default timeout for API requests */
  DEFAULT_TIMEOUT: 30 * 1000, // 30 seconds

  /** Maximum retry attempts */
  MAX_RETRY_ATTEMPTS: 3,

  /** Rate limit status codes */
  RATE_LIMIT_STATUS_CODE: 429,

  /** Success status codes */
  SUCCESS_STATUS_CODES: [200, 201, 202] as const,
} as const;

/**
 * Cache-related constants
 */
export const CACHE_CONSTANTS = {
  /** Default cache key prefix */
  DEFAULT_PREFIX: "dex-ai",

  /** Maximum cache size */
  MAX_CACHE_SIZE: 1000,

  /** Cache cleanup interval */
  CLEANUP_INTERVAL: 60 * 1000, // 1 minute
} as const;

/**
 * Logging constants
 */
export const LOG_CONSTANTS = {
  /** Default log level */
  DEFAULT_LOG_LEVEL: "info",

  /** Maximum log file size */
  MAX_LOG_FILE_SIZE: "20m",

  /** Maximum number of log files */
  MAX_LOG_FILES: 14,

  /** Log directory name */
  LOG_DIRECTORY: "logs",
} as const;

/**
 * Environment-related constants
 */
export const ENV_CONSTANTS = {
  /** Production environment */
  PRODUCTION: "production",

  /** Development environment */
  DEVELOPMENT: "development",

  /** Test environment */
  TEST: "test",

  /** Serverless environment indicators */
  SERVERLESS_ENVS: ["vercel", "aws-lambda", "azure-functions"] as const,
} as const;

/**
 * Type-safe constant access
 */
export type TimeConstants = typeof TIME_CONSTANTS;
export type ApiConstants = typeof API_CONSTANTS;
export type CacheConstants = typeof CACHE_CONSTANTS;
export type LogConstants = typeof LOG_CONSTANTS;
export type EnvConstants = typeof ENV_CONSTANTS;
