"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Token } from "@dex-ai/api-clients/types";
import SearchBar from "../components/SearchBar";
import TokenChart from "../components/TokenChart";
import TokenInfo from "../components/TokenInfo";
import TokenAnalysis from "../components/TokenAnalysis";

export default function TokenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tokenAddress = params.address as string;

  // Auto-load token data when address in URL changes
  useEffect(() => {
    if (tokenAddress) {
      loadTokenData(tokenAddress);
    }
  }, [tokenAddress]);

  const loadTokenData = async (address: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem("api-key");
      if (!apiKey) {
        throw new Error("API key not found");
      }

      const response = await fetch(`/api/tokens/${address}`, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token data: ${response.status}`);
      }

      const tokenData = await response.json();
      setSelectedToken(tokenData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error loading token data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    router.push(`/tokens/${token.address}`, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-black text-white p-4">
        <div className="w-full max-w-2xl mx-auto mb-6">
          <SearchBar onTokenSelect={handleTokenSelect} />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gruvbox-orange"></div>
          <span className="ml-2 text-gruvbox-fg">Loading token data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col w-full min-h-screen bg-black text-white p-4">
        <div className="w-full max-w-2xl mx-auto mb-6">
          <SearchBar onTokenSelect={handleTokenSelect} />
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-500">
            <p>Error loading token data:</p>
            <p className="text-sm mt-2">{error}</p>
            <button
              onClick={() => loadTokenData(tokenAddress)}
              className="mt-4 px-4 py-2 bg-gruvbox-orange text-black rounded hover:bg-gruvbox-orange/80"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-black text-white p-4">
      {/* Breadcrumb Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/tokens")}
          className="text-gruvbox-gray hover:text-gruvbox-orange text-sm flex items-center"
        >
          ← Back to Search
        </button>

        {selectedToken && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              // Can add a toast notification
              alert("URL copied to clipboard!");
            }}
            className="text-gruvbox-gray hover:text-gruvbox-orange text-sm flex items-center"
          >
            📋 Share URL
          </button>
        )}
      </div>

      {/* Search Section */}
      <div className="w-full max-w-2xl mx-auto mb-6">
        <SearchBar
          onTokenSelect={handleTokenSelect}
          currentToken={selectedToken}
        />
      </div>

      {selectedToken && (
        <>
          {/* Token Info and Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* Token Info */}
            <div className="lg:col-span-1">
              <TokenInfo token={selectedToken} />
            </div>

            {/* Chart */}
            <div className="lg:col-span-3">
              <TokenChart
                tokenAddress={selectedToken.address}
                tokenSymbol={selectedToken.symbol}
              />
            </div>
          </div>

          {/* Analysis Section */}
          <div className="w-full">
            <TokenAnalysis token={selectedToken} />
          </div>
        </>
      )}
    </div>
  );
}
