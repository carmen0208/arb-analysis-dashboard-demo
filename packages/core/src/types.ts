/**
 * Core Types
 */

export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SortDirection = "asc" | "desc";

export interface CacheAdapter {
  getFromCache<T>(cacheName: string, ...keys: string[]): Promise<T | null>;
  saveToCache<T>(
    cacheName: string,
    data: T,
    ttl?: number,
    ...keys: string[]
  ): Promise<void>;
  deleteFromCache(cacheName: string, ...keys: string[]): Promise<void>;
  clearCache(cacheName: string): Promise<void>;
  getCacheFilePath?: (cacheName: string, ...keys: string[]) => string;
}

export interface LoggerAdapter {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}
