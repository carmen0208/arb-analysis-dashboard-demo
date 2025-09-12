"use client";

import { useState } from "react";
import TickAnalysis from "./TickAnalysis";
import { PoolsInfo } from "../../hooks/useTokenPools";
import { TokenPool } from "@dex-ai/api-clients/types";

// Define serialized types for API response (BigInt values are converted to strings)
interface SerializedLiquidityInfo {
  tick: number;
  liquidityNet: string;
  liquidityGross: string;
  availableLiquidity: string;
  token0AmountAdjusted: number;
  token1AmountAdjusted: number;
  token0TotalUSDAdjusted: number;
  token1TotalUSDAdjusted: number;
  totalUSDAdjusted: number;
  initialized: boolean;
  currentTick: boolean;
}

interface SerializedPoolBaseInfo {
  poolAddress: string;
  token0: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUSD?: number;
    logoURI?: string;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    priceUSD?: number;
    logoURI?: string;
  };
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string;
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

// Extended TokenPool type that includes serialized tick analysis data
interface TokenPoolWithSerializedTickAnalysis
  extends Omit<TokenPool, "tickAnalysis"> {
  tickAnalysis?: {
    liquidityDistribution: SerializedLiquidityInfo[];
    poolBaseInfo?: SerializedPoolBaseInfo;
  };
}

interface LiquidityPoolsProps {
  poolsInfo: PoolsInfo | null;
  loading: boolean;
  error: string | null;
}

export default function LiquidityPools({
  poolsInfo,
  loading,
  error,
}: LiquidityPoolsProps) {
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [tickAnalysisLoading, setTickAnalysisLoading] = useState<Set<string>>(
    new Set(),
  );
  const [tickAnalysisError, setTickAnalysisError] = useState<
    Record<string, string>
  >({});
  const [poolsWithTickAnalysis, setPoolsWithTickAnalysis] = useState<
    Record<string, TokenPoolWithSerializedTickAnalysis>
  >({});

  const togglePoolExpansion = (poolAddress: string) => {
    const newExpanded = new Set(expandedPools);
    if (newExpanded.has(poolAddress)) {
      newExpanded.delete(poolAddress);
    } else {
      newExpanded.add(poolAddress);
    }
    setExpandedPools(newExpanded);
  };

  const loadTickAnalysis = async (poolAddress: string) => {
    if (tickAnalysisLoading.has(poolAddress)) return;

    setTickAnalysisLoading((prev) => new Set(prev).add(poolAddress));
    setTickAnalysisError((prev) => ({ ...prev, [poolAddress]: "" }));

    try {
      const response = await fetch(
        `/api/tokens/pools/${poolAddress}/tick-analysis`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load tick analysis: ${response.statusText}`);
      }

      const data = await response.json();

      // Find the original pool data
      const originalPool = poolsInfo?.pools.find(
        (pool) => pool.address === poolAddress,
      );
      if (originalPool) {
        // Update the pool with tick analysis data
        const updatedPool: TokenPoolWithSerializedTickAnalysis = {
          ...originalPool,
          tickAnalysis: {
            liquidityDistribution: data.liquidityDistribution,
            poolBaseInfo: data.poolBaseInfo,
          },
        };

        setPoolsWithTickAnalysis((prev) => ({
          ...prev,
          [poolAddress]: updatedPool,
        }));
      }
    } catch (error) {
      setTickAnalysisError((prev) => ({
        ...prev,
        [poolAddress]: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setTickAnalysisLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(poolAddress);
        return newSet;
      });
    }
  };

  // Helper function to get pool data (either original or updated with tick analysis)
  const getPoolData = (
    pool: TokenPool,
  ): TokenPoolWithSerializedTickAnalysis => {
    const poolWithTickAnalysis = poolsWithTickAnalysis[pool.address];
    if (poolWithTickAnalysis) {
      return poolWithTickAnalysis;
    }

    // Return the original pool without tick analysis data
    return pool as unknown as TokenPoolWithSerializedTickAnalysis;
  };

  return (
    <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gruvbox-orange">
        Liquidity Pools (Total Volume &gt; 500K)
      </h3>

      {loading ? (
        <div className="text-gruvbox-gray text-center py-4">
          Loading pools...
        </div>
      ) : error ? (
        <div className="text-gruvbox-red text-center py-4">Error: {error}</div>
      ) : poolsInfo?.pools.length ? (
        <div className="space-y-3">
          {poolsInfo.pools.map((pool) => {
            const poolData = getPoolData(pool);
            return (
              <div key={pool.address}>
                <div className="bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gruvbox-blue">
                      {poolData.platform}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gruvbox-gray">
                        {poolData.pair}
                      </span>
                      <button
                        onClick={() => {
                          togglePoolExpansion(pool.address);
                          if (!expandedPools.has(pool.address)) {
                            loadTickAnalysis(pool.address);
                          }
                        }}
                        className="text-xs bg-gruvbox-blue text-gruvbox-bg px-2 py-1 rounded hover:bg-gruvbox-blue/80 transition-colors"
                      >
                        {expandedPools.has(pool.address) ? "Hide" : "Show"} Tick
                        Analysis
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gruvbox-gray">
                        Pair Address
                      </span>
                      <span className="text-gruvbox-green">
                        {poolData.address}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gruvbox-gray">
                        Liquidity
                      </span>
                      <span className="text-gruvbox-green">
                        {poolData.liquidity.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gruvbox-gray">
                        24h Volume
                      </span>
                      <span className="text-gruvbox-blue">
                        {poolData.volume24h.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gruvbox-gray">
                        Token Liquidity
                      </span>
                      <div className="text-right">
                        <div className="text-xs text-gruvbox-gray">
                          {poolData.token0.symbol}: $
                          {poolData.token0.liquidity.toLocaleString()}
                        </div>
                        <div className="text-xs text-gruvbox-gray">
                          {poolData.token1.symbol}: $
                          {poolData.token1.liquidity.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tick Analysis Section */}
                {expandedPools.has(pool.address) && (
                  <div className="mt-2">
                    {tickAnalysisLoading.has(pool.address) ? (
                      <div className="bg-gruvbox-gray/5 border border-gruvbox-border rounded-lg p-3">
                        <div className="text-gruvbox-gray text-center py-2">
                          Loading tick analysis...
                        </div>
                      </div>
                    ) : tickAnalysisError[pool.address] ? (
                      <div className="bg-gruvbox-red/10 border border-gruvbox-red/30 rounded-lg p-3">
                        <div className="text-gruvbox-red text-center py-2">
                          Error: {tickAnalysisError[pool.address]}
                        </div>
                      </div>
                    ) : poolData.tickAnalysis ? (
                      <TickAnalysis
                        liquidityDistribution={
                          getPoolData(pool).tickAnalysis
                            ?.liquidityDistribution || []
                        }
                        poolBaseInfo={
                          getPoolData(pool).tickAnalysis?.poolBaseInfo
                        }
                        loading={tickAnalysisLoading.has(pool.address)}
                        error={tickAnalysisError[pool.address] || null}
                      />
                    ) : (
                      <div className="bg-gruvbox-gray/5 border border-gruvbox-border rounded-lg p-3">
                        <div className="text-gruvbox-gray text-center py-2">
                          No tick analysis data available
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-gruvbox-gray text-center py-4">
          No liquidity pools found
        </div>
      )}
    </div>
  );
}
