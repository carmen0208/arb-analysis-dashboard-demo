"use client";

import { useState, useEffect } from "react";
import { useTokenPrices } from "../../hooks/useTokenPrices";
import { BlockchainPlatform } from "@dex-ai/api-clients/types";
import PriceChart from "./PriceChart";

interface TokenChartProps {
  tokenAddress: string;
  tokenSymbol: string;
  platform?: BlockchainPlatform;
  days?: number;
}

export default function TokenChart({
  tokenAddress,
  tokenSymbol,
  platform = BlockchainPlatform.BINANCE_SMART_CHAIN,
  days = 1,
}: TokenChartProps) {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<number>(days);

  const { data, currentPrices, historicalData, isLoading, error, sources } =
    useTokenPrices(tokenAddress, tokenSymbol, {
      platform,
      days: timeRange,
      autoRefresh: true,
      refreshInterval: 5 * 60000, // 5 minutes
    });

  // Auto-select the first one when there are new data sources
  useEffect(() => {
    if (sources.length > 0 && selectedSources.length === 0) {
      setSelectedSources([sources[0]]);
    }
  }, [sources, selectedSources.length]);

  // Only show loading state during initial load when there is no data
  if (isLoading && (!data || Object.keys(data.sources).length === 0)) {
    return (
      <div className="flex items-center justify-center h-64 bg-gruvbox-bg border border-gruvbox-border rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gruvbox-orange"></div>
        <span className="ml-2 text-gruvbox-fg">Loading price data...</span>
      </div>
    );
  }

  if (error && (!data || Object.keys(data.sources).length === 0)) {
    return (
      <div className="h-64 bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <div className="text-red-500 text-center">
          <p>Error loading price data:</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data.sources).length === 0) {
    return (
      <div className="h-64 bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <div className="text-gruvbox-gray text-center">
          <p>No price data available for this token</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Title */}
      <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gruvbox-orange">
            Multi-Source Price Analysis
          </h2>
          {isLoading && (
            <div className="flex items-center text-sm text-gruvbox-gray">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gruvbox-orange mr-2"></div>
              <span>Updating...</span>
            </div>
          )}
        </div>
        <p className="text-gruvbox-gray text-sm">
          Comprehensive price data from multiple sources with interactive charts
        </p>
      </div>

      {/* Control Panel */}
      <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-gruvbox-orange font-medium mb-3">
              Price Sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => (
                <label
                  key={source}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSources([...selectedSources, source]);
                      } else {
                        setSelectedSources(
                          selectedSources.filter((s) => s !== source),
                        );
                      }
                    }}
                    className="rounded border-gruvbox-border text-gruvbox-orange focus:ring-gruvbox-orange"
                  />
                  <span className="text-gruvbox-fg capitalize">{source}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gruvbox-gray">Time Range:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="bg-gruvbox-gray/10 border border-gruvbox-border rounded px-2 py-1 text-sm text-gruvbox-fg"
              >
                <option value={1}>1 Day</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Current Price Display */}
      <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <h3 className="text-gruvbox-orange font-medium mb-3">Current Prices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSources.map((source) => {
            const price = currentPrices[source];
            const sourceData = data.sources[source];
            const sourceHistoricalData = historicalData[source];

            // Calculate 24-hour price change
            const priceChange24h =
              sourceHistoricalData && sourceHistoricalData.length > 1
                ? ((price - sourceHistoricalData[0].price) /
                    sourceHistoricalData[0].price) *
                  100
                : null;

            return (
              <div
                key={source}
                className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gruvbox-fg font-medium capitalize">
                    {source}
                  </span>
                  <div className="flex items-center space-x-2">
                    {isLoading && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-gruvbox-orange"></div>
                    )}
                    <span className="text-xs text-gruvbox-gray">
                      {sourceData?.lastUpdated
                        ? new Date(sourceData.lastUpdated).toLocaleTimeString()
                        : "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gruvbox-green mb-1">
                  ${price?.toFixed(6) || "N/A"}
                </div>
                {priceChange24h !== null && (
                  <div
                    className={`text-sm font-medium ${
                      priceChange24h > 0
                        ? "text-gruvbox-green"
                        : priceChange24h < 0
                          ? "text-gruvbox-red"
                          : "text-gruvbox-gray"
                    }`}
                  >
                    {priceChange24h > 0 ? "+" : ""}
                    {priceChange24h.toFixed(2)}% (24h)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Price Statistics Summary */}
      {selectedSources.length > 1 && (
        <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
          <h3 className="text-gruvbox-orange font-medium mb-3">
            Price Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Average Price */}
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
              <div className="text-sm text-gruvbox-gray mb-1">
                Average Price
              </div>
              <div className="text-lg font-bold text-gruvbox-green">
                $
                {(
                  selectedSources.reduce(
                    (sum, source) => sum + (currentPrices[source] || 0),
                    0,
                  ) / selectedSources.length
                ).toFixed(6)}
              </div>
            </div>

            {/* Highest Price */}
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
              <div className="text-sm text-gruvbox-gray mb-1">
                Highest Price
              </div>
              <div className="text-lg font-bold text-gruvbox-green">
                $
                {Math.max(
                  ...selectedSources.map(
                    (source) => currentPrices[source] || 0,
                  ),
                ).toFixed(6)}
              </div>
            </div>

            {/* Lowest Price */}
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
              <div className="text-sm text-gruvbox-gray mb-1">Lowest Price</div>
              <div className="text-lg font-bold text-gruvbox-green">
                $
                {Math.min(
                  ...selectedSources.map(
                    (source) => currentPrices[source] || 0,
                  ),
                ).toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Price Chart */}
      {selectedSources.length > 0 && (
        <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
          <h3 className="text-gruvbox-orange font-medium mb-3">
            Price History
          </h3>
          <PriceChart
            historicalData={historicalData}
            selectedSources={selectedSources}
            height={400}
          />
        </div>
      )}
    </div>
  );
}
