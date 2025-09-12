"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { PriceDataPoint } from "@dex-ai/api-clients/types";

interface PriceChartProps {
  historicalData: { [source: string]: PriceDataPoint[] };
  selectedSources: string[];
  height?: number;
}

interface ChartDataPoint {
  timestamp: number;
  date: string;
  [source: string]: number | string;
}

// Recharts tooltip and legend types
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

interface LegendProps {
  payload?: Array<{
    value: string;
    color: string;
  }>;
}

export default function PriceChart({
  historicalData,
  selectedSources,
  height = 400,
}: PriceChartProps) {
  const [chartType, setChartType] = useState<"line" | "area">("line");
  const [showGrid, setShowGrid] = useState(true);
  const [enableSmoothing, setEnableSmoothing] = useState(true);

  // Process data, merge timestamps from all data sources
  const chartData = useMemo(() => {
    if (!selectedSources.length) return [];

    // Process each data source separately to avoid timestamp mismatch issues
    const processedData: { [timestamp: number]: ChartDataPoint } = {};

    selectedSources.forEach((source) => {
      const data = historicalData[source];
      if (data && data.length > 0) {
        data.forEach((point) => {
          if (!processedData[point.timestamp]) {
            processedData[point.timestamp] = {
              timestamp: point.timestamp,
              date: new Date(point.timestamp).toLocaleDateString(),
            };
          }
          processedData[point.timestamp][source] = point.price;
        });
      }
    });

    // Convert to array and sort
    const sortedData = Object.values(processedData).sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    // Interpolate each data source to fill gaps (only when smoothing is enabled)
    if (enableSmoothing) {
      selectedSources.forEach((source) => {
        const sourcePoints = sortedData
          .map((point, index) => ({ index, value: point[source] as number }))
          .filter((p) => p.value !== undefined && p.value !== null);

        if (sourcePoints.length < 2) return; // Too few data points, skip interpolation

        // Simple linear interpolation to fill gaps
        for (let i = 0; i < sortedData.length; i++) {
          if (
            sortedData[i][source] === undefined ||
            sortedData[i][source] === null
          ) {
            // Find valid data points before and after
            // For prevPoint, find the point with index < i and the largest index
            const prevPoint = sourcePoints
              .filter((p) => p.index < i && p.value !== null)
              .reduce(
                (closest, current) =>
                  current.index > closest.index ? current : closest,
                { index: -1, value: 0 },
              );

            // For nextPoint, find the point with index > i and the smallest index
            const nextPoint = sourcePoints.find(
              (p) => p.index > i && p.value !== null,
            );

            if (prevPoint.index !== -1 && nextPoint) {
              // Linear interpolation
              const ratio =
                (i - prevPoint.index) / (nextPoint.index - prevPoint.index);
              const interpolatedValue =
                prevPoint.value + (nextPoint.value - prevPoint.value) * ratio;
              sortedData[i][source] = interpolatedValue;
            } else if (prevPoint.index !== -1) {
              // Use previous value
              sortedData[i][source] = prevPoint.value;
            } else if (nextPoint) {
              // Use next value
              sortedData[i][source] = nextPoint.value;
            }
          }
        }
      });
    }

    return sortedData;
  }, [historicalData, selectedSources, enableSmoothing]);

  // Generate color array
  const colors = [
    "#ff6b6b", // Red
    "#4ecdc4", // Cyan
    "#45b7d1", // Blue
    "#96ceb4", // Green
    "#feca57", // Yellow
    "#ff9ff3", // Pink
    "#54a0ff", // Blue
    "#5f27cd", // Purple
    "#00d2d3", // Cyan
    "#ff9f43", // Orange
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-3 shadow-lg">
          <p className="text-gruvbox-gray text-sm mb-2">
            {new Date(label || 0).toLocaleString()}
          </p>
          {payload.map((entry) => (
            <p
              key={entry.dataKey}
              className="text-sm"
              style={{ color: entry.color }}
            >
              <span className="capitalize font-medium">{entry.dataKey}:</span> $
              {entry.value?.toFixed(6) || "N/A"}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = ({ payload }: LegendProps) => {
    return (
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        {payload?.map((entry, _index: number) => (
          <div
            key={entry.value}
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => {
              // Here you can add click legend to toggle show/hide functionality
            }}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gruvbox-fg capitalize">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="h-64 bg-gruvbox-gray/5 border border-gruvbox-border rounded-lg p-4 flex items-center justify-center">
        <div className="text-center text-gruvbox-gray">
          <p>No chart data available</p>
          <p className="text-sm mt-1">
            Select at least one data source to display the chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Control Panel */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gruvbox-gray">Chart Type:</span>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as "line" | "area")}
              className="bg-gruvbox-gray/10 border border-gruvbox-border rounded px-2 py-1 text-sm text-gruvbox-fg"
            >
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
            </select>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded border-gruvbox-border text-gruvbox-orange focus:ring-gruvbox-orange"
            />
            <span className="text-sm text-gruvbox-gray">Show Grid</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSmoothing}
              onChange={(e) => setEnableSmoothing(e.target.checked)}
              className="rounded border-gruvbox-border text-gruvbox-orange focus:ring-gruvbox-orange"
            />
            <span className="text-sm text-gruvbox-gray">Smooth Lines</span>
          </label>
        </div>
        <div className="text-sm text-gruvbox-gray">
          {chartData.length} data points
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <ResponsiveContainer width="100%" height={height}>
          {chartType === "line" ? (
            <LineChart data={chartData}>
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#444"
                  opacity={0.3}
                />
              )}
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                stroke="#888"
                fontSize={12}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(value) => `$${value.toFixed(6)}`}
                stroke="#888"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              {selectedSources.map((source, index) => (
                <Line
                  key={source}
                  type="monotone"
                  dataKey={source}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  connectNulls={enableSmoothing}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={chartData}>
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#444"
                  opacity={0.3}
                />
              )}
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                stroke="#888"
                fontSize={12}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(value) => `$${value.toFixed(6)}`}
                stroke="#888"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              {selectedSources.map((source, index) => (
                <Area
                  key={source}
                  type="monotone"
                  dataKey={source}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  connectNulls={enableSmoothing}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Data Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selectedSources.map((source, index) => {
          const data = historicalData[source];
          if (!data || data.length === 0) return null;

          const prices = data.map((d) => d.price).filter((p) => p !== null);
          if (prices.length === 0) return null;

          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          const currentPrice = data[data.length - 1]?.price || 0;
          const priceChange =
            data.length > 1
              ? ((currentPrice - data[0].price) / data[0].price) * 100
              : 0;

          return (
            <div
              key={source}
              className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-medium capitalize"
                  style={{ color: colors[index % colors.length] }}
                >
                  {source}
                </span>
                <span
                  className={`text-sm font-medium ${
                    priceChange >= 0 ? "text-gruvbox-green" : "text-gruvbox-red"
                  }`}
                >
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Current:</span>
                  <span className="text-gruvbox-green">
                    ${currentPrice.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Min:</span>
                  <span>${minPrice.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Max:</span>
                  <span>${maxPrice.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Avg:</span>
                  <span>${avgPrice.toFixed(6)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
