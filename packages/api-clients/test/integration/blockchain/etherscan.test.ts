/**
 * Etherscan API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTokenTransactions,
  monitorLargeTransfers,
  ChainId,
  MonitoringConfig,
} from "../../../src/blockchain/etherscan";

describe("Etherscan API Integration", () => {
  const testAddress = "0x93dEb693b170d56BdDe1B0a5222B14c0F885d976";
  const testAddress2 = "0x73d8bd54f7cf5fab43fe4ef40a62d390644946db";
  beforeAll(() => {
    // Set up test environment
    if (!process.env.ETHERSCAN_API_KEY) {
      console.warn("ETHERSCAN_API_KEY not set, some tests may fail");
    }
  });

  afterAll(() => {
    // Clean up
  });

  describe("getTokenTransactions", () => {
    it("should fetch token transactions for a valid BSC address", async () => {
      const transactions = await getTokenTransactions(
        testAddress,
        ChainId.BSC,
        {
          page: 1,
          offset: 10,
          forceRefresh: true,
        },
      );

      expect(Array.isArray(transactions)).toBe(true);

      if (transactions.length > 0) {
        const tx = transactions[0];

        // Check required fields
        expect(tx).toHaveProperty("blockNumber");
        expect(tx).toHaveProperty("hash");
        expect(tx).toHaveProperty("from");
        expect(tx).toHaveProperty("to");
        expect(tx).toHaveProperty("contractAddress");
        expect(tx).toHaveProperty("value");
        expect(tx).toHaveProperty("tokenName");
        expect(tx).toHaveProperty("tokenSymbol");
        expect(tx).toHaveProperty("tokenDecimal");
        expect(tx).toHaveProperty("timeStamp");

        // Check data types
        expect(typeof tx.blockNumber).toBe("string");
        expect(typeof tx.hash).toBe("string");
        expect(typeof tx.from).toBe("string");
        expect(typeof tx.to).toBe("string");
        expect(typeof tx.contractAddress).toBe("string");
        expect(typeof tx.value).toBe("string");
        expect(typeof tx.tokenName).toBe("string");
        expect(typeof tx.tokenSymbol).toBe("string");
        expect(typeof tx.tokenDecimal).toBe("string");
        expect(typeof tx.timeStamp).toBe("string");

        // Check address format
        expect(tx.from).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(tx.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(tx.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(tx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);

        // Check numeric values
        expect(parseInt(tx.blockNumber)).toBeGreaterThan(0);
        expect(parseInt(tx.timeStamp)).toBeGreaterThan(0);
        expect(parseInt(tx.tokenDecimal)).toBeGreaterThanOrEqual(0);
        expect(parseInt(tx.tokenDecimal)).toBeLessThanOrEqual(18);
      }
    }, 30000);

    it("should handle pagination correctly", async () => {
      const page1 = await getTokenTransactions(testAddress, ChainId.BSC, {
        page: 1,
        offset: 5,
        forceRefresh: true,
      });

      const page2 = await getTokenTransactions(testAddress, ChainId.BSC, {
        page: 2,
        offset: 5,
        forceRefresh: true,
      });
      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);

      // If both pages have data, they should be different transactions
      if (page1.length > 0 && page2.length > 0) {
        const page1Hashes = new Set(page1.map((tx) => tx.hash));
        const page2Hashes = new Set(page2.map((tx) => tx.hash));

        // Check for overlap (should be minimal or none)
        const overlap = [...page1Hashes].filter((hash) =>
          page2Hashes.has(hash),
        );
        expect(overlap.length).toBeLessThanOrEqual(1); // Allow for edge cases
      }
    }, 60000);

    it("should handle different sort orders", async () => {
      const asc = await getTokenTransactions(testAddress, ChainId.BSC, {
        page: 1,
        offset: 5,
        sort: "asc",
        forceRefresh: true,
      });

      const desc = await getTokenTransactions(testAddress, ChainId.BSC, {
        page: 1,
        offset: 5,
        sort: "desc",
        forceRefresh: true,
      });

      expect(Array.isArray(asc)).toBe(true);
      expect(Array.isArray(desc)).toBe(true);

      if (asc.length > 1 && desc.length > 1) {
        // Check that timestamps are in correct order
        const ascTimestamps = asc.map((tx) => parseInt(tx.timeStamp));
        const descTimestamps = desc.map((tx) => parseInt(tx.timeStamp));

        // Verify ascending order
        for (let i = 1; i < ascTimestamps.length; i++) {
          expect(ascTimestamps[i]).toBeGreaterThanOrEqual(ascTimestamps[i - 1]);
        }

        // Verify descending order
        for (let i = 1; i < descTimestamps.length; i++) {
          expect(descTimestamps[i]).toBeLessThanOrEqual(descTimestamps[i - 1]);
        }
      }
    }, 60000);
  });

  describe("monitorLargeTransfers", () => {
    it("should monitor large transfers with test configuration", async () => {
      const config: MonitoringConfig = {
        addresses: [testAddress],
        thresholds: {
          [testAddress]: {
            minAmountUSD: 1000, // $1k threshold for testing
          },
        },
        intervalMinutes: 5,
        chainId: ChainId.BSC,
      };

      const result = await monitorLargeTransfers(config);

      // Check result structure
      expect(result).toHaveProperty("chainId");
      expect(result).toHaveProperty("blockRange");
      expect(result).toHaveProperty("transactions");
      expect(result).toHaveProperty("largeTransfers");
      expect(result).toHaveProperty("summary");

      // Check chain ID
      expect(result.chainId).toBe(ChainId.BSC);

      // Check arrays
      expect(Array.isArray(result.transactions)).toBe(true);
      expect(Array.isArray(result.largeTransfers)).toBe(true);

      // Check summary
      expect(typeof result.summary.totalTransactions).toBe("number");
      expect(typeof result.summary.largeTransfersCount).toBe("number");
      expect(typeof result.summary.totalValueUSD).toBe("number");
      expect(Array.isArray(result.summary.monitoredAddresses)).toBe(true);

      // Check logical relationships
      expect(result.summary.largeTransfersCount).toBeLessThanOrEqual(
        result.summary.totalTransactions,
      );
      expect(result.summary.monitoredAddresses).toContain(testAddress);

      // Check block range
      expect(result.blockRange).toHaveProperty("startBlock");
      expect(result.blockRange).toHaveProperty("endBlock");
      expect(result.blockRange).toHaveProperty("timestamp");
      expect(typeof result.blockRange.startBlock).toBe("number");
      expect(typeof result.blockRange.endBlock).toBe("number");
      expect(typeof result.blockRange.timestamp).toBe("number");
      expect(result.blockRange.startBlock).toBeGreaterThanOrEqual(0);
      expect(result.blockRange.endBlock).toBeGreaterThan(
        result.blockRange.startBlock,
      );
      expect(result.blockRange.timestamp).toBeGreaterThan(0);
    }, 60000);

    it("should handle multiple addresses", async () => {
      const config: MonitoringConfig = {
        addresses: [
          testAddress,
          testAddress2, // Second test address
        ],
        thresholds: {
          [testAddress]: {
            minAmountUSD: 1000,
          },
          [testAddress2]: {
            minAmountUSD: 1000,
          },
        },
        intervalMinutes: 1,
        chainId: ChainId.BSC,
      };

      const result = await monitorLargeTransfers(config);

      expect(result.summary.monitoredAddresses).toHaveLength(2);
      expect(result.summary.monitoredAddresses).toContain(testAddress);
      expect(result.summary.monitoredAddresses).toContain(
        "0x73d8bd54f7cf5fab43fe4ef40a62d390644946db",
      );
    }, 60000);
  });

  describe("Multi-Chain Support (V2 API)", () => {
    it("should support Ethereum chain", async () => {
      const ethereumAddress = "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"; // Example Ethereum address

      const transactions = await getTokenTransactions(
        ethereumAddress,
        ChainId.ETHEREUM,
        {
          page: 1,
          offset: 5,
          forceRefresh: true,
        },
      );

      expect(Array.isArray(transactions)).toBe(true);
      // Should handle Ethereum chain requests without errors
    }, 30000);

    it("should support Polygon chain", async () => {
      const polygonAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"; // Example Polygon address

      const transactions = await getTokenTransactions(
        polygonAddress,
        ChainId.POLYGON,
        {
          page: 1,
          offset: 5,
          forceRefresh: true,
        },
      );

      expect(Array.isArray(transactions)).toBe(true);
      // Should handle Polygon chain requests without errors
    }, 30000);

    it("should support Arbitrum chain", async () => {
      const arbitrumAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Example Arbitrum address

      const transactions = await getTokenTransactions(
        arbitrumAddress,
        ChainId.ARBITRUM,
        {
          page: 1,
          offset: 5,
          forceRefresh: true,
        },
      );

      expect(Array.isArray(transactions)).toBe(true);
      // Should handle Arbitrum chain requests without errors
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle invalid addresses gracefully", async () => {
      const invalidAddress = "0xinvalid";

      const transactions = await getTokenTransactions(
        invalidAddress,
        ChainId.BSC,
        {
          forceRefresh: true,
        },
      );

      expect(Array.isArray(transactions)).toBe(true);
      // Should return empty array or handle error gracefully
    }, 30000);

    it("should handle missing API key gracefully", async () => {
      const originalKey = process.env.BSC_ETHERSCAN_API_KEY;
      delete process.env.BSC_ETHERSCAN_API_KEY;

      try {
        const transactions = await getTokenTransactions(
          testAddress,
          ChainId.BSC,
          {
            forceRefresh: true,
          },
        );

        expect(Array.isArray(transactions)).toBe(true);
        // Should handle missing API key gracefully
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.BSC_ETHERSCAN_API_KEY = originalKey;
        }
      }
    }, 30000);
  });
});
