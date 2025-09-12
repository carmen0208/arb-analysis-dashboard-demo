import type { CacheAdapter } from "../types";
import { getLogger } from "../logger";
import { TIME_CONSTANTS } from "../constants";

export interface CacheManager {
  get<T>(cacheName: string, ...keys: string[]): Promise<T | null>;
  set<T>(
    cacheName: string,
    data: T,
    ttl?: number,
    ...keys: string[]
  ): Promise<void>;
  delete(cacheName: string, ...keys: string[]): Promise<void>;
  clear(cacheName: string): Promise<void>;
}

const logger = getLogger("cache-manager");

export function createCacheManager(
  adapters: CacheAdapter[],
  defaultTtl: number = TIME_CONSTANTS.DEFAULT_CACHE_TTL,
): CacheManager {
  return {
    async get<T>(cacheName: string, ...keys: string[]): Promise<T | null> {
      // Try each cache adapter in sequence
      for (const adapter of adapters) {
        try {
          const result = await adapter.getFromCache<T>(cacheName, ...keys);
          if (result !== null) {
            return result;
          }
        } catch (error) {
          logger.warn(`Cache adapter error for ${cacheName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return null;
    },

    async set<T>(
      cacheName: string,
      data: T,
      ttl: number = defaultTtl,
      ...keys: string[]
    ): Promise<void> {
      // Write to all cache adapters in parallel
      const promises = adapters.map(async (adapter) => {
        try {
          await adapter.saveToCache(cacheName, data, ttl, ...keys);
        } catch (error) {
          logger.warn(`Cache adapter write error for ${cacheName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      await Promise.all(promises);
    },

    async delete(cacheName: string, ...keys: string[]): Promise<void> {
      // Delete from all cache adapters in parallel
      const promises = adapters.map(async (adapter) => {
        try {
          await adapter.deleteFromCache(cacheName, ...keys);
        } catch (error) {
          logger.warn(`Cache adapter delete error for ${cacheName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      await Promise.all(promises);
    },

    async clear(cacheName: string): Promise<void> {
      // Clear all cache adapters in parallel
      const promises = adapters.map(async (adapter) => {
        try {
          await adapter.clearCache(cacheName);
        } catch (error) {
          logger.warn(`Cache adapter clear error for ${cacheName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      await Promise.all(promises);
    },
  };
}

// Predefined cache manager configuration
export async function createDefaultCacheManager(): Promise<CacheManager> {
  const adapters: CacheAdapter[] = [];

  // Add memory cache (fastest)
  try {
    const { memoryCacheAdapter } = await import("./memoryCache");
    adapters.push(memoryCacheAdapter);
  } catch (error) {
    logger.warn("Memory cache adapter not available", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Add local storage cache (browser environment)
  try {
    const { localStorageCacheAdapter } = await import("./localStorageCache");
    adapters.push(localStorageCacheAdapter);
  } catch (error) {
    logger.warn("LocalStorage cache adapter not available", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Add file cache (persistent)
  try {
    const { fileCacheAdapter } = await import("./fileCache");
    adapters.push(fileCacheAdapter);
  } catch (error) {
    logger.warn("File cache adapter not available", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return createCacheManager(adapters);
}
