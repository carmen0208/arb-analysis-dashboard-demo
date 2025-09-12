import * as fs from "fs";
import * as path from "path";
import type { CacheAdapter } from "../types";
import { getLogger } from "../logger";
import { TIME_CONSTANTS } from "../constants";

const logger = getLogger("file-cache");

export function getCacheDir(cacheName: string): string {
  // Check if in serverless environment (like Vercel, AWS Lambda, etc.)
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.NOW_REGION ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  // Prefer /tmp directory (serverless compatible)
  const baseDir = isServerless ? "/tmp" : process.cwd();
  const cacheDir = path.join(baseDir, ".cache", cacheName);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

export function getCacheFilePath(cacheName: string, ...keys: string[]): string {
  return path.join(getCacheDir(cacheName), `${keys.join("-")}.json`);
}

export function getFromCache<T>(
  cacheName: string,
  ...keys: string[]
): T | null {
  const cacheFile = getCacheFilePath(cacheName, ...keys);
  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));

      // Check if expired
      if (cached.expires && Date.now() > cached.expires) {
        fs.unlinkSync(cacheFile);
        return null;
      }

      return cached.data as T;
    }
  } catch (error) {
    logger.warn("Error reading from cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

export function saveToCache<T>(
  cacheName: string,
  data: T,
  ttl: number = TIME_CONSTANTS.DEFAULT_CACHE_TTL,
  ...keys: string[]
): void {
  const cacheFile = getCacheFilePath(cacheName, ...keys);
  try {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        data,
        expires: Date.now() + ttl,
        reviewed: false,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    logger.warn("Error writing to cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function deleteFromCache(cacheName: string, ...keys: string[]): void {
  const cacheFile = getCacheFilePath(cacheName, ...keys);
  try {
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  } catch (error) {
    logger.warn("Error deleting from cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function clearCache(cacheName: string): void {
  const cacheDir = getCacheDir(cacheName);
  try {
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
    }
  } catch (error) {
    logger.warn("Error clearing cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const fileCacheAdapter: CacheAdapter = {
  async getFromCache(cacheName, ...keys) {
    return getFromCache(cacheName, ...keys) ?? null;
  },
  async saveToCache(
    cacheName,
    data,
    ttl = TIME_CONSTANTS.DEFAULT_CACHE_TTL,
    ...keys
  ) {
    saveToCache(cacheName, data, ttl, ...keys);
  },
  async deleteFromCache(cacheName, ...keys) {
    deleteFromCache(cacheName, ...keys);
  },
  async clearCache(cacheName) {
    clearCache(cacheName);
  },
  getCacheFilePath(cacheName, ...keys) {
    return getCacheFilePath(cacheName, ...keys);
  },
};
