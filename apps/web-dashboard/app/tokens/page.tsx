"use client";

import { useRouter } from "next/navigation";
import SearchBar from "./components/SearchBar";
import { Token } from "@dex-ai/api-clients/types";

export default function TokensPage() {
  const router = useRouter();

  const handleTokenSelect = (token: Token) => {
    // Redirect to dynamic route
    router.push(`/tokens/${token.address}`);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-black text-white p-4">
      {/* Search Section */}
      <div className="w-full max-w-2xl mx-auto mb-6">
        <SearchBar onTokenSelect={handleTokenSelect} />
      </div>

      {/* Welcome Message */}
      <div className="text-center text-gruvbox-gray mt-20">
        <h1 className="text-2xl font-bold text-gruvbox-orange mb-4">
          Token Price Analysis
        </h1>
        <p className="text-lg mb-8">
          Search for any token to view detailed price analysis and charts
        </p>
        <div className="max-w-md mx-auto bg-gruvbox-bg border border-gruvbox-border rounded-lg p-6">
          <h2 className="text-gruvbox-fg font-medium mb-3">Features:</h2>
          <ul className="text-sm text-gruvbox-gray space-y-2 text-left">
            <li>• Multi-source price comparison</li>
            <li>• Interactive price charts</li>
            <li>• Historical price analysis</li>
            <li>• Real-time data updates</li>
            <li>• Shareable URLs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
