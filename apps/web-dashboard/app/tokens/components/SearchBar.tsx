"use client";

import { useState } from "react";
import { Token } from "@dex-ai/api-clients/types";

interface SearchBarProps {
  onTokenSelect: (token: Token) => void;
  currentToken?: Token; // Currently selected token
}

export default function SearchBar({
  onTokenSelect,
  currentToken,
}: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState(currentToken?.symbol || "");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [error, setError] = useState("");

  const handleSearch = async (value: string) => {
    const apiKey = localStorage.getItem("api-key");
    if (!apiKey) {
      setError("No permission");
      return;
    }
    setSearchTerm(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Call API to search for tokens
      const response = await fetch(
        `/api/tokens/search?q=${encodeURIComponent(value)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
        },
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (result: Token) => {
    // Use search returned data directly, no need to call API again
    onTokenSelect(result);
    setSearchResults([]);
    setSearchTerm(result.symbol);
  };

  return (
    <div className="relative">
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Currently selected token display */}
      {currentToken && (
        <div className="mb-3 p-3 bg-gruvbox-gray/10 border border-gruvbox-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gruvbox-orange font-medium">
                Currently viewing: {currentToken.symbol}
              </span>
              <div className="text-sm text-gruvbox-gray">
                {currentToken.name} • {currentToken.address.slice(0, 8)}...
                {currentToken.address.slice(-6)}
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm("");
                setSearchResults([]);
              }}
              className="text-gruvbox-gray hover:text-gruvbox-fg text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center bg-gruvbox-bg border border-gruvbox-border rounded-lg p-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by token address or symbol..."
          className="flex-1 bg-transparent outline-none text-gruvbox-fg placeholder-gruvbox-gray px-2"
        />
        {isLoading && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gruvbox-orange ml-2"></div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="absolute w-full mt-1 bg-gruvbox-bg border border-gruvbox-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
          {searchResults.map((result) => (
            <div
              key={result.address}
              onClick={() => handleSelect(result)}
              className="flex items-center justify-between p-3 hover:bg-gruvbox-gray/20 cursor-pointer border-b border-gruvbox-border last:border-b-0"
            >
              <div>
                <div className="font-medium text-gruvbox-orange">
                  {result.symbol}
                </div>
                <div className="text-sm text-gruvbox-gray">{result.name}</div>
              </div>
              {result.verified && (
                <span className="text-gruvbox-green text-sm">Verified</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
