import type { CacheAdapter } from "../types";

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

export function createCacheManager(
  adapters: CacheAdapter[],
  defaultTtl: number = 300000, // Default 5 minutes
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
          console.warn(`Cache adapter error for ${cacheName}:`, error);
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
          console.warn(`Cache adapter write error for ${cacheName}:`, error);
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
          console.warn(`Cache adapter delete error for ${cacheName}:`, error);
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
          console.warn(`Cache adapter clear error for ${cacheName}:`, error);
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
    console.warn("Memory cache adapter not available");
  }

  // Add local storage cache (browser environment)
  try {
    const { localStorageCacheAdapter } = await import("./localStorageCache");
    adapters.push(localStorageCacheAdapter);
  } catch (error) {
    console.warn("LocalStorage cache adapter not available");
  }

  // Add file cache (persistent)
  try {
    const { fileCacheAdapter } = await import("./fileCache");
    adapters.push(fileCacheAdapter);
  } catch (error) {
    console.warn("File cache adapter not available");
  }

  return createCacheManager(adapters);
}
