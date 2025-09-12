"use client";

import { Token, TokenPool } from "@dex-ai/api-clients/types";

interface SecurityAnalysisProps {
  token: Token;
  poolsInfo: {
    totalLiquidity: number;
    totalVolume24h: number;
    pools: TokenPool[];
  } | null;
}

export default function SecurityAnalysis({
  token,
  poolsInfo,
}: SecurityAnalysisProps) {
  return (
    <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gruvbox-orange">
        Security Analysis
      </h3>

      <div className="space-y-4">
        {/* Liquidity Distribution */}
        <div>
          <h4 className="text-sm text-gruvbox-gray mb-2">
            Liquidity Distribution
          </h4>
          <div className="h-4 bg-gruvbox-gray/20 border border-gruvbox-border rounded-full overflow-hidden flex">
            {poolsInfo?.pools.map((pool, index) => {
              const percentage =
                (pool.liquidity / poolsInfo.totalLiquidity) * 100;
              return (
                <div
                  key={pool.address}
                  style={{ width: `${percentage}%` }}
                  className={`h-full ${
                    index % 2 === 0 ? "bg-gruvbox-blue" : "bg-gruvbox-green"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 text-sm text-gruvbox-gray">
            Distribution across {poolsInfo?.pools.length || 0} pools
          </div>
        </div>

        {/* Bridge Support */}
        <div>
          <h4 className="text-sm text-gruvbox-gray mb-2">
            Cross-chain Support
          </h4>
          {token.bridgeInfo?.isL0Supported ? (
            <div className="bg-gruvbox-green/20 text-gruvbox-green px-3 py-2 rounded border border-gruvbox-border">
              <div className="font-medium">LayerZero Bridge Supported</div>
              <div className="text-sm mt-1">
                Available on: {token.bridgeInfo.supportedChains?.join(", ")}
              </div>
            </div>
          ) : (
            <div className="bg-gruvbox-orange/20 text-gruvbox-orange px-3 py-2 rounded border border-gruvbox-border">
              <div className="font-medium">No LayerZero Bridge Support</div>
              <div className="text-sm mt-1">
                Token is not available for cross-chain bridging via LayerZero
              </div>
            </div>
          )}
        </div>

        {/* Security Metrics */}
        <div>
          <h4 className="text-sm text-gruvbox-gray mb-2">Security Metrics</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border p-3 rounded">
              <div className="text-sm text-gruvbox-gray">Total Liquidity</div>
              <div className="font-medium">
                ${poolsInfo?.totalLiquidity.toLocaleString() || "0"}
              </div>
            </div>
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border p-3 rounded">
              <div className="text-sm text-gruvbox-gray">24h Volume</div>
              <div className="font-medium">
                ${poolsInfo?.totalVolume24h.toLocaleString() || "0"}
              </div>
            </div>
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border p-3 rounded">
              <div className="text-sm text-gruvbox-gray">Pool Count</div>
              <div className="font-medium">
                {poolsInfo?.pools.length || 0} pools
              </div>
            </div>
            <div className="bg-gruvbox-gray/10 border border-gruvbox-border p-3 rounded">
              <div className="text-sm text-gruvbox-gray">Min Liquidity</div>
              <div className="font-medium">$500K+</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
