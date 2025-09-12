/**
 * Core Utilities
 */

import { getLogger } from "./logger";

const logger = getLogger("core-utils");

/**
 * Safely parse JSON without throwing exceptions
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    logger.error("Error parsing JSON", {
      error: e instanceof Error ? e.message : String(e),
    });
    return fallback;
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a date to ISO string without milliseconds
 */
export function formatDate(date: Date): string {
  return date.toISOString().split(".")[0] + "Z";
}

/**
 * Create a paginated result
 */
export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function get24HoursAgo(): string {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  return twentyFourHoursAgo.toISOString();
}

export function getLastWeek(): string {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  return lastWeek.toISOString().split("T")[0];
}
