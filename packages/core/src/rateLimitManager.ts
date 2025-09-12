/**
 * Generic Rate Limit time window manager
 * Can be reused by any API client to manage rate limits for multiple API keys
 */

import { getLogger, Logger } from "./logger";
import { getRedisClient } from "./redis";

const logger: Logger = getLogger("rate-limit-manager");

/**
 * Configuration usage time tracker interface
 */
export interface ConfigUsageTracker {
  configIndex: number;
  lastUsedTime: number;
  inCooldown: boolean;
}

/**
 * Rate Limit configuration options
 */
export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxWaitMs?: number; // Maximum wait time, defaults to windowMs + 5 seconds
  serviceName?: string; // Service name for logging
}

interface UsageInfo {
  lastUsedTime: number;
}

/**
 * Generic Rate Limit time window manager
 * Supports intelligent rotation and cooldown management for multiple API configurations
 */
export class RateLimitManager<T> {
  private configs: T[];
  private rateLimitDuration: number; // Duration in milliseconds
  private maxWaitMs: number; // Maximum wait time in milliseconds
  private serviceName: string;

  constructor(
    configs: T[],
    rateLimitDuration: number,
    serviceName: string,
    maxWaitMs?: number,
  ) {
    this.configs = configs;
    this.rateLimitDuration = rateLimitDuration;
    this.serviceName = serviceName;
    this.maxWaitMs = maxWaitMs || rateLimitDuration + 5000; // Default: rate limit + 5 seconds

    if (!serviceName) {
      throw new Error("A serviceName is required for the RateLimitManager.");
    }

    logger.debug(`[${this.serviceName}] Rate limit manager initialized`, {
      configCount: configs.length,
      rateLimitDuration,
      maxWaitMs: this.maxWaitMs,
    });
  }

  private getRedisKey(): string {
    const env =
      process.env.NODE_ENV === "production" ? "production" : "development";
    return `${env}:rate-limit-manager:${this.serviceName}`;
  }

