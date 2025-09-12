/**
 * Common API Types
 *
 * Shared type definitions for API requests and responses across different services
 */

/**
 * Generic API request parameters
 */
export interface ApiRequestParams {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Generic API error context
 */
export interface ApiErrorContext {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Generic API response metadata
 */
export interface ApiResponseMetadata {
  timestamp: number;
  requestId?: string;
  source?: string;
  version?: string;
}

/**
 * Generic pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Generic sorting parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Generic filter parameters
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Generic search parameters
 */
export interface SearchParams {
  query?: string;
  fields?: string[];
  fuzzy?: boolean;
}

/**
 * Generic date range parameters
 */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Generic API request context
 */
export interface ApiRequestContext extends ApiRequestParams, ApiErrorContext {
  operation?: string;
  endpoint?: string;
  method?: string;
}

/**
 * Generic retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry: (error: unknown) => boolean;
  onError: (error: unknown, attempt: number) => void;
}

/**
 * Generic API client configuration
 */
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  apiKey?: string;
  secretKey?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data: T;
  metadata?: ApiResponseMetadata;
  success: boolean;
  error?: string;
  code?: string | number;
}

/**
 * Generic error response
 */
export interface ApiErrorResponse {
  error: string;
  code?: string | number;
  message?: string;
  details?: unknown;
  timestamp?: number;
}

/**
 * Generic rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Generic API status
 */
export interface ApiStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  responseTime?: number;
  lastCheck?: number;
  error?: string;
}
