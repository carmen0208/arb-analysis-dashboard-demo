import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enhanceTokenTransaction,
  ChainId,
  TokenTransaction,
} from "../../../src/blockchain/etherscan";
import { fileCacheAdapter } from "@dex-ai/core";

// Mock the coingecko module
vi.mock("../coingecko", () => ({
  getTokenPriceByChainId: vi.fn(),
}));

// Import the mocked function
import { getTokenPriceByChainId } from "../coingecko";

describe("enhanceTokenTransaction - Cache Testing", () => {
  // Mock transaction data for testing
  const mockTransaction: TokenTransaction = {
    blockNumber: "12345678",
    timeStamp: "1640995200",
    hash: "0x123...abc",
    nonce: "0",
    blockHash: "0x456...def",
    from: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    contractAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE token
    to: "0x93dEb693b170d56BdDe1B0a5222B14c0F885d976",
    value: "1000000000000000000", // 1 token with 18 decimals
    tokenName: "PancakeSwap Token",
    tokenSymbol: "CAKE",
    tokenDecimal: "18",
    transactionIndex: "0",
    gas: "21000",
    gasPrice: "5000000000",
    gasUsed: "21000",
    cumulativeGasUsed: "21000",
    input: "deprecated",
    methodId: "0xa9059cbb",
    functionName: "transfer(address,uint256)",
    confirmations: "100",
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it("should use cached token price when cache hit", async () => {
    // Mock cached price data
    const cachedPriceData = {
      price: 4.25,
      timestamp: new Date().toISOString(),
    };

    // Spy on cache methods
    const getFromCacheSpy = vi
      .spyOn(fileCacheAdapter, "getFromCache")
      .mockResolvedValue(cachedPriceData);
    const saveToCacheSpy = vi
      .spyOn(fileCacheAdapter, "saveToCache")
      .mockResolvedValue(undefined);

    const result = await enhanceTokenTransaction(
      mockTransaction,
      1000, // $1000 threshold
      ChainId.BSC,
    );

    // Verify cache was checked
    expect(getFromCacheSpy).toHaveBeenCalledWith(
      "etherscan-token-prices",
      "token-price-0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    );

    // Verify cached price was used
    expect(result.tokenInfo.priceUSD).toBe(4.25);
    expect(result.valueInUSD).toBe(4.25); // 1 token * $4.25

    // Verify saveToCache was NOT called (since we hit cache)
    expect(saveToCacheSpy).not.toHaveBeenCalled();

    // Verify transaction is correctly marked as large/small transfer
    expect(result.isLargeTransfer).toBe(false); // $4.25 < $1000
  }, 30000);

  it("should fetch price and save to cache when cache miss", async () => {
    // Mock cache miss (returns null)
    const getFromCacheSpy = vi
      .spyOn(fileCacheAdapter, "getFromCache")
      .mockResolvedValue(null);
    const saveToCacheSpy = vi
      .spyOn(fileCacheAdapter, "saveToCache")
      .mockResolvedValue(undefined);

    // Mock CoinGecko API response
    const mockPriceData = {
      source: "coingecko" as const,
      tokenAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      platform: "binance-smart-chain",
      currentPrice: 3.5,
      marketCap: 1000000,
      volume24h: 50000,
      priceChange24h: 2.5,
      lastUpdated: new Date().toISOString(),
    };

    // Mock the getTokenPriceByChainId function
    vi.mocked(getTokenPriceByChainId).mockResolvedValue(mockPriceData);

    const result = await enhanceTokenTransaction(
      mockTransaction,
      1000, // $1000 threshold
      ChainId.BSC,
    );

    // Verify cache was checked
    expect(getFromCacheSpy).toHaveBeenCalledWith(
      "etherscan-token-prices",
      "token-price-0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    );

    // Verify CoinGecko API was called
    expect(getTokenPriceByChainId).toHaveBeenCalledWith(
      ChainId.BSC,
      "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    );

    // Verify saveToCache was called with proper parameters
    expect(saveToCacheSpy).toHaveBeenCalledWith(
      "etherscan-token-prices",
      expect.objectContaining({
        price: 3.5,
        timestamp: expect.any(String),
      }),
      2 * 60 * 60 * 1000, // 2 hours cache duration
      "token-price-0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    );

    // Verify result structure
    expect(result).toHaveProperty("valueInTokens");
    expect(result).toHaveProperty("valueInUSD");
    expect(result).toHaveProperty("tokenInfo");
    expect(result).toHaveProperty("isLargeTransfer");
    expect(result).toHaveProperty("transferThreshold", 1000);

    // Verify price data was correctly set
    expect(result.valueInUSD).toBe(3.5); // 1 token * $3.5
    expect(result.tokenInfo.priceUSD).toBe(3.5);
    expect(result.isLargeTransfer).toBe(false); // $3.5 < $1000
  }, 30000);

  it("should handle cache errors gracefully", async () => {
    // Mock cache error
    const getFromCacheSpy = vi
      .spyOn(fileCacheAdapter, "getFromCache")
      .mockRejectedValue(new Error("Cache error"));
    const saveToCacheSpy = vi
      .spyOn(fileCacheAdapter, "saveToCache")
      .mockResolvedValue(undefined);

    const result = await enhanceTokenTransaction(
      mockTransaction,
      1000,
      ChainId.BSC,
    );

    // Verify cache was attempted
    expect(getFromCacheSpy).toHaveBeenCalled();

    // Function should still work despite cache errors
    expect(result).toHaveProperty("valueInTokens");
    expect(result).toHaveProperty("tokenInfo");
    expect(result.valueInTokens).toBe(1); // 1000000000000000000 / 10^18 = 1

    // When cache fails, the entire try-catch block is skipped
    // So CoinGecko API won't be called and saveToCache won't be called
    expect(saveToCacheSpy).not.toHaveBeenCalled();
    expect(result.valueInUSD).toBeUndefined(); // No price data available
  }, 30000);

  it("should correctly calculate cache key from contract address", async () => {
    const getFromCacheSpy = vi
      .spyOn(fileCacheAdapter, "getFromCache")
      .mockResolvedValue(null);

    // Mock CoinGecko API response
    const mockPriceData = {
      source: "coingecko" as const,
      tokenAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      platform: "binance-smart-chain",
      currentPrice: 4,
      marketCap: 1200000,
      volume24h: 60000,
      priceChange24h: 1.8,
      lastUpdated: new Date().toISOString(),
    };

    vi.mocked(getTokenPriceByChainId).mockResolvedValue(mockPriceData);

    // Test with uppercase contract address to verify lowercase conversion
    const transactionWithUppercase = {
      ...mockTransaction,
      contractAddress: "0x0E09FABB73BD3ADE0A17ECC321FD13A19E81CE82", // Uppercase
    };

    await enhanceTokenTransaction(transactionWithUppercase, 1000, ChainId.BSC);

    // Verify cache key uses lowercase address
    expect(getFromCacheSpy).toHaveBeenCalledWith(
      "etherscan-token-prices",
      "token-price-0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // Should be lowercase
    );
  }, 30000);

  it("should respect different chain IDs in price fetching", async () => {
    vi.spyOn(fileCacheAdapter, "getFromCache").mockResolvedValue(null);
    const saveToCacheSpy = vi
      .spyOn(fileCacheAdapter, "saveToCache")
      .mockResolvedValue(undefined);

    // Mock CoinGecko API responses for different chains
    const mockPriceDataBSC = {
      source: "coingecko" as const,
      tokenAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      platform: "binance-smart-chain",
      currentPrice: 3.5,
      marketCap: 1000000,
      volume24h: 50000,
      priceChange24h: 2.5,
      lastUpdated: new Date().toISOString(),
    };

    const mockPriceDataETH = {
      source: "coingecko" as const,
      tokenAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      platform: "ethereum",
      currentPrice: 3.75,
      marketCap: 1100000,
      volume24h: 55000,
      priceChange24h: 2.8,
      lastUpdated: new Date().toISOString(),
    };

    const mockPriceDataPOLYGON = {
      source: "coingecko" as const,
      tokenAddress: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
      platform: "polygon-pos",
      currentPrice: 3.6,
      marketCap: 1050000,
      volume24h: 52000,
      priceChange24h: 2.6,
      lastUpdated: new Date().toISOString(),
    };

    // Mock the function to return different data based on chain ID
    vi.mocked(getTokenPriceByChainId)
      .mockResolvedValueOnce(mockPriceDataBSC)
      .mockResolvedValueOnce(mockPriceDataETH)
      .mockResolvedValueOnce(mockPriceDataPOLYGON);

    // Test with different chain IDs
    await enhanceTokenTransaction(mockTransaction, 1000, ChainId.BSC);
    await enhanceTokenTransaction(mockTransaction, 1000, ChainId.ETHEREUM);
    await enhanceTokenTransaction(mockTransaction, 1000, ChainId.POLYGON);

    // Both should attempt to save cache (assuming successful price fetch)
    // The chain ID affects which CoinGecko endpoint is called internally
    expect(saveToCacheSpy).toHaveBeenCalledTimes(3);
  }, 30000);
});
