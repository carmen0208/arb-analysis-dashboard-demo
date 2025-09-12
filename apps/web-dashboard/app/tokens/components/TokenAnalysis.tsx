"use client";

import { Token } from "@dex-ai/api-clients/types";
import { useTokenPools } from "../../hooks/useTokenPools";
import LiquidityPools from "./LiquidityPools";
import SecurityAnalysis from "./SecurityAnalysis";

interface TokenAnalysisProps {
  token: Token;
}

export default function TokenAnalysis({ token }: TokenAnalysisProps) {
  const { poolsInfo, loading, error } = useTokenPools(token.address);

  return (
    <div className="space-y-6">
      {/* Main Title */}
      <div className="bg-gruvbox-bg border border-gruvbox-border rounded-lg p-4">
        <h2 className="text-xl font-semibold text-gruvbox-orange mb-2">
          Token Analysis & Security Metrics
        </h2>
        <p className="text-gruvbox-gray text-sm">
          Liquidity pools, security analysis, and cross-chain bridge information
        </p>
      </div>

      {/* Token Analysis Sections - Price data moved to TokenChart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Liquidity Pools Analysis */}
        <LiquidityPools poolsInfo={poolsInfo} loading={loading} error={error} />
        {/* Security Analysis */}
        <SecurityAnalysis token={token} poolsInfo={poolsInfo} />
      </div>
    </div>
  );
}
