"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Recharts components - no need for type assertions
const ChartLine = Line;
const ChartXAxis = XAxis;
const ChartYAxis = YAxis;
const ChartLegend = Legend;
const ChartLineChart = LineChart;
const ChartResponsiveContainer = ResponsiveContainer;

// Define token interface
interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUSD?: number;
  logoURI?: string;
}

// Define serialized types for API response (BigInt values are converted to strings)
interface SerializedLiquidityInfo {
  tick: number;
  liquidityNet: string;
  liquidityGross: string;
  availableLiquidity: string;
  token0AmountAdjusted: number; // token0 amount adjusted for decimals
  token1AmountAdjusted: number; // token1 amount adjusted for decimals
  token0TotalUSDAdjusted: number; // token0 USD value adjusted for decimals
  token1TotalUSDAdjusted: number; // token1 USD value adjusted for decimals
  totalUSDAdjusted: number; // total USD value
  initialized: boolean;
  currentTick: boolean; // indicates if this is the current tick
}

interface SerializedPoolBaseInfo {
  poolAddress: string;
  token0: TokenInfo;
  token1: TokenInfo;
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string; // total liquidity
  tickSpacing: number;
  token0Total: number;
  token1Total: number;
  token0TotalUSD: number;
  token1TotalUSD: number;
  totalUSD: number;
  tokenRatio: {
    token0Percent: number;
    token1Percent: number;
  };
}

interface TickAnalysisProps {
  liquidityDistribution: SerializedLiquidityInfo[];
  poolBaseInfo?: SerializedPoolBaseInfo;
  loading: boolean;
  error: string | null;
}

// Helper function to format large numbers for display
const formatLargeNumber = (value: string | number): string => {
  const num = typeof value === "string" ? BigInt(value) : BigInt(value);
  const numStr = num.toString();

  if (numStr.length <= 6) {
    return num.toLocaleString();
  }

  // Use abbreviated format for all large numbers instead of scientific notation
  const suffixes = [
    "",
    "K",
    "M",
    "B",
    "T",
    "Qa",
    "Qi",
    "Sx",
    "Sp",
    "Oc",
    "No",
    "Dc",
  ];
  let suffixIndex = 0;
  let displayNum = parseFloat(numStr);

  while (displayNum >= 1000 && suffixIndex < suffixes.length - 1) {
    displayNum /= 1000;
    suffixIndex++;
  }

  // Format with appropriate decimal places based on size
  if (displayNum >= 100) {
    return `${displayNum.toFixed(0)}${suffixes[suffixIndex]}`;
  } else if (displayNum >= 10) {
    return `${displayNum.toFixed(1)}${suffixes[suffixIndex]}`;
  } else {
    return `${displayNum.toFixed(2)}${suffixes[suffixIndex]}`;
  }
};

