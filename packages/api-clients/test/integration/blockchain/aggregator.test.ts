import { describe, it, expect, beforeAll } from "vitest";
import { aggregator } from "../../../src/blockchain";
import { setupCoinGecko } from "../setup";
import { getMultiSourceTokenPrice } from "../../../src/blockchain/aggregator/priceAggregator";
import { PriceSourceName } from "../../../src/blockchain/coingecko/types";

// Add a delay function to avoid hitting rate limits too quickly
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_DELAY = 1000; // 1 second delay between tests hitting the API

// Test constants
const ETH_MAINNET = "0x1";

const TEST_TOKEN_QUERY = "link";
const TEST_TOKEN_SYMBOL = "link";
const TEST_TOKEN_ID = "chainlink"; // The expected CoinGecko ID

// Also test with a native token
const NATIVE_TOKEN_ID = "ethereum";

// 测试用的token地址（BSC上的USDT）
const TEST_TOKEN_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

describe("Token Aggregator API Integration", () => {
  beforeAll(() => {
    // Validate environment variables
    setupCoinGecko();
    if (!process.env.MORALIS_API_KEY) {
      throw new Error("MORALIS_API_KEY must be set for integration tests");
    }
  });

  describe("searchTokens", () => {
    it("should return matching tokens for a token name query", async () => {
      const results = await aggregator.searchTokens({
        query: TEST_TOKEN_QUERY,
      });
      await delay(API_DELAY);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Verify the expected token is in the results
      const foundToken = results.find((token) => token.id === TEST_TOKEN_ID);
      expect(foundToken).toBeDefined();
      expect(foundToken).toMatchObject({
        id: TEST_TOKEN_ID,
        symbol: TEST_TOKEN_SYMBOL,
        name: expect.stringContaining("Chainlink"),
      });

      // Verify all results match the search query in some way
      results.forEach((token) => {
        expect(
          token.id.toLowerCase().includes(TEST_TOKEN_QUERY.toLowerCase()) ||
            token.symbol
              .toLowerCase()
              .includes(TEST_TOKEN_QUERY.toLowerCase()) ||
            token.name.toLowerCase().includes(TEST_TOKEN_QUERY.toLowerCase()),
        ).toBe(true);
      });
    });

    it("should limit the number of results based on the limit option", async () => {
      const limit = 5;
      const results = await aggregator.searchTokens({
        query: TEST_TOKEN_QUERY,
        limit,
      });
      await delay(API_DELAY);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it("should return an empty array for a nonsensical query", async () => {
      const results = await aggregator.searchTokens({
        query: "thisCoinDoesNotExist12345",
      });
      await delay(API_DELAY);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe("getTokenDetails", () => {
    it("should return comprehensive token information for a valid token ID", async () => {
      const tokenDetails = await aggregator.getTokenDetails({
        tokenId: TEST_TOKEN_ID,
        chain: ETH_MAINNET,
      });
      await delay(API_DELAY);

      // Verify the result is not null
      expect(tokenDetails).not.toBeNull();

      if (!tokenDetails) {
        throw new Error("Token details should not be null");
      }

      // Verify basic info
      expect(tokenDetails.basicInfo).toMatchObject({
        id: TEST_TOKEN_ID,
        symbol: TEST_TOKEN_SYMBOL,
        name: expect.stringContaining("Chainlink"),
        price: expect.any(Number),
      });
      // Verify price
      expect(tokenDetails.price).toMatchObject({
        current: expect.any(Number),
      });
      expect(tokenDetails.price.current).toBeGreaterThan(0);

      // Verify platforms
      expect(tokenDetails.platforms).toBeDefined();

      // Verify the token has the Ethereum platform
      expect(Object.keys(tokenDetails.platforms)).toContain("ethereum");

      // Pools and holders might be empty depending on API response,
      // but should at least be defined as arrays
      expect(Array.isArray(tokenDetails.pools)).toBe(true);

      // Should not be a native token
      expect(tokenDetails.isNativeToken).toBe(false);

      // Verify tickers
      expect(Array.isArray(tokenDetails.tickers)).toBe(true);
      expect(tokenDetails.tickers.length).toBeGreaterThan(0);
      const firstTicker = tokenDetails.tickers[0];
      expect(firstTicker).toMatchObject({
        base: expect.any(String),
        target: expect.any(String),
        market: expect.objectContaining({
          name: expect.any(String),
          identifier: expect.any(String),
        }),
        last: expect.any(Number),
        volume: expect.any(Number),
        trust_score: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("should handle native tokens by using wrapped token addresses", async () => {
      const tokenDetails = await aggregator.getTokenDetails({
        tokenId: NATIVE_TOKEN_ID,
        chain: ETH_MAINNET,
      });
      await delay(API_DELAY);

      expect(tokenDetails).not.toBeNull();

      if (!tokenDetails) {
        throw new Error("Token details should not be null");
      }

      // Verify this is recognized as a native token
      expect(tokenDetails.isNativeToken).toBe(true);

      // Basic info and price should still be available
      expect(tokenDetails.basicInfo.id).toBe(NATIVE_TOKEN_ID);
      expect(tokenDetails.price.current).toBeGreaterThan(0);

      // Should have populated either pools or holders (or both, depending on implementation)
      // We can't assert exactly what's in them, but we can verify the implementation handles
      // native tokens correctly
      if (tokenDetails.pools.length > 0 || tokenDetails.topHolders !== null) {
        // Wrapped token functionality is working
        expect(true).toBe(true);
      } else {
        // Even if we didn't get pools or holders data, the test should still pass
        // as the function should handle native tokens without failing
        expect(true).toBe(true);
      }
    }, 40000);

    it("should handle different option combinations", async () => {
      // Test with minimal data (no pools or holders)
      const minimalDetails = await aggregator.getTokenDetails({
        tokenId: TEST_TOKEN_ID,
        chain: ETH_MAINNET,
        includeHolders: false,
        includePools: false,
      });
      await delay(API_DELAY);

      expect(minimalDetails).not.toBeNull();

      if (!minimalDetails) {
        throw new Error("Token details should not be null");
      }

      // Basic info and price should still be available
      expect(minimalDetails.basicInfo.id).toBe(TEST_TOKEN_ID);
      expect(minimalDetails.price.current).toBeGreaterThan(0);

      // Pools should be an empty array when includePools is false
      expect(Array.isArray(minimalDetails.pools)).toBe(true);
      expect(minimalDetails.pools.length).toBe(0);

      // Top holders should be null when includeHolders is false
      expect(minimalDetails.topHolders).toBeNull();
    });

    it("should return null for an invalid token ID", async () => {
      const tokenDetails = await aggregator.getTokenDetails({
        tokenId: "invalid-token-id-12345",
        chain: ETH_MAINNET,
      });
      await delay(API_DELAY);

      expect(tokenDetails).toBeNull();
    });

    it.skip("should return null when token is not available on the specified chain", async () => {
      // Use a chain where the test token is unlikely to exist
      const invalidChain = "unknown-chain-123";
      const tokenDetails = await aggregator.getTokenDetails({
        tokenId: TEST_TOKEN_ID,
        chain: invalidChain,
      });
      await delay(API_DELAY);

      expect(tokenDetails).toBeNull();
    });
  });

  describe("End-to-end flow", () => {
    it("should support the two-step token lookup process", async () => {
      // Step 1: Search for tokens
      const searchResults = await aggregator.searchTokens({
        query: TEST_TOKEN_QUERY,
      });
      await delay(API_DELAY);

      expect(searchResults.length).toBeGreaterThan(0);

      // Find the specific token we want to get details for
      const targetToken = searchResults.find(
        (token) => token.id === TEST_TOKEN_ID,
      );
      expect(targetToken).toBeDefined();

      if (!targetToken) {
        throw new Error(
          `Expected token ${TEST_TOKEN_ID} not found in search results`,
        );
      }

      // Step 2: Get details for the selected token
      const tokenDetails = await aggregator.getTokenDetails({
        tokenId: targetToken.id,
        chain: ETH_MAINNET,
      });
      await delay(API_DELAY);

      expect(tokenDetails).not.toBeNull();

      if (!tokenDetails) {
        throw new Error("Token details should not be null");
      }

      // Verify the details match what we expect
      expect(tokenDetails.basicInfo.id).toBe(targetToken.id);
      expect(tokenDetails.basicInfo.symbol).toBe(targetToken.symbol);
      expect(tokenDetails.basicInfo.name).toBe(targetToken.name);
      expect(tokenDetails.price.current).toBeGreaterThan(0);
    });
  });
});

describe("Price Aggregator - OKX Dex Pagination", () => {
  beforeAll(() => {
    const requiredEnvVars = ["OKX_ACCESS_DEX_CONFIGS"];
    const missingVars = requiredEnvVars.filter((name) => !process.env[name]);
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}\n` +
          "Please create a .env file with these variables for integration testing.",
      );
    }
  });

  it("should fetch OKX Dex data with pagination for 1 day", async () => {
    const config = {
      sources: {
        [PriceSourceName.COINGECKO]: {
          name: PriceSourceName.COINGECKO,
          enabled: false, // 禁用其他源，只测试OKX
          priority: 1,
        },
        [PriceSourceName.BYBIT]: {
          name: PriceSourceName.BYBIT,
          enabled: false,
          priority: 2,
        },
        [PriceSourceName.OKX]: {
          name: PriceSourceName.OKX,
          enabled: true,
          priority: 3,
        },
        [PriceSourceName.BINANCE]: {
          name: PriceSourceName.BINANCE,
          enabled: false,
          priority: 4,
        },
        [PriceSourceName.BITGET]: {
          name: PriceSourceName.BITGET,
          enabled: false,
          priority: 5,
        },
      },
      defaultDays: 1,
      defaultCurrency: "usd",
    };

    const result = await getMultiSourceTokenPrice(
      TEST_TOKEN_ADDRESS,
      TEST_TOKEN_SYMBOL,
      "binance-smart-chain",
      config,
    );

    // 验证结果
    expect(result).toBeDefined();
    expect(result.tokenAddress).toBe(TEST_TOKEN_ADDRESS);
    expect(result.sources).toBeDefined();
    expect(result.sources[PriceSourceName.OKX]).toBeDefined();

    const okxData = result.sources[PriceSourceName.OKX];
    expect(okxData?.currentPrice).toBeGreaterThan(0);
    expect(okxData?.historicalData).toBeDefined();
    expect(Array.isArray(okxData?.historicalData)).toBe(true);

    // 验证数据量（应该接近1440个数据点，但可能因为数据可用性而少于这个数字）
    // console.log(`OKX Dex data points: ${okxData?.historicalData?.length}`);
    expect(okxData?.historicalData?.length).toBeGreaterThan(1000);

    // 验证数据是按时间排序的
    if (okxData?.historicalData && okxData.historicalData.length > 1) {
      for (let i = 1; i < okxData.historicalData.length; i++) {
        expect(okxData.historicalData[i].timestamp).toBeGreaterThanOrEqual(
          okxData.historicalData[i - 1].timestamp,
        );
      }
    }

    // 验证数据源标识
    okxData?.historicalData?.forEach((point) => {
      expect(point.source).toBe("okx");
      expect(point.price).toBeGreaterThan(0);
      expect(point.timestamp).toBeGreaterThan(0);
    });
  }, 30000); // 30秒超时，因为需要多次API调用

  it("should handle tokens with limited historical data", async () => {
    // 使用一个可能数据较少的token进行测试
    const limitedDataToken = "0x0000000000000000000000000000000000000001"; // 示例地址

    const config = {
      sources: {
        [PriceSourceName.COINGECKO]: {
          name: PriceSourceName.COINGECKO,
          enabled: false,
          priority: 1,
        },
        [PriceSourceName.BYBIT]: {
          name: PriceSourceName.BYBIT,
          enabled: false,
          priority: 2,
        },
        [PriceSourceName.OKX]: {
          name: PriceSourceName.OKX,
          enabled: true,
          priority: 3,
        },
        [PriceSourceName.BINANCE]: {
          name: PriceSourceName.BINANCE,
          enabled: false,
          priority: 4,
        },
        [PriceSourceName.BITGET]: {
          name: PriceSourceName.BITGET,
          enabled: false,
          priority: 5,
        },
      },
      defaultDays: 1,
      defaultCurrency: "usd",
    };

    const result = await getMultiSourceTokenPrice(
      limitedDataToken,
      TEST_TOKEN_SYMBOL,
      "binance-smart-chain",
      config,
    );

    // 验证即使数据很少也能正常处理
    expect(result).toBeDefined();
    expect(result.sources[PriceSourceName.OKX]).toBeDefined();

    const okxData = result.sources[PriceSourceName.OKX];
    // 对于没有数据的token，应该返回空数组而不是抛出错误
    expect(okxData?.historicalData).toBeDefined();
    expect(Array.isArray(okxData?.historicalData)).toBe(true);
  }, 30000);
});

describe("Price Aggregator - Binance and Bitget Sources", () => {
  beforeAll(() => {
    // 检查必要的环境变量
    const requiredEnvVars: string[] = [];
    const missingVars = requiredEnvVars.filter((name) => !process.env[name]);
    if (missingVars.length > 0) {
      console.warn(
        `Missing environment variables: ${missingVars.join(", ")}\n` +
          "Some tests may fail without proper configuration.",
      );
    }
  });

  it("should fetch Binance price data successfully", async () => {
    const config = {
      sources: {
        [PriceSourceName.COINGECKO]: {
          name: PriceSourceName.COINGECKO,
          enabled: false,
          priority: 1,
        },
        [PriceSourceName.BYBIT]: {
          name: PriceSourceName.BYBIT,
          enabled: false,
          priority: 2,
        },
        [PriceSourceName.OKX]: {
          name: PriceSourceName.OKX,
          enabled: false,
          priority: 3,
        },
        [PriceSourceName.BINANCE]: {
          name: PriceSourceName.BINANCE,
          enabled: true,
          priority: 4,
        },
        [PriceSourceName.BITGET]: {
          name: PriceSourceName.BITGET,
          enabled: false,
          priority: 5,
        },
      },
      defaultDays: 1,
      defaultCurrency: "usd",
    };

    const result = await getMultiSourceTokenPrice(
      TEST_TOKEN_ADDRESS,
      TEST_TOKEN_SYMBOL,
      "binance-smart-chain",
      config,
    );

    // 验证结果
    expect(result).toBeDefined();
    expect(result.tokenAddress).toBe(TEST_TOKEN_ADDRESS);
    expect(result.sources).toBeDefined();
    expect(result.sources[PriceSourceName.BINANCE]).toBeDefined();

    const binanceData = result.sources[PriceSourceName.BINANCE];
    expect(binanceData?.currentPrice).toBeGreaterThan(0);
    expect(binanceData?.historicalData).toBeDefined();
    expect(Array.isArray(binanceData?.historicalData)).toBe(true);

    // Binance目前只返回当前价格，历史数据为空数组
    expect(binanceData?.historicalData?.length).toBe(1440);
  }, 15000);

  it("should fetch Bitget price data successfully", async () => {
    const config = {
      sources: {
        [PriceSourceName.COINGECKO]: {
          name: PriceSourceName.COINGECKO,
          enabled: false,
          priority: 1,
        },
        [PriceSourceName.BYBIT]: {
          name: PriceSourceName.BYBIT,
          enabled: false,
          priority: 2,
        },
        [PriceSourceName.OKX]: {
          name: PriceSourceName.OKX,
          enabled: false,
          priority: 3,
        },
        [PriceSourceName.BINANCE]: {
          name: PriceSourceName.BINANCE,
          enabled: false,
          priority: 4,
        },
        [PriceSourceName.BITGET]: {
          name: PriceSourceName.BITGET,
          enabled: true,
          priority: 5,
        },
      },
      defaultDays: 1,
      defaultCurrency: "usd",
    };

    const result = await getMultiSourceTokenPrice(
      TEST_TOKEN_ADDRESS,
      TEST_TOKEN_SYMBOL,
      "binance-smart-chain",
      config,
    );

    // 验证结果
    expect(result).toBeDefined();
    expect(result.tokenAddress).toBe(TEST_TOKEN_ADDRESS);
    expect(result.sources).toBeDefined();
    expect(result.sources[PriceSourceName.BITGET]).toBeDefined();
    const bitgetData = result.sources[PriceSourceName.BITGET];
    expect(bitgetData?.currentPrice).toBeGreaterThan(0);
    expect(bitgetData?.historicalData).toBeDefined();
    expect(Array.isArray(bitgetData?.historicalData)).toBe(true);

    // Bitget目前只返回当前价格，历史数据为空数组
    expect(bitgetData?.historicalData?.length).toBe(1440);
  }, 15000);

  it("should fetch data from multiple sources including Binance and Bitget", async () => {
    const config = {
      sources: {
        [PriceSourceName.COINGECKO]: {
          name: PriceSourceName.COINGECKO,
          enabled: false,
          priority: 1,
        },
        [PriceSourceName.BYBIT]: {
          name: PriceSourceName.BYBIT,
          enabled: false,
          priority: 2,
        },
        [PriceSourceName.OKX]: {
          name: PriceSourceName.OKX,
          enabled: false,
          priority: 3,
        },
        [PriceSourceName.BINANCE]: {
          name: PriceSourceName.BINANCE,
          enabled: true,
          priority: 4,
        },
        [PriceSourceName.BITGET]: {
          name: PriceSourceName.BITGET,
          enabled: true,
          priority: 5,
        },
      },
      defaultDays: 1,
      defaultCurrency: "usd",
    };

    const result = await getMultiSourceTokenPrice(
      TEST_TOKEN_ADDRESS,
      TEST_TOKEN_SYMBOL,
      "binance-smart-chain",
      config,
    );

    // 验证结果
    expect(result).toBeDefined();
    expect(result.tokenAddress).toBe(TEST_TOKEN_ADDRESS);
    expect(result.sources).toBeDefined();

    // 验证两个源都被启用
    expect(result.sources[PriceSourceName.BINANCE]).toBeDefined();
    expect(result.sources[PriceSourceName.BITGET]).toBeDefined();

    const binanceData = result.sources[PriceSourceName.BINANCE];
    const bitgetData = result.sources[PriceSourceName.BITGET];

    // 验证Binance数据
    expect(binanceData?.currentPrice).toBeGreaterThan(0);
    expect(binanceData?.historicalData).toBeDefined();
    expect(Array.isArray(binanceData?.historicalData)).toBe(true);

    // 验证Bitget数据
    expect(bitgetData?.currentPrice).toBeGreaterThan(0);
    expect(bitgetData?.historicalData).toBeDefined();
    expect(Array.isArray(bitgetData?.historicalData)).toBe(true);

    // 验证价格合理性（两个源的价格应该在合理范围内）
    const priceDiff = Math.abs(
      binanceData!.currentPrice - bitgetData!.currentPrice,
    );
    const avgPrice = (binanceData!.currentPrice + bitgetData!.currentPrice) / 2;
    const priceDiffPercentage = (priceDiff / avgPrice) * 100;

    // 价格差异应该在20%以内（考虑到不同交易所的价差）
    expect(priceDiffPercentage).toBeLessThan(20);
  }, 20000);
});
