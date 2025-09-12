"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BlockchainPlatform,
  MultiSourcePriceData,
  PriceDataPoint,
} from "@dex-ai/api-clients/types";
import { getApiKey, hasValidApiKey } from "../../lib/security/apiKeyStorage";

interface UseTokenPricesOptions {
  platform?: BlockchainPlatform;
  days?: number;
  currency?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseTokenPricesReturn {
  data: MultiSourcePriceData | null;
  currentPrices: { [source: string]: number };
  historicalData: { [source: string]: PriceDataPoint[] };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sources: string[];
}

export function useTokenPrices(
  tokenAddress: string | null,
  tokenSymbol: string | null,
  options: UseTokenPricesOptions = {},
): UseTokenPricesReturn {
  const {
    platform = BlockchainPlatform.BINANCE_SMART_CHAIN,
    days = 1,
    currency = "usd",
    autoRefresh = false,
    refreshInterval = 3600000, // 1 hour
  } = options;

  const [data, setData] = useState<MultiSourcePriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tokenAddress || !tokenSymbol) {
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!hasValidApiKey()) {
        throw new Error(
          "Valid API key not found. Please configure your API key.",
        );
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("API key retrieval failed");
      }
      const params = new URLSearchParams({
        symbol: tokenSymbol,
        platform,
        days: days.toString(),
        currency,
        type: "full",
      });

      const response = await fetch(
        `/api/tokens/${tokenAddress}/prices?${params}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch price data");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching token prices:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, platform, days, currency]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !tokenAddress) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, tokenAddress, refreshInterval, fetchData]);

  // Calculate current price
  const currentPrices = data?.sources
    ? Object.fromEntries(
        Object.entries(data.sources).map(([source, sourceData]) => [
          source,
          sourceData.currentPrice,
        ]),
      )
    : {};

  // Calculate historical data
  const historicalData = data?.sources
    ? Object.fromEntries(
        Object.entries(data.sources)
          .filter(([_, sourceData]) => sourceData.historicalData)
          .map(([source, sourceData]) => [source, sourceData.historicalData!]),
      )
    : {};

  // Get data source list
  const sources = data ? Object.keys(data.sources) : [];

  return {
    data,
    currentPrices,
    historicalData,
    isLoading,
    error,
    refetch: fetchData,
    sources,
  };
}

// Hook specifically for getting current prices
export function useCurrentTokenPrice(
  tokenAddress: string | null,
  tokenSymbol: string | null,
  options: Omit<UseTokenPricesOptions, "autoRefresh" | "refreshInterval"> = {},
) {
  const { currentPrices, isLoading, error, refetch } = useTokenPrices(
    tokenAddress,
    tokenSymbol,
    { ...options, autoRefresh: false },
  );

  return {
    currentPrices,
    isLoading,
    error,
    refetch,
    sources: Object.keys(currentPrices),
  };
}

// Hook specifically for getting historical prices
export function useHistoricalTokenPrices(
  tokenAddress: string | null,
  tokenSymbol: string | null,
  options: Omit<UseTokenPricesOptions, "autoRefresh" | "refreshInterval"> = {},
) {
  const { historicalData, isLoading, error, refetch } = useTokenPrices(
    tokenAddress,
    tokenSymbol,
    { ...options, autoRefresh: false },
  );

  return {
    historicalData,
    isLoading,
    error,
    refetch,
    sources: Object.keys(historicalData),
  };
}
