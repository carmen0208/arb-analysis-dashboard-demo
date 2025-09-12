import type { CacheAdapter } from "../types";
import { TIME_CONSTANTS } from "../constants";

export function getFromLocalStorageCache<T>(
  cacheName: string,
  ...keys: string[]
): T | null {
  if (typeof window === "undefined") return null;

  const key = `${cacheName}_${keys.join("_")}`;

  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const { data, expires } = JSON.parse(item);
    if (Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }

    return data as T;
  } catch {
    return null;
  }
}

export function saveToLocalStorageCache<T>(
  cacheName: string,
  data: T,
  ttl: number = TIME_CONSTANTS.DEFAULT_CACHE_TTL,
  ...keys: string[]
): void {
  if (typeof window === "undefined") return;

  const key = `${cacheName}_${keys.join("_")}`;

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expires: Date.now() + ttl,
      }),
    );
  } catch {
    // Ignore storage errors
  }
}

export function deleteFromLocalStorageCache(
  cacheName: string,
  ...keys: string[]
): void {
  if (typeof window === "undefined") return;

  const key = `${cacheName}_${keys.join("_")}`;
  localStorage.removeItem(key);
}

export function clearLocalStorageCache(cacheName: string): void {
  if (typeof window === "undefined") return;

  const prefix = `${cacheName}_`;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
  keys.forEach((key) => localStorage.removeItem(key));
}

export const localStorageCacheAdapter: CacheAdapter = {
  async getFromCache(cacheName, ...keys) {
    return getFromLocalStorageCache(cacheName, ...keys) ?? null;
  },
  async saveToCache(cacheName, data, ttl, ...keys) {
    saveToLocalStorageCache(cacheName, data, ttl, ...keys);
  },
  async deleteFromCache(cacheName, ...keys) {
    deleteFromLocalStorageCache(cacheName, ...keys);
  },
  async clearCache(cacheName) {
    clearLocalStorageCache(cacheName);
  },
};
