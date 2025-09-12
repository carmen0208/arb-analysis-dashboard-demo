import { describe, it, expect, beforeAll } from "vitest";
import { fetchCoinListTweets } from "../../../src/social/coinListTweets";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../../../.env") });

// Required environment variables for Twitter scraping
const requiredTwitterEnvVars = [
  "TWITTER_USERNAME",
  "TWITTER_PASSWORD",
  "TWITTER_EMAIL",
] as const;

function validateTwitterEnv() {
  const missingVars = requiredTwitterEnvVars.filter(
    (name) => !process.env[name],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Twitter environment variables: ${missingVars.join(", ")}\n` +
        "Please create a .env file in the packages/api-clients directory with these variables.",
    );
  }
}

// Define ListingInfo type for testing
type ListingInfo = {
  exchange: string | null;
  coins: string[];
  tradeType: string | null;
  marketCaps: Record<string, string>;
};

describe("fetchCoinListTweets integration", () => {
  beforeAll(() => {
    validateTwitterEnv();
  });

  it("should fetch and extract listing information from bwenews tweets", async () => {
    const listings = await fetchCoinListTweets();
    // Basic structure validation
    expect(Array.isArray(listings)).toBe(true);

    // If we have listings, validate their structure
    if (listings.length > 0) {
      const firstListing: ListingInfo = listings[0];

      // Validate ListingInfo structure
      expect(
        firstListing.exchange === null ||
          typeof firstListing.exchange === "string",
      ).toBe(true);
      expect(Array.isArray(firstListing.coins)).toBe(true);
      expect(
        firstListing.tradeType === null ||
          typeof firstListing.tradeType === "string",
      ).toBe(true);
      expect(typeof firstListing.marketCaps).toBe("object");

      // Validate coins array contains strings
      if (firstListing.coins.length > 0) {
        expect(typeof firstListing.coins[0]).toBe("string");
      }

      // Validate marketCaps is a record of string keys to string values
      if (Object.keys(firstListing.marketCaps).length > 0) {
        const [firstKey, firstValue] = Object.entries(
          firstListing.marketCaps,
        )[0];
        expect(typeof firstKey).toBe("string");
        expect(typeof firstValue).toBe("string");
      }
    }
  }, 20000);

  it("should extract valid exchange names", async () => {
    const listings = await fetchCoinListTweets();

    if (listings.length > 0) {
      // Check that exchanges are either null or valid exchange names
      const validExchanges = [
        "UPBIT",
        "BITHUMB",
        "BINANCE",
        "COINBASE",
        "OKX",
        "BYBIT",
        "BITGET",
      ];
      const allValidExchanges = listings.every((listing) =>
        validExchanges.includes(listing.exchange.toUpperCase() || ""),
      );
      expect(allValidExchanges).toBe(true);
    }
  });

  it("should extract valid trade types", async () => {
    const listings = await fetchCoinListTweets();

    if (listings.length > 0) {
      // Check that trade types are either null or valid types
      const validTradeTypes = ["spot", "perpetual", "futures"];
      const allValidTradeTypes = listings.every(
        (listing) =>
          listing.tradeType === null ||
          validTradeTypes.includes(listing.tradeType),
      );
      expect(allValidTradeTypes).toBe(true);
    }
  });

  it("should extract coin symbols correctly", async () => {
    const listings = await fetchCoinListTweets();

    if (listings.length > 0) {
      // Check that coins are valid symbols (2-10 uppercase letters)
      const allValidCoins = listings.every((listing) =>
        listing.coins.every(
          (coin) =>
            typeof coin === "string" &&
            coin.length >= 2 &&
            coin.length <= 10 &&
            /^[A-Z]+$/.test(coin),
        ),
      );
      expect(allValidCoins).toBe(true);
    }
  });

  it("should handle rate limiting gracefully", async () => {
    // Test that the function can handle potential rate limiting
    // by making multiple calls in quick succession
    const promises = [
      fetchCoinListTweets(),
      fetchCoinListTweets(),
      fetchCoinListTweets(),
    ];

    const results = await Promise.allSettled(promises);

    // At least one call should succeed
    const successfulResults = results.filter(
      (result) => result.status === "fulfilled",
    );
    expect(successfulResults.length).toBeGreaterThan(0);

    // If any call succeeded, validate the structure
    const successfulResult = successfulResults[0] as PromiseFulfilledResult<
      ListingInfo[]
    >;
    if (successfulResult.value.length > 0) {
      expect(Array.isArray(successfulResult.value)).toBe(true);
      expect(
        successfulResult.value[0].exchange === null ||
          typeof successfulResult.value[0].exchange === "string",
      ).toBe(true);
    }
  });

  it("should return empty array when no listings found", async () => {
    // This test validates that the function handles cases where no listings are extracted
    const listings = await fetchCoinListTweets();

    // Should always return an array
    expect(Array.isArray(listings)).toBe(true);

    // If no listings found, should be empty array
    if (listings.length === 0) {
      expect(listings).toEqual([]);
    }
  });

  it("should process multiple tweets and combine text correctly", async () => {
    const listings = await fetchCoinListTweets();

    // The function should process up to 20 tweets from bwenews
    // and extract listings from the combined text
    expect(Array.isArray(listings)).toBe(true);

    // If we have listings, they should have been extracted from tweet text
    if (listings.length > 0) {
      // Each listing should have the expected structure
      listings.forEach((listing) => {
        expect(listing).toHaveProperty("exchange");
        expect(listing).toHaveProperty("coins");
        expect(listing).toHaveProperty("tradeType");
        expect(listing).toHaveProperty("marketCaps");
      });
    }
  });
});
