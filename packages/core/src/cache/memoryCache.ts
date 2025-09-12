import type { CacheAdapter } from "../types";

// In-memory cache storage
const memoryStore = new Map<string, { data: any; expires: number }>();

export function getFromMemoryCache<T>(
  cacheName: string,
  ...keys: string[]
): T | null {
  const key = `${cacheName}_${keys.join("_")}`;
  const item = memoryStore.get(key);

  if (!item) return null;

  if (Date.now() > item.expires) {
    memoryStore.delete(key);
    return null;
  }

  return item.data as T;
}

export function saveToMemoryCache<T>(
  cacheName: string,
  data: T,
  ttl: number = 60000, // Default 1 minute
  ...keys: string[]
): void {
  const key = `${cacheName}_${keys.join("_")}`;
  memoryStore.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

export function deleteFromMemoryCache(
  cacheName: string,
  ...keys: string[]
): void {
  const key = `${cacheName}_${keys.join("_")}`;
  memoryStore.delete(key);
}

export function clearMemoryCache(cacheName: string): void {
  const prefix = `${cacheName}_`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

export const memoryCacheAdapter: CacheAdapter = {
  async getFromCache(cacheName, ...keys) {
    return getFromMemoryCache(cacheName, ...keys) ?? null;
  },
  async saveToCache(cacheName, data, ttl, ...keys) {
    saveToMemoryCache(cacheName, data, ttl, ...keys);
  },
  async deleteFromCache(cacheName, ...keys) {
    deleteFromMemoryCache(cacheName, ...keys);
  },
  async clearCache(cacheName) {
    clearMemoryCache(cacheName);
  },
};