  /**
   * Safely parse usage data from Redis, handling different data types and validation
   */
  private parseUsageData(value: unknown): UsageInfo | null {
    try {
      let parsedValue: UsageInfo;

      if (typeof value === "string") {
        parsedValue = JSON.parse(value);
      } else if (typeof value === "object" && value !== null) {
        // If it's already an object, validate it has the required structure
        if ("lastUsedTime" in value && typeof value.lastUsedTime === "number") {
          parsedValue = value as UsageInfo;
        } else {
          throw new Error("Invalid object structure");
        }
      } else {
        throw new Error(`Unexpected data type: ${typeof value}`);
      }

      // Validate the parsed data
      if (
        typeof parsedValue.lastUsedTime !== "number" ||
        parsedValue.lastUsedTime <= 0
      ) {
        throw new Error("Invalid lastUsedTime value");
      }

      return parsedValue;
    } catch (error) {
      logger.warn(`[${this.serviceName}] Failed to parse usage data`, {
        value,
        valueType: typeof value,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Atomically acquires a configuration and marks it as used.
   * This is the recommended method for preventing race conditions.
   */
  public async acquireAndMarkConfigAsUsed(): Promise<{
    config: T;
    index: number;
  }> {
    const availableIndex = await this.findAvailableConfigIndex(true);

    if (availableIndex === null) {
      logger.error(`[${this.serviceName}] No available configuration found.`);
      throw new Error("No available configuration found.");
    }

    const config = this.configs[availableIndex];
    logger.debug(`[${this.serviceName}] Acquired and marked configuration`, {
      configIndex: availableIndex,
    });
    return { config, index: availableIndex };
  }

  // Find an available config that is not in cooldown
  private async findAvailableConfigIndex(
    atomic: boolean = false,
    recursionDepth: number = 0,
    startTime: number = Date.now(),
  ): Promise<number | null> {
    // Prevent infinite recursion
    const MAX_RECURSION_DEPTH = 3;
    if (recursionDepth >= MAX_RECURSION_DEPTH) {
      logger.error(
        `[${this.serviceName}] Maximum recursion depth reached. All configurations appear to be in use.`,
        {
          recursionDepth,
          configCount: this.configs.length,
          elapsedTime: Date.now() - startTime,
        },
      );
      throw new Error(
        `[${this.serviceName}] Unable to find available configuration after ${MAX_RECURSION_DEPTH} attempts. ` +
          `Consider adding more API configurations or increasing rate limit windows.`,
      );
    }

    // Check if we've exceeded maximum wait time
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > this.maxWaitMs) {
      logger.error(`[${this.serviceName}] Maximum wait time exceeded.`, {
        elapsedTime,
        maxWaitMs: this.maxWaitMs,
        configCount: this.configs.length,
      });
      throw new Error(
        `[${this.serviceName}] Rate limit wait time (${Math.ceil(elapsedTime / 1000)}s) exceeds maximum allowed (${Math.ceil(this.maxWaitMs / 1000)}s). ` +
          `Consider adding more API configurations or increasing rate limit windows.`,
      );
    }

    const redis = await getRedisClient();
    const redisKey = this.getRedisKey();

    // Use a transaction to prevent race conditions
    const transaction = atomic ? redis.multi() : null;
    const usageData = await redis.hGetAll(redisKey);

    const now = Date.now();
    const configCount = this.configs.length;

    if (configCount === 0) {
      return null;
    }

    // Shuffle indices to ensure we don't always pick the first available key
    const shuffledIndices = Array.from(
      { length: configCount },
      (_, i) => i,
    ).sort(() => Math.random() - 0.5);

    for (const index of shuffledIndices) {
      const key = String(index);
      const rawTracker = usageData ? usageData[key] : null;
      const tracker = rawTracker ? this.parseUsageData(rawTracker) : null;

      if (!tracker) {
        // If no tracker exists for this index, it's available
        if (transaction) {
          transaction.hSet(redisKey, {
            [key]: JSON.stringify({ lastUsedTime: now }),
          });
          const result = await transaction.exec();
          if (result) {
            return index; // Transaction succeeded
          } else {
            logger.warn(
              `[${this.serviceName}] Transaction failed for config ${index}, retrying...`,
            );
            return this.findAvailableConfigIndex(
              atomic,
              recursionDepth + 1,
              startTime,
            );
          }
        }
        return index;
      }

      const timeSinceLastUse = now - tracker.lastUsedTime;
      const isAvailable = timeSinceLastUse >= this.rateLimitDuration;

      if (isAvailable) {
        if (transaction) {
          transaction.hSet(redisKey, {
            [key]: JSON.stringify({ lastUsedTime: now }),
          });
          const result = await transaction.exec();
          if (result) {
            return index; // Transaction succeeded
          } else {
            logger.warn(
              `[${this.serviceName}] Transaction failed for config ${index}, retrying...`,
            );
            return this.findAvailableConfigIndex(
              atomic,
              recursionDepth + 1,
              startTime,
            );
          }
        }
        return index;
      }
    }

    // If all configs are on cooldown, find the one that will be available soonest
    let soonestAvailableTime = Infinity;
    let soonestAvailableIndex = -1;

    for (let i = 0; i < configCount; i++) {
      const key = String(i);
      const rawTracker = usageData ? usageData[key] : null;
      const tracker = rawTracker ? this.parseUsageData(rawTracker) : null;
      const lastUsedTime = tracker ? tracker.lastUsedTime : 0;
      const availableTime = lastUsedTime + this.rateLimitDuration;

      if (availableTime < soonestAvailableTime) {
        soonestAvailableTime = availableTime;
        soonestAvailableIndex = i;
      }
    }

    const waitTime = soonestAvailableTime - now;

    // Check if wait time would exceed maximum allowed
    if (waitTime > this.maxWaitMs - elapsedTime) {
      logger.error(
        `[${this.serviceName}] Required wait time would exceed maximum allowed.`,
        {
          requiredWaitTime: waitTime,
          remainingMaxWaitTime: this.maxWaitMs - elapsedTime,
          soonestAvailableIndex,
          configCount: this.configs.length,
        },
      );
      throw new Error(
        `[${this.serviceName}] Required wait time (${Math.ceil(waitTime / 1000)}s) would exceed maximum allowed (${Math.ceil((this.maxWaitMs - elapsedTime) / 1000)}s). ` +
          `Consider adding more API configurations or increasing rate limit windows.`,
      );
    }

    logger.warn(
      `[${this.serviceName}] All configurations are on cooldown. Waiting for the soonest available.`,
      {
        waitTime: waitTime > 0 ? waitTime : 0,
        soonestAvailableIndex,
        recursionDepth,
        elapsedTime,
      },
    );

    // Wait for the soonest available config
    await new Promise((resolve) =>
      setTimeout(resolve, waitTime > 0 ? waitTime : 0),
    );

    // After waiting, recursively call the function to re-verify availability.
    // Pass recursion depth and start time to track the total wait time
    return this.findAvailableConfigIndex(atomic, recursionDepth + 1, startTime);
  }

  /**
   * Mark a configuration as successfully used after API request succeeds
   * This should be called after a successful API request
   */
  public async markConfigAsUsed(configIndex: number): Promise<void> {
    const now = Date.now();
    const redis = await getRedisClient();
    const redisKey = this.getRedisKey();

    // Update the usage in Redis for the chosen config
    await redis.hSet(redisKey, {
      [String(configIndex)]: JSON.stringify({ lastUsedTime: now }),
    });

    logger.info(`[${this.serviceName}] Marked configuration as used`, {
      configIndex,
    });
  }

  /**
   * Get the maximum wait time configured for this manager
   */
  public getMaxWaitMs(): number {
    return this.maxWaitMs;
  }

  /**
   * Clear stale usage data from Redis
   * This helps prevent issues with corrupted or outdated data
   */
  public async clearStaleUsageData(): Promise<void> {
    const redis = await getRedisClient();
    const redisKey = this.getRedisKey();
    const usageData = await redis.hGetAll(redisKey);

    if (!usageData) {
      return;
    }

    const now = Date.now();
    const staleKeys: string[] = [];

    for (const [key, value] of Object.entries(usageData)) {
      const usageInfo = this.parseUsageData(value);
      if (usageInfo) {
        const timeSinceLastUse = now - usageInfo.lastUsedTime;

        // Consider data stale if it's older than 2x the rate limit duration
        if (timeSinceLastUse > this.rateLimitDuration * 2) {
          staleKeys.push(key);
        }
      } else {
        // If we can't parse the data, consider it stale
        staleKeys.push(key);
        logger.warn(
          `[${this.serviceName}] Found corrupted usage data, marking as stale`,
          {
            key,
            value,
            valueType: typeof value,
          },
        );
      }
    }

    if (staleKeys.length > 0) {
      await redis.hDel(redisKey, staleKeys);
      logger.info(
        `[${this.serviceName}] Cleared ${staleKeys.length} stale usage records`,
        {
          staleKeys,
        },
      );
    }
  }

  /**
   * Clear all corrupted usage data from Redis
   * This is useful for recovery when there are widespread data corruption issues
   */
  public async clearAllUsageData(): Promise<void> {
    const redis = await getRedisClient();
    const redisKey = this.getRedisKey();

    try {
      await redis.del(redisKey);
      logger.info(`[${this.serviceName}] Cleared all usage data for recovery`);
    } catch (error) {
      logger.error(`[${this.serviceName}] Failed to clear all usage data`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get current usage statistics for monitoring
   */
  public async getUsageStats(): Promise<{
    totalConfigs: number;
    availableConfigs: number;
    cooldownConfigs: number;
    soonestAvailableTime?: number;
  }> {
    const redis = await getRedisClient();
    const redisKey = this.getRedisKey();
    const usageData = await redis.hGetAll(redisKey);

    const now = Date.now();
    const configCount = this.configs.length;
    let availableCount = 0;
    let cooldownCount = 0;
    let soonestAvailableTime = Infinity;

    for (let i = 0; i < configCount; i++) {
      const key = String(i);
      const rawTracker = usageData ? usageData[key] : null;
      const tracker = rawTracker ? this.parseUsageData(rawTracker) : null;

      if (!tracker) {
        availableCount++;
        continue;
      }

      const timeSinceLastUse = now - tracker.lastUsedTime;
      const isAvailable = timeSinceLastUse >= this.rateLimitDuration;

      if (isAvailable) {
        availableCount++;
      } else {
        cooldownCount++;
        const availableTime = tracker.lastUsedTime + this.rateLimitDuration;
        if (availableTime < soonestAvailableTime) {
          soonestAvailableTime = availableTime;
        }
      }
    }

    return {
      totalConfigs: configCount,
      availableConfigs: availableCount,
      cooldownConfigs: cooldownCount,
      soonestAvailableTime:
        soonestAvailableTime === Infinity ? undefined : soonestAvailableTime,
    };
  }
}

/**
 * Smart waiting function: handles the case when all configurations are in cooldown
 */
export async function smartWaitForCooldown(
  waitTime: number,
  maxWaitTime: number,
  serviceName: string = "API",
): Promise<void> {
  if (waitTime <= 0) return;

  if (waitTime > maxWaitTime) {
    throw new Error(
      `[${serviceName}] Rate limit wait time (${Math.ceil(waitTime / 1000)}s) exceeds maximum allowed (${Math.ceil(maxWaitTime / 1000)}s). ` +
        `Consider adding more API configurations.`,
    );
  }

  logger.info(
    `[${serviceName}] Waiting ${Math.ceil(waitTime / 1000)}s for rate limit cooldown...`,
  );
  await new Promise((resolve) => setTimeout(resolve, waitTime));
  logger.info(`[${serviceName}] Cooldown completed, resuming request`);
}

/**
 * Check if it's a rate limit error (extends default retry conditions)
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  // Extend existing retryableErrors from retry.ts
  const rateLimitIndicators = [
    "rate limit",
    "too many requests",
    "429",
    "quota exceeded",
    "requests per second",
    // Existing conditions from retry.ts
    "etimedout",
    "econnreset",
    "econnrefused",
    "rate limit exceeded",
  ];

  return rateLimitIndicators.some((indicator) => message.includes(indicator));
}

/**
 * Usage example:
 *
 * const manager = new RateLimitManager(configs, 60000, "OKX DEX", 65000);
 * // Parameters: configs, rateLimitDuration (60 seconds), serviceName, maxWaitMs (65 seconds)
 *
 * // Get configuration
 * const config = await manager.getConfig();
 *
 * // Monitor usage
 * const stats = await manager.getUsageStats();
 * console.log(`Available: ${stats.availableConfigs}/${stats.totalConfigs}`);
 *
 * // Clean up expired data
 * await manager.clearStaleUsageData();
 */
