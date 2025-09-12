import { TokenPool } from "@dex-ai/api-clients/types";
import { useState, useEffect } from "react";

export interface PoolsInfo {
  totalLiquidity: number;
  totalVolume24h: number;
  pools: TokenPool[];
}

export function useTokenPools(tokenAddress: string, chain: string = "bsc") {
  const [poolsInfo, setPoolsInfo] = useState<PoolsInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenAddress) {
      setPoolsInfo(null);
      return;
    }

    const fetchPools = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/tokens/${tokenAddress}/pools?chain=${chain}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch pools");
        }

        const allPools = await response.json();
        // Let's only return pools that the volume larger than
        setPoolsInfo(allPools);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setPoolsInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, [tokenAddress, chain]);

  return { poolsInfo, loading, error };
}
