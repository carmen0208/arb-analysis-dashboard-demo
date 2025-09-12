import * as fs from "fs";
import * as path from "path";
import type { CacheAdapter } from "../types";

export function getCacheDir(cacheName: string): string {
  // 检查是否在 serverless 环境（如 Vercel、AWS Lambda 等）
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.NOW_REGION ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  // 优先使用 /tmp 目录（serverless 兼容）
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

      // 检查是否过期
      if (cached.expires && Date.now() > cached.expires) {
        fs.unlinkSync(cacheFile);
        return null;
      }

      return cached.data as T;
    }
  } catch (error) {
    console.warn("Error reading from cache:", error);
  }
  return null;
}

export function saveToCache<T>(
  cacheName: string,
  data: T,
  ttl: number = 300000, // 默认5分钟
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
    console.warn("Error writing to cache:", error);
  }
}

export function deleteFromCache(cacheName: string, ...keys: string[]): void {
  const cacheFile = getCacheFilePath(cacheName, ...keys);
  try {
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  } catch (error) {
    console.warn("Error deleting from cache:", error);
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
    console.warn("Error clearing cache:", error);
  }
}

export const fileCacheAdapter: CacheAdapter = {
  async getFromCache(cacheName, ...keys) {
    return getFromCache(cacheName, ...keys) ?? null;
  },
  async saveToCache(cacheName, data, ttl = 300000, ...keys) {
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
