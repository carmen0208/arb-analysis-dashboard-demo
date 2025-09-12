import { describe, it, expect, beforeAll } from "vitest";
import {
  searchTweets,
  getUserTweets,
  getUserInfo,
  isRapidApiAvailable,
  createRapidApiConfig,
  type RapidApiUserInfoResult,
} from "../../../src/social/rapidApiTwitter";
import { fetchCoinListTweets } from "../../../src/social/coinListTweets";
import dotenv from "dotenv";
import { resolve } from "path";
import logger from "../../../src/common/logger";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../../../.env") });

// Required environment variables for RapidAPI testing
const requiredRapidApiEnvVars = ["RAPIDAPI_TWITTER_KEY"] as const;

function validateRapidApiEnv() {
  const missingVars = requiredRapidApiEnvVars.filter(
    (name) => !process.env[name],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required RapidAPI environment variables: ${missingVars.join(", ")}\n` +
        "Please create a .env file in the packages/api-clients directory with these variables.",
    );
  }
}

describe("RapidAPI Twitter Integration", () => {
  beforeAll(() => {
    // Only validate RapidAPI env if the key is set
    if (process.env.RAPIDAPI_TWITTER_KEY) {
      logger.info("RapidAPI key found, running RapidAPI tests");
    } else {
      logger.info("No RapidAPI key found, skipping RapidAPI-specific tests");
    }
  });

  describe("RapidAPI Functions", () => {
    it("should check RapidAPI availability correctly", () => {
      const isAvailable = isRapidApiAvailable();
      expect(typeof isAvailable).toBe("boolean");

      if (process.env.RAPIDAPI_TWITTER_KEY) {
        expect(isAvailable).toBe(true);
      } else {
        expect(isAvailable).toBe(false);
      }
    });

    it("should create RapidAPI config correctly", () => {
      const config = createRapidApiConfig("test-key", "https://test.com");
      expect(config).toEqual({
        apiKey: "test-key",
        baseUrl: "https://test.com",
      });

      const configWithoutBaseUrl = createRapidApiConfig("test-key");
      expect(configWithoutBaseUrl).toEqual({
        apiKey: "test-key",
        baseUrl: undefined,
      });
    });

    it("should search tweets successfully", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping RapidAPI search test - no API key");
        return;
      }

      const searchResults = await searchTweets("crypto", 5);

      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.length).toBeLessThanOrEqual(5);

      if (searchResults.length > 0) {
        const firstTweet = searchResults[0];
        expect(firstTweet).toHaveProperty("id");
        expect(firstTweet).toHaveProperty("text");
        expect(firstTweet).toHaveProperty("createdAt");
        expect(firstTweet).toHaveProperty("source", "rapidapi");
        expect(typeof firstTweet.text).toBe("string");
        expect(firstTweet.text.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should get user tweets successfully", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping RapidAPI user tweets test - no API key");
        return;
      }

      // First get user info to get the user ID
      const userInfo = await getUserInfo("bwenews");

      // Skip if user is unavailable
      if (userInfo.__typename === "UserUnavailable") {
        logger.info("User is unavailable, skipping user tweets test");
        return;
      }

      const userTweets = await getUserTweets(userInfo.rest_id, 100);
      expect(Array.isArray(userTweets)).toBe(true);
      // expect(userTweets.length).toBeLessThanOrEqual(3);

      if (userTweets.length > 0) {
        const firstTweet = userTweets[0];
        expect(firstTweet).toHaveProperty("id");
        expect(firstTweet).toHaveProperty("text");
        expect(firstTweet).toHaveProperty("createdAt");
        expect(firstTweet).toHaveProperty("source", "rapidapi");
        expect(typeof firstTweet.text).toBe("string");
        expect(firstTweet.text.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should get user info successfully", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping RapidAPI user info test - no API key");
        return;
      }

      const userInfo: RapidApiUserInfoResult = await getUserInfo("bwenews");
      console.log(userInfo);

      expect(userInfo).toBeDefined();

      // Handle both User and UserUnavailable cases
      if (userInfo.__typename === "User") {
        expect(userInfo).toHaveProperty("rest_id");
        expect(userInfo).toHaveProperty("core");
        expect(userInfo).toHaveProperty("legacy");
        expect(userInfo.core).toHaveProperty("screen_name");
        expect(userInfo.core).toHaveProperty("name");
        expect(userInfo.legacy).toHaveProperty("followers_count");
        expect(userInfo.legacy).toHaveProperty("description");
      } else if (userInfo.__typename === "UserUnavailable") {
        expect(userInfo).toHaveProperty("message");
        expect(userInfo).toHaveProperty("reason");
      } else {
        throw new Error(
          `Unexpected user info type: ${(userInfo as any).__typename}`,
        );
      }
    }, 30000);

    it("should work with custom config", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping custom config test - no API key");
        return;
      }

      const customConfig = createRapidApiConfig(
        process.env.RAPIDAPI_TWITTER_KEY!,
        "https://twitter241.p.rapidapi.com",
      );

      const userInfo = await getUserInfo("bwenews", customConfig);

      // Skip if user is unavailable
      if (userInfo.__typename === "UserUnavailable") {
        logger.info("User is unavailable, skipping custom config test");
        return;
      }

      const userTweets = await getUserTweets(userInfo.rest_id, 2, customConfig);

      expect(Array.isArray(userTweets)).toBe(true);
      expect(userTweets.length).toBeLessThanOrEqual(2);
    }, 30000);
  });

  describe("fetchCoinListTweets with RapidAPI", () => {
    it("should fetch coin listings using RapidAPI when available", async () => {
      const listings = await fetchCoinListTweets(10);

      expect(Array.isArray(listings)).toBe(true);

      if (listings.length > 0) {
        const firstListing = listings[0];
        expect(firstListing).toHaveProperty("exchange");
        expect(firstListing).toHaveProperty("coins");
        expect(firstListing).toHaveProperty("tradeType");
        expect(firstListing).toHaveProperty("marketCaps");
        expect(firstListing).toHaveProperty("timestamp");

        // Validate exchange is either null or a valid exchange name
        if (firstListing.exchange) {
          const validExchanges = [
            "UPBIT",
            "BITHUMB",
            "BINANCE",
            "COINBASE",
            "OKX",
            "BYBIT",
            "BITGET",
          ];
          expect(validExchanges).toContain(firstListing.exchange.toUpperCase());
        }

        // Validate coins array
        expect(Array.isArray(firstListing.coins)).toBe(true);
        if (firstListing.coins.length > 0) {
          firstListing.coins.forEach((coin) => {
            expect(typeof coin).toBe("string");
            expect(coin.length).toBeGreaterThan(0);
            expect(coin.length).toBeLessThanOrEqual(10);
          });
        }

        // Validate tradeType
        if (firstListing.tradeType) {
          const validTradeTypes = ["spot", "perpetual", "futures"];
          expect(validTradeTypes).toContain(firstListing.tradeType);
        }

        // Validate marketCaps
        expect(typeof firstListing.marketCaps).toBe("object");
        expect(firstListing.marketCaps).not.toBeNull();

        // Validate timestamp
        expect(typeof firstListing.timestamp).toBe("string");
        expect(new Date(firstListing.timestamp).getTime()).not.toBeNaN();
      }
    }, 30000);

    it("should handle rate limiting gracefully", async () => {
      // Test that the function can handle potential rate limiting
      // by making multiple calls in quick succession
      const promises = [
        fetchCoinListTweets(5),
        fetchCoinListTweets(5),
        fetchCoinListTweets(5),
      ];

      const results = await Promise.allSettled(promises);

      // At least one call should succeed
      const successfulResults = results.filter(
        (result) => result.status === "fulfilled",
      );
      expect(successfulResults.length).toBeGreaterThan(0);

      // If any call succeeded, validate the structure
      const successfulResult = successfulResults[0] as PromiseFulfilledResult<
        any[]
      >;
      if (successfulResult.value.length > 0) {
        expect(Array.isArray(successfulResult.value)).toBe(true);
        expect(successfulResult.value[0]).toHaveProperty("exchange");
        expect(successfulResult.value[0]).toHaveProperty("coins");
      }
    }, 60000);

    it("should return empty array when no listings found", async () => {
      const listings = await fetchCoinListTweets(1);

      expect(Array.isArray(listings)).toBe(true);

      // If no listings found, should be empty array
      if (listings.length === 0) {
        expect(listings).toEqual([]);
      }
    }, 30000);

    it("should extract valid coin symbols", async () => {
      const listings = await fetchCoinListTweets(10);

      expect(Array.isArray(listings)).toBe(true);

      if (listings.length > 0) {
        listings.forEach((listing) => {
          expect(Array.isArray(listing.coins)).toBe(true);

          listing.coins.forEach((coin) => {
            expect(typeof coin).toBe("string");
            expect(coin.length).toBeGreaterThanOrEqual(2);
            expect(coin.length).toBeLessThanOrEqual(10);
            // Should be uppercase letters
            expect(/^[A-Z]+$/.test(coin)).toBe(true);
          });
        });
      }
    }, 30000);

    it("should handle note tweets correctly", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping note tweet test - no API key");
        return;
      }

      // Search for tweets that might contain note tweets
      const tweets = await searchTweets("COINBASE LISTING", 5);

      expect(Array.isArray(tweets)).toBe(true);

      if (tweets.length > 0) {
        tweets.forEach((tweet) => {
          expect(tweet).toHaveProperty("text");
          expect(tweet).toHaveProperty("fullText");
          expect(typeof tweet.text).toBe("string");
          expect(tweet.text.length).toBeGreaterThan(0);

          // Both text and fullText should be the same (either note text or legacy text)
          expect(tweet.text).toBe(tweet.fullText);

          // Check if this is a note tweet by looking at the raw data
          const rawTweet = tweet.raw as any; // Type assertion for raw data
          if (rawTweet?.note_tweet_results?.result?.text) {
            logger.info("Found note tweet", {
              id: tweet.id,
              noteTextLength: rawTweet.note_tweet_results.result.text.length,
              legacyTextLength: rawTweet.legacy?.full_text?.length || 0,
            });
          }
        });
      }
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle missing API key gracefully", () => {
      const originalKey = process.env.RAPIDAPI_TWITTER_KEY;
      delete process.env.RAPIDAPI_TWITTER_KEY;

      expect(isRapidApiAvailable()).toBe(false);

      // Restore the key
      if (originalKey) {
        process.env.RAPIDAPI_TWITTER_KEY = originalKey;
      }
    });

    it("should handle API errors gracefully", async () => {
      if (!isRapidApiAvailable()) {
        logger.info("Skipping API error test - no API key");
        return;
      }

      // Test with invalid parameters that should cause API errors
      try {
        await searchTweets("", 0);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    }, 30000);
  });
});
