/**
 * CoinGecko Top Pools API Functions
 *
 * This module provides functions to query top liquidity pools by network
 * from CoinGecko's On-Chain DEX API.
 */

import { apiClient } from "./client";
import { makeApiRequest } from "./request";
import { PoolData, TopPoolsResponse, TopPoolsOptions } from "./types";
import logger from "../../../src/common/logger";

/**
 * Get top pools list for a specific network (single page)
 * @param network Network ID (e.g., 'eth', 'bsc', 'polygon-pos')
 * @param options Query options
 * @returns Top pools data
 */
export async function getTopPoolsByNetwork(
  network: string,
  options: TopPoolsOptions = {},
): Promise<PoolData[]> {
  logger.info("[CoinGecko] Fetching top pools by network", {
    network,
    options,
  });

  try {
    const params: Record<string, string | number> = {};
    if (options.page) {
      params.page = options.page;
    }
    if (options.include && options.include.length > 0) {
      params.include = options.include.join(",");
    }

    const response = await makeApiRequest<TopPoolsResponse>(
      apiClient,
      `/onchain/networks/${network}/pools`,
      params,
      { operation: "getTopPoolsByNetwork", network },
    );

    const pools = response.data?.data || [];

    logger.info("[CoinGecko] Successfully fetched top pools", {
      network,
      poolCount: pools.length,
      page: options.page || 1,
      totalPages: response.data?.meta?.last_page || 1,
    });

    return pools;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching top pools by network", {
      network,
      options,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get all top pools for a specific network (multi-page query, up to 10 pages)
 * @param network Network ID
 * @param maxPages Maximum number of pages (default 10 pages, 20 pools per page)
 * @param options Query options
 * @returns All top pools data
 */
export async function getAllTopPoolsByNetwork(
  network: string,
  maxPages: number = 10,
  options: Omit<TopPoolsOptions, "page"> = {},
): Promise<PoolData[]> {
  logger.info("[CoinGecko] Fetching all top pools by network", {
    network,
    maxPages,
    options,
  });

  try {
    const allPools: PoolData[] = [];
    const maxPagesToFetch = Math.min(maxPages, 10); // Limit to maximum 10 pages

    // Query all pages in parallel
    const pagePromises = Array.from({ length: maxPagesToFetch }, (_, index) => {
      const page = index + 1;
      return getTopPoolsByNetwork(network, { ...options, page });
    });

    const pageResults = await Promise.all(pagePromises);

    // Merge results from all pages
    for (const pools of pageResults) {
      allPools.push(...pools);
    }

    logger.info("[CoinGecko] Successfully fetched all top pools", {
      network,
      totalPools: allPools.length,
      pagesFetched: maxPagesToFetch,
    });

    return allPools;
  } catch (error) {
    logger.error("[CoinGecko] Error fetching all top pools by network", {
      network,
      maxPages,
      options,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Get top pools for a specific network (with retry mechanism)
 * @param network Network ID
 * @param maxPages Maximum number of pages
 * @param options Query options
 * @param retryAttempts Number of retry attempts
 * @returns All top pools data
 */
export async function getTopPoolsWithRetry(
  network: string,
  maxPages: number = 10,
  options: Omit<TopPoolsOptions, "page"> = {},
  retryAttempts: number = 3,
): Promise<PoolData[]> {
  logger.info("[CoinGecko] Fetching top pools with retry", {
    network,
    maxPages,
    retryAttempts,
    options,
  });

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const pools = await getAllTopPoolsByNetwork(network, maxPages, options);

      if (pools.length > 0) {
        logger.info("[CoinGecko] Successfully fetched pools on attempt", {
          network,
          attempt,
          poolCount: pools.length,
        });
        return pools;
      } else {
        logger.warn("[CoinGecko] No pools returned on attempt", {
          network,
          attempt,
        });
      }
    } catch (error) {
      logger.error("[CoinGecko] Error on attempt", {
        network,
        attempt,
        maxAttempts: retryAttempts,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt === retryAttempts) {
        logger.error("[CoinGecko] All retry attempts failed", { network });
        return [];
      }

      // Wait before retry
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      logger.info("[CoinGecko] Waiting before retry", {
        network,
        attempt,
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return [];
}
