"use client";

import { Token } from "@dex-ai/api-clients/types";

interface TokenInfoProps {
  token: Token;
}

export default function TokenInfo({ token }: TokenInfoProps) {
  const prices = token.price
    ? Object.values(token.price).filter(
        (v): v is number => typeof v === "number",
      )
    : [];
  const averagePrice =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  return (
    <div className="bg-gruvbox-bg text-gruvbox-fg border border-gruvbox-border rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gruvbox-orange">
          {token.symbol}
        </h2>
        <p className="text-gruvbox-gray">{token.name}</p>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm text-gruvbox-gray">Average Price</div>
          <div className="text-lg">${averagePrice.toFixed(6)}</div>
        </div>

        <div>
          <div className="text-sm text-gruvbox-gray">Market Cap</div>
          <div className="text-lg">
            ${token.marketCap?.toLocaleString() || "N/A"}
          </div>
        </div>

        <div>
          <div className="text-sm text-gruvbox-gray">24h Volume</div>
          <div className="text-lg">
            ${token.volume24h?.toLocaleString() || "N/A"}
          </div>
        </div>

        <div>
          <div className="text-sm text-gruvbox-gray">Total Liquidity</div>
          <div className="text-lg">
            ${token.poolsInfo?.totalLiquidity.toLocaleString() || "N/A"}
          </div>
        </div>

        <div>
          <div className="text-sm text-gruvbox-gray">Contract Address</div>
          <div className="text-sm break-all">{token.address}</div>
        </div>

        <div>
          <div className="text-sm text-gruvbox-gray">L0 Bridge Support</div>
          <div className="flex items-center">
            {token.bridgeInfo?.isL0Supported ? (
              <>
                <span className="text-gruvbox-green">Supported</span>
                <span className="text-sm text-gruvbox-gray ml-2">
                  ({token.bridgeInfo.supportedChains?.join(", ")})
                </span>
              </>
            ) : (
              <span className="text-gruvbox-orange">Not Supported</span>
            )}
          </div>
        </div>

        <div className="pt-2">
          {token.isVerified ? (
            <div className="bg-gruvbox-green/20 text-gruvbox-green px-3 py-1 rounded-full text-sm inline-block">
              Verified Token
            </div>
          ) : (
            <div className="bg-gruvbox-orange/20 text-gruvbox-orange px-3 py-1 rounded-full text-sm inline-block">
              User Added
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