export default function TickAnalysis({
  liquidityDistribution,
  poolBaseInfo,
  loading,
  error,
}: TickAnalysisProps) {
  if (loading) {
    return (
      <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gruvbox-orange">
          Liquidity Distribution Analysis
        </h3>
        <div className="text-gruvbox-gray text-center py-4">
          Loading liquidity distribution...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gruvbox-orange">
          Liquidity Distribution Analysis
        </h3>
        <div className="text-gruvbox-red text-center py-4">Error: {error}</div>
      </div>
    );
  }

  // Find current tick
  const currentTick = liquidityDistribution.find((tick) => tick.currentTick);

  // Use API to detect liquidity cliffs
  const [liquidityCliffs, setLiquidityCliffs] = React.useState<
    {
      tick: number;
      previousLiquidity: string;
      currentLiquidity: string;
      deltaPct: number;
    }[]
  >([]);

  React.useEffect(() => {
    const detectCliffs = async () => {
      if (!poolBaseInfo || liquidityDistribution.length === 0) {
        setLiquidityCliffs([]);
        return;
      }

      try {
        const response = await fetch("/api/tokens/pools/liquidity-cliffs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticks: liquidityDistribution,
            startingLiquidity: poolBaseInfo.liquidity,
            thresholdPct: 0.2,
          }),
        });

        if (!response.ok) {
          console.error("Failed to detect liquidity cliffs");
          setLiquidityCliffs([]);
          return;
        }

        const data = await response.json();
        setLiquidityCliffs(data.cliffs || []);
      } catch (error) {
        console.error("Error detecting liquidity cliffs:", error);
        setLiquidityCliffs([]);
      }
    };

    detectCliffs();
  }, [liquidityDistribution, poolBaseInfo]);

  // Calculate summary statistics
  const totalLiquidityUSD = liquidityDistribution.reduce(
    (sum, tick) => sum + tick.totalUSDAdjusted,
    0,
  );

  // Prepare chart data for recharts
  const chartData = liquidityDistribution.map((tick) => ({
    tick: tick.tick,
    activeLiquidity: parseInt(tick.availableLiquidity),
    liquidityNet: parseInt(tick.liquidityNet),
    isCurrentTick: tick.currentTick,
  }));

  // Find current tick for reference line
  const currentTickData = chartData.find((item) => item.isCurrentTick);

  return (
    <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gruvbox-orange">
        Liquidity Distribution Analysis
      </h3>

      <div className="space-y-3">
        {/* Summary Statistics */}
        <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
          <h4 className="font-medium text-gruvbox-blue mb-2">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gruvbox-gray">Active Ticks:</span>
              <span className="text-gruvbox-green ml-2">
                {liquidityDistribution.length}
              </span>
            </div>
            <div>
              <span className="text-gruvbox-gray">
                Estimated Liquidity Range:
              </span>
              <span className="text-gruvbox-green ml-2">
                ${totalLiquidityUSD.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gruvbox-gray">
                Total Available Liquidity:
              </span>
              <span className="text-gruvbox-green ml-2 font-mono text-xs">
                {formatLargeNumber(
                  liquidityDistribution
                    .reduce(
                      (sum, tick) => sum + BigInt(tick.availableLiquidity),
                      BigInt(0),
                    )
                    .toString(),
                )}
              </span>
            </div>
            {currentTick && (
              <div>
                <span className="text-gruvbox-gray">Current Tick:</span>
                <span className="text-gruvbox-orange ml-2">
                  {currentTick.tick}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pool Base Info */}
        {poolBaseInfo && (
          <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
            <h4 className="font-medium text-gruvbox-blue mb-2">
              Pool Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Total Liquidity:</span>
                  <span className="text-gruvbox-green font-mono text-xs">
                    {formatLargeNumber(poolBaseInfo.liquidity)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">USD Value:</span>
                  <span className="text-gruvbox-blue">
                    ${poolBaseInfo.totalUSD.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">
                    Token0 ({poolBaseInfo.token0.symbol}):
                  </span>
                  <span className="text-gruvbox-green">
                    ${poolBaseInfo.token0TotalUSD.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">
                    Token1 ({poolBaseInfo.token1.symbol}):
                  </span>
                  <span className="text-gruvbox-green">
                    ${poolBaseInfo.token1TotalUSD.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Tick Information */}
        {currentTick && (
          <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
            <h4 className="font-medium text-gruvbox-blue mb-2">
              Current Tick Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Tick:</span>
                  <span className="text-gruvbox-orange font-mono">
                    {currentTick.tick}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Liquidity Net:</span>
                  <span className="text-gruvbox-green font-mono text-xs">
                    {formatLargeNumber(currentTick.liquidityNet)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">
                    Available Liquidity:
                  </span>
                  <span className="text-gruvbox-green font-mono text-xs">
                    {formatLargeNumber(currentTick.availableLiquidity)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Status:</span>
                  <span
                    className={`${
                      currentTick.initialized
                        ? "text-gruvbox-green"
                        : "text-gruvbox-red"
                    }`}
                  >
                    {currentTick.initialized ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Token0 Amount:</span>
                  <span className="text-gruvbox-blue font-mono">
                    {currentTick.token0AmountAdjusted.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Token1 Amount:</span>
                  <span className="text-gruvbox-blue font-mono">
                    {currentTick.token1AmountAdjusted.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Token0 USD:</span>
                  <span className="text-gruvbox-green">
                    ${currentTick.token0TotalUSDAdjusted.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Token1 USD:</span>
                  <span className="text-gruvbox-green">
                    ${currentTick.token1TotalUSDAdjusted.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gruvbox-gray">Total USD:</span>
                  <span className="text-gruvbox-green font-semibold">
                    ${currentTick.totalUSDAdjusted.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liquidity Distribution Chart */}
        <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
          <h4 className="font-medium text-gruvbox-blue mb-2">
            Liquidity Distribution by Tick
          </h4>

          {/* Chart Visualization */}
          <div className="mb-4 h-80" style={{ position: "relative" }}>
            <ChartResponsiveContainer width="100%" height="100%">
              <ChartLineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#928374"
                  opacity={0.3}
                />
                <ChartXAxis
                  dataKey="tick"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  stroke="#ebdbb2"
                  tick={{ fill: "#928374" }}
                  label={{
                    value: "Tick",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#ebdbb2",
                  }}
                />
                <ChartYAxis
                  yAxisId="left"
                  stroke="#b8bb26"
                  tick={{ fill: "#928374" }}
                  label={{
                    value: "Active Liquidity",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#ebdbb2",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#282828",
                    border: "1px solid #504945",
                    color: "#ebdbb2",
                  }}
                />
                <ChartLegend />
                <ChartLine
                  yAxisId="left"
                  type="monotone"
                  dataKey="activeLiquidity"
                  stroke="#b8bb26"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isCurrentTick = payload.isCurrentTick;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isCurrentTick ? 8 : 4}
                        fill={isCurrentTick ? "#fe8019" : "#b8bb26"}
                        stroke={isCurrentTick ? "#ffffff" : "#b8bb26"}
                        strokeWidth={isCurrentTick ? 3 : 2}
                      />
                    );
                  }}
                  activeDot={{ r: 6, stroke: "#b8bb26", strokeWidth: 2 }}
                />

                {/* Current tick is highlighted by red dot */}
              </ChartLineChart>
            </ChartResponsiveContainer>

            {/* Current tick label */}
            {currentTickData && (
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: "#fe8019",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  zIndex: 10,
                }}
              >
                Current Tick: {currentTickData.tick}
              </div>
            )}
          </div>

          {/* Detailed List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {liquidityDistribution.map((tick) => (
              <div
                key={tick.tick}
                className={`flex justify-between items-center p-2 rounded ${
                  tick.currentTick
                    ? "bg-gruvbox-orange/20 border border-gruvbox-orange"
                    : tick.initialized
                      ? "bg-gruvbox-green/10 border border-gruvbox-green/30"
                      : "bg-gruvbox-gray/5"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gruvbox-gray">
                    Tick {tick.tick}
                  </span>
                  {tick.currentTick && (
                    <span className="text-xs bg-gruvbox-orange text-gruvbox-bg px-1 rounded">
                      Current
                    </span>
                  )}
                  {!tick.initialized && (
                    <span className="text-xs bg-gruvbox-red text-gruvbox-bg px-1 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gruvbox-green">
                    ${tick.totalUSDAdjusted.toLocaleString()}
                  </div>
                  <div className="text-xs text-gruvbox-gray font-mono">
                    Net: {formatLargeNumber(tick.liquidityNet)} | Available:{" "}
                    {formatLargeNumber(tick.availableLiquidity)}
                  </div>
                  <div className="text-xs text-gruvbox-blue">
                    T0: {tick.token0AmountAdjusted.toFixed(2)} | T1:{" "}
                    {tick.token1AmountAdjusted.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Liquidity Cliffs */}
        {liquidityCliffs.length > 0 && (
          <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
            <h4 className="font-medium text-gruvbox-red mb-2">
              Liquidity Cliffs (≥20% Change in Active Liquidity)
            </h4>
            <div className="space-y-2">
              {liquidityCliffs.map((cliff, index) => (
                <div
                  key={index}
                  className="bg-gruvbox-red/10 border border-gruvbox-red/30 rounded p-2"
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gruvbox-red">Tick {cliff.tick}</span>
                    <span className="text-gruvbox-orange font-medium">
                      {cliff.deltaPct}% Change
                    </span>
                  </div>
                  <div className="text-xs text-gruvbox-gray">
                    Previous Active:{" "}
                    {parseInt(cliff.previousLiquidity).toLocaleString()}
                  </div>
                  <div className="text-xs text-gruvbox-blue">
                    Current Active:{" "}
                    {parseInt(cliff.currentLiquidity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
