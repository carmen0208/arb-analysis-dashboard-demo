import { describe, it, expect, beforeAll, beforeEach } from "vitest"; // Add beforeEach
import { promises as fs } from "fs"; // Import fs promises
import path from "path"; // Import path
import {
  getAllCoinLists,
  getCoinInfo,
  getCoinPrice,
  getCoinAddresses,
  getTopTokens,
  CoinListInfo,
  TokenInfo,
  getCoinInfoBySymbol,
  getCoinTickers,
  Ticker,
  getCoinMarkets,
  CoinMarketData,
} from "../../../src/blockchain/coingecko"; // Adjust path as needed
import logger from "../../../src/common/logger";
import { setupCoinGecko } from "../setup";

// Add a delay function to avoid hitting rate limits too quickly
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_DELAY = 1000; // 1 second delay between tests hitting the API
// Define cache path consistent with implementation for cleanup
const CACHE_DIR = path.resolve(__dirname, "../../../.cache");
const CACHE_FILE_PATH = path.join(CACHE_DIR, "coingecko-coinlist.json");

describe("CoinGecko API Integration", () => {
  // No specific setup needed like Octokit, as axios is used internally

  beforeAll(() => {
    // Optional: Pre-fetch the coin list once to potentially speed up getCoinInfo tests
    // and warm up the cache, but be mindful of initial rate limit hit.
    // await getAllCoinLists();
    // await delay(API_DELAY); // Delay after potential pre-fetch
    setupCoinGecko();
  });

  describe("getAllCoinLists", () => {
    // Clean up cache file before each test in this suite
    beforeEach(async () => {
      try {
        await fs.unlink(CACHE_FILE_PATH);
        logger.info(`Deleted cache file: ${CACHE_FILE_PATH}`);
      } catch (err: any) {
        if (err.code === "ENOENT") {
          // File doesn't exist, which is fine before the first run
          logger.info(`Cache file not found (expected): ${CACHE_FILE_PATH}`);
        } else {
          // Log other errors if they occur during cleanup
          logger.error(`Error deleting cache file: ${err.message}`);
        }
      }
    });

    it("should fetch the complete list of coins when cache is empty", async () => {
      const coins = await getAllCoinLists();
      await delay(API_DELAY);

      expect(Array.isArray(coins)).toBe(true);
      expect(coins.length).toBeGreaterThan(1000); // Expect a large number of coins

      // Check the structure of the first few coins
      for (let i = 0; i < Math.min(5, coins.length); i++) {
        expect(coins[i]).toMatchObject<CoinListInfo>({
          id: expect.any(String),
          symbol: expect.any(String),
          name: expect.any(String),
        });
        expect(coins[i].id).toBeTruthy(); // Ensure id is not empty
        expect(coins[i].symbol).toBeTruthy(); // Ensure symbol is not empty
        expect(coins[i].name).toBeTruthy(); // Ensure name is not empty
      }
    }, 20000); // Increase timeout slightly for potential API slowness

    it("should use the file cache on subsequent calls within cache duration", async () => {
      // 1. First call (fetches from API and writes cache)
      logger.debug("Cache test: First call (expecting API fetch)...");
      const initialCoins = await getAllCoinLists();
      expect(Array.isArray(initialCoins)).toBe(true);
      expect(initialCoins.length).toBeGreaterThan(1000);
      const initialLength = initialCoins.length;
      logger.debug(`Cache test: First call fetched ${initialLength} coins.`);

      // Add a small delay just to ensure file write completes if needed, though await should handle it.
      await delay(100);

      // 2. Second call (should read from file cache)
      logger.debug("Cache test: Second call (expecting file cache read)...");
      const cachedCoins = await getAllCoinLists();
      expect(Array.isArray(cachedCoins)).toBe(true);
      expect(cachedCoins.length).toBe(initialLength); // Should have the same number of coins
      logger.debug(
        `Cache test: Second call returned ${cachedCoins.length} coins from cache.`,
      );

      // Optional: Verify structure again on cached data
      expect(cachedCoins[0]).toMatchObject<CoinListInfo>({
        id: expect.any(String),
        symbol: expect.any(String),
        name: expect.any(String),
      });
    }, 25000); // Slightly longer timeout to accommodate two calls if the first is slow
  });

  describe("getCoinInfo", () => {
    it("should filter the coin list for a known coin (e.g., bitcoin)", async () => {
      const query = "bitcoin";
      const results = await getCoinInfo(query);
      await delay(API_DELAY);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check if 'bitcoin' itself is present
      const bitcoinEntry = results.find((coin) => coin.id === "bitcoin");
      expect(bitcoinEntry).toBeDefined();
      expect(bitcoinEntry).toMatchObject<CoinListInfo>({
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
      });

      // Check if other results also contain the query string (case-insensitive)
      results.forEach((coin) => {
        expect(
          coin.id.toLowerCase().includes(query) ||
            coin.symbol.toLowerCase().includes(query) ||
            coin.name.toLowerCase().includes(query),
        ).toBe(true);
      });
    });

    it("should return an empty array for a nonsensical query", async () => {
      const query = "thisCoinDoesNotExist12345";
      const results = await getCoinInfo(query);
      await delay(API_DELAY);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe("getCoinInfoBySymbol", () => {
    it("should fetch the coin info for a known coin symbol (e.g., bitcoin)", async () => {
      const symbol = "btc";
      // const symbol = "merl";
      // const symbol = "tgt";
      // const symbol = "xter";
      const results = await getCoinInfoBySymbol(symbol);
      await delay(API_DELAY);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check if 'bitcoin' itself is present
      const bitcoinEntry = results.find((coin) => coin.id === "bitcoin");
      expect(bitcoinEntry).toBeDefined();
      expect(bitcoinEntry).toMatchObject<CoinListInfo>({
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
      });

      // Check if other results also contain the query string (case-insensitive)
      results.forEach((coin) => {
        expect(coin.symbol.toLowerCase().includes(symbol)).toBe(true);
      });
    });
  });

  describe("getCoinPrice", () => {
    it("should fetch the price for a known coin ID (bitcoin) in USD", async () => {
      // const price = await getCoinPrice("tokyo-games-token", "usd");
      // const price = await getCoinPrice("xterio", "usd");
      // const price = await getCoinPrice("merlin-chain", "usd");
      // const price = await getCoinPrice("tokyo-games-token", "usd");

      const price = await getCoinPrice("bitcoin", "usd");
      await delay(API_DELAY);
      expect(price).toBeTypeOf("number");
      expect(price).toBeGreaterThan(0);
    });

    it("should fetch the price for a known coin ID (ethereum) in EUR", async () => {
      const price = await getCoinPrice("ethereum", "eur");
      await delay(API_DELAY);

      expect(price).toBeTypeOf("number");
      expect(price).toBeGreaterThan(0);
    });

    it("should return null for an invalid coin ID", async () => {
      const price = await getCoinPrice("invalid-coin-id-123", "usd");
      await delay(API_DELAY);

      expect(price).toBeNull();
    });
  });

  describe("getCoinAddresses", () => {
    it("should fetch platform addresses for a coin with multiple platforms (ethereum)", async () => {
      const platforms = await getCoinAddresses("uniswap");
      // const platforms = await getCoinAddresses("tokyo-games-token");
      // const platforms = await getCoinAddresses("xterio");
      // const platforms = await getCoinAddresses("merlin-chain");
      await delay(API_DELAY);

      expect(platforms).toBeTypeOf("object");
      expect(platforms).not.toBeNull();

      // Check for presence of some known platform keys (these might change over time)
      expect(Object.keys(platforms!).length).toBeGreaterThan(1);
      expect(platforms).toHaveProperty("optimistic-ethereum");
      expect(platforms!["optimistic-ethereum"]).toMatch(/^0x[a-fA-F0-9]{40}$/); // Check address format
      expect(platforms).toHaveProperty("arbitrum-one");
      expect(platforms!["arbitrum-one"]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should fetch platform addresses for a coin with fewer platforms (bitcoin)", async () => {
      // Bitcoin primarily exists on its own chain, might have limited representation elsewhere
      const platforms = await getCoinAddresses("bitcoin");
      await delay(API_DELAY);

      expect(platforms).toBeTypeOf("object"); // API returns {} even if empty
      expect(platforms).not.toBeNull();
      // Check if it's empty or contains only specific known representations if any
      // expect(Object.keys(platforms!).length).toBeLessThan(5); // Example assertion
    });

    it("should return null for an invalid coin ID", async () => {
      const platforms = await getCoinAddresses("invalid-coin-id-123");
      await delay(API_DELAY);

      expect(platforms).toBeNull();
    });
  });

  describe("getTopTokens", () => {
    it("should fetch the top 10 tokens by market cap by default", async () => {
      const tokens = await getTopTokens();
      await delay(API_DELAY);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(10);

      // Check structure of the first token
      const firstToken = tokens[0];
      expect(firstToken).toMatchObject<Partial<TokenInfo>>({
        id: expect.any(String),
        symbol: expect.any(String),
        name: expect.any(String),
        price: expect.any(Number),
        marketCap: expect.any(Number),
        volume24h: expect.any(Number),
        change24h: expect.any(Number),
      });
      expect(firstToken.price).toBeGreaterThan(0);
      expect(firstToken.marketCap).toBeGreaterThan(0);
    });

    it("should respect the limit parameter", async () => {
      const limit = 5;
      const tokens = await getTopTokens(limit);
      await delay(API_DELAY);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(limit);
    });

    it("should fetch top 3 tokens when limit is 3", async () => {
      const limit = 3;
      const tokens = await getTopTokens(limit);
      await delay(API_DELAY);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(limit);
      // Check structure of the first token
      const firstToken = tokens[0];
      expect(firstToken).toMatchObject<Partial<TokenInfo>>({
        id: expect.any(String),
        symbol: expect.any(String),
        name: expect.any(String),
        price: expect.any(Number),
        marketCap: expect.any(Number),
      });
    });
  });

  describe("getCoinTickers", () => {
    it("should fetch tickers for a known coin ID (bitcoin)", async () => {
      const tickers = await getCoinTickers("bitcoin");
      await delay(API_DELAY);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBeGreaterThan(0);
      // Check structure of the first ticker
      const first = tickers[0];
      expect(first).toMatchObject<Partial<Ticker>>({
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
    it("should return an empty array for an invalid coin ID", async () => {
      const tickers = await getCoinTickers("invalid-coin-id-12345");
      await delay(API_DELAY);
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBe(0);
    });
  });

  describe("getCoinMarkets", () => {
    it("should fetch market data for bitcoin and ethereum", async () => {
      const data = await getCoinMarkets({
        vs_currency: "usd",
        ids: "bitcoin,ethereum",
        order: "market_cap_desc",
        per_page: 2,
        page: 1,
      });
      await delay(API_DELAY);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      for (const coin of data) {
        expect(coin).toMatchObject<Partial<CoinMarketData>>({
          id: expect.any(String),
          symbol: expect.any(String),
          name: expect.any(String),
          current_price: expect.any(Number),
          market_cap: expect.any(Number),
          market_cap_rank: expect.any(Number),
          total_volume: expect.any(Number),
        });
        expect(["bitcoin", "ethereum"]).toContain(coin.id);
      }
    });

    it("should respect per_page and page parameters", async () => {
      const data = await getCoinMarkets({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: 3,
        page: 2,
      });
      await delay(API_DELAY);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
    });

    it("should return an empty array for nonsense ids", async () => {
      const data = await getCoinMarkets({
        vs_currency: "usd",
        ids: "thisCoinDoesNotExist12345",
      });
      await delay(API_DELAY);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });
});
