import { describe, it, expect } from "vitest";
import { getOFTInfoFromAPI } from "../../../src/blockchain/layerzero/services/apiDetector";
import { testConfig, delay } from "./setup";

describe("LayerZero API Detection Integration", () => {
  describe("getOFTInfoFromAPI", () => {
    it(
      "should retrieve OFT information from API in raw format",
      async () => {
        const oftInfo = await getOFTInfoFromAPI(
          testConfig.contracts.ethena_sUSDe_ethereum,
          "ethereum",
        );

        if (oftInfo !== null) {
          // Should return raw LayerZero API response format
          expect(typeof oftInfo).toBe("object");

          // Check for token symbol keys
          const tokenSymbols = Object.keys(oftInfo);
          expect(tokenSymbols.length).toBeGreaterThan(0);

          // Each token should have proper structure
          tokenSymbols.forEach((symbol) => {
            const tokenEntries = oftInfo[symbol];
            expect(Array.isArray(tokenEntries)).toBe(true);

            tokenEntries.forEach((entry) => {
              expect(entry).toHaveProperty("name");
              expect(entry).toHaveProperty("sharedDecimals");
              expect(entry).toHaveProperty("endpointVersion");
              expect(entry).toHaveProperty("deployments");
              expect(typeof entry.deployments).toBe("object");
            });
          });
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.api,
    );

    it(
      "should return null for non-OFT contract",
      async () => {
        const oftInfo = await getOFTInfoFromAPI(
          "0xA0b86991c6218b36C1d19D4a2e9Eb0cE3606eB48", // USDC
          "ethereum",
        );

        expect(oftInfo).toBeNull();

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.api,
    );

    it(
      "should handle invalid contract addresses",
      async () => {
        const oftInfo = await getOFTInfoFromAPI(
          "0x0000000000000000000000000000000000000000",
          "ethereum",
        );

        expect(oftInfo).toBeNull();

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.api,
    );
  });
});
