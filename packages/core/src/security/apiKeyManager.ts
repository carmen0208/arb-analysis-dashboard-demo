import { getLogger, Logger } from "../logger";
import { maskSensitiveValue } from "./envValidator";

const logger: Logger = getLogger("api-key-manager");

/**
 * API Key configuration interface
 */
export interface ApiKeyConfig {
  key: string;
  secret?: string;
  passphrase?: string;
  projectId?: string;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  lastUsed?: Date;
  usageCount?: number;
}

/**
 * API Key Manager for secure key handling
 */
export class ApiKeyManager {
  private keys: Map<string, ApiKeyConfig> = new Map();
  private usageStats: Map<string, { count: number; lastUsed: Date }> =
    new Map();

  /**
   * Add an API key configuration
   */
  addKey(name: string, config: ApiKeyConfig): void {
    // Validate key format
    if (!this.validateKeyFormat(config.key)) {
      throw new Error(`Invalid API key format for ${name}`);
    }

    // Mask sensitive values in logs
    const maskedKey = maskSensitiveValue(config.key);
    logger.info(`[ApiKeyManager] Added API key: ${name}`, {
      keyMasked: maskedKey,
      hasSecret: !!config.secret,
      hasPassphrase: !!config.passphrase,
      hasProjectId: !!config.projectId,
    });

    this.keys.set(name, {
      ...config,
      lastUsed: new Date(),
      usageCount: 0,
    });
  }

  /**
   * Get an API key configuration
   */
  getKey(name: string): ApiKeyConfig | null {
    const key = this.keys.get(name);
    if (key) {
      // Update usage statistics
      this.updateUsageStats(name);

      logger.debug(`[ApiKeyManager] Retrieved API key: ${name}`, {
        keyMasked: maskSensitiveValue(key.key),
        usageCount: key.usageCount,
      });
    }
    return key || null;
  }

  /**
   * Get all available API key names
   */
  getAvailableKeys(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Remove an API key
   */
  removeKey(name: string): boolean {
    const existed = this.keys.delete(name);
    this.usageStats.delete(name);

    if (existed) {
      logger.info(`[ApiKeyManager] Removed API key: ${name}`);
    }

    return existed;
  }

  /**
   * Get usage statistics for an API key
   */
  getUsageStats(name: string): { count: number; lastUsed: Date } | null {
    return this.usageStats.get(name) || null;
  }

  /**
   * Check if an API key exists
   */
  hasKey(name: string): boolean {
    return this.keys.has(name);
  }

  /**
   * Validate API key format
   */
  private validateKeyFormat(key: string): boolean {
    // Basic validation - should be non-empty and not contain spaces
    return key.length > 0 && !key.includes(" ") && !key.includes("\n");
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(name: string): void {
    const key = this.keys.get(name);
    if (!key) return;

    const stats = this.usageStats.get(name) || {
      count: 0,
      lastUsed: new Date(),
    };
    stats.count++;
    stats.lastUsed = new Date();

    this.usageStats.set(name, stats);

    // Update key config
    key.lastUsed = new Date();
    key.usageCount = (key.usageCount || 0) + 1;
  }

  /**
   * Get all usage statistics
   */
  getAllUsageStats(): Record<string, { count: number; lastUsed: Date }> {
    const stats: Record<string, { count: number; lastUsed: Date }> = {};
    for (const [name, stat] of this.usageStats.entries()) {
      stats[name] = { ...stat };
    }
    return stats;
  }

  /**
   * Clear all API keys (for testing)
   */
  clear(): void {
    this.keys.clear();
    this.usageStats.clear();
    logger.info("[ApiKeyManager] Cleared all API keys");
  }
}

/**
 * Global API Key Manager instance
 */
export const apiKeyManager = new ApiKeyManager();

/**
 * Initialize API keys from environment variables
 */
export function initializeApiKeysFromEnv(): void {
  try {
    // OKX DEX keys
    const okxDexKey = process.env.OKX_ACCESS_DEX_API_KEY;
    const okxDexSecret = process.env.OKX_ACCESS_DEX_SECRET_KEY;
    const okxDexPassphrase = process.env.OKX_ACCESS_DEX_PASSPHRASE;
    const okxDexProjectId = process.env.OKX_ACCESS_DEX_PROJECT_ID;

    if (okxDexKey && okxDexSecret && okxDexPassphrase && okxDexProjectId) {
      apiKeyManager.addKey("okx-dex", {
        key: okxDexKey,
        secret: okxDexSecret,
        passphrase: okxDexPassphrase,
        projectId: okxDexProjectId,
        rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000 },
      });
    }

    // Binance keys
    const binanceKey = process.env.BINANCE_API_KEY;
    const binanceSecret = process.env.BINANCE_SECRET_KEY;

    if (binanceKey && binanceSecret) {
      apiKeyManager.addKey("binance", {
        key: binanceKey,
        secret: binanceSecret,
        rateLimit: { requestsPerMinute: 1200, requestsPerDay: 100000 },
      });
    }

    // Bybit keys
    const bybitKey = process.env.BYBIT_API_KEY;
    const bybitSecret = process.env.BYBIT_SECRET_KEY;

    if (bybitKey && bybitSecret) {
      apiKeyManager.addKey("bybit", {
        key: bybitKey,
        secret: bybitSecret,
        rateLimit: { requestsPerMinute: 120, requestsPerDay: 10000 },
      });
    }

    // Bitget keys
    const bitgetKey = process.env.BITGET_API_KEY;
    const bitgetSecret = process.env.BITGET_SECRET_KEY;
    const bitgetPass = process.env.BITGET_API_PASS;

    if (bitgetKey && bitgetSecret && bitgetPass) {
      apiKeyManager.addKey("bitget", {
        key: bitgetKey,
        secret: bitgetSecret,
        passphrase: bitgetPass,
        rateLimit: { requestsPerMinute: 120, requestsPerDay: 10000 },
      });
    }

    // Moralis key
    const moralisKey = process.env.MORALIS_API_KEY;
    if (moralisKey) {
      apiKeyManager.addKey("moralis", {
        key: moralisKey,
        rateLimit: { requestsPerMinute: 200, requestsPerDay: 100000 },
      });
    }

    // CoinGecko key (optional)
    const coingeckoKey = process.env.COINGECKO_API_KEY;
    if (coingeckoKey) {
      apiKeyManager.addKey("coingecko", {
        key: coingeckoKey,
        rateLimit: { requestsPerMinute: 50, requestsPerDay: 10000 },
      });
    }

    // GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      apiKeyManager.addKey("github", {
        key: githubToken,
        rateLimit: { requestsPerMinute: 5000, requestsPerDay: 100000 },
      });
    }

    logger.info(
      `[ApiKeyManager] Initialized ${apiKeyManager.getAvailableKeys().length} API keys from environment`,
    );
  } catch (error) {
    logger.error(
      "[ApiKeyManager] Failed to initialize API keys from environment",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    throw error;
  }
}
