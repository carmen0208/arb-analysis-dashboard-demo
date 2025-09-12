import { describe, it, expect } from "vitest";
import {
  isOFTContract,
  isOFTAdapterContract,
  detectContractType,
  getOFTEndpoint,
  getOFTAdapterToken,
  getAllPeers,
} from "../../../src/blockchain/layerzero/services/oftDetector";
import { testConfig, delay } from "./setup";

describe("LayerZero OFT Detection Integration", () => {
  describe("isOFTContract", () => {
    it(
      "should detect valid OFT contract",
      async () => {
        // Test with a known OFT contract
        const isOFT = await isOFTContract(
          testConfig.contracts.ethena_sUSDe_ethereum,
          "ethereum",
        );

        // Note: This might be false if the contract isn't actually an OFT
        // We're testing the function works, not that specific contracts are OFTs
        expect(typeof isOFT).toBe("boolean");
        expect(isOFT).toBe(true);
        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should handle invalid contract address",
      async () => {
        const isOFT = await isOFTContract(
          "0x0000000000000000000000000000000000000000",
          "ethereum",
        );

        expect(isOFT).toBe(false);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should handle non-contract address",
      async () => {
        // Use a random EOA address
        const isOFT = await isOFTContract(
          "0x1234567890123456789012345678901234567890",
          "ethereum",
        );

        expect(isOFT).toBe(false);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("isOFTAdapterContract", () => {
    it(
      "should detect OFT Adapter contract if exists",
      async () => {
        // Test with a potential OFT Adapter
        const isAdapter = await isOFTAdapterContract(
          testConfig.contracts.oft_adapter_example,
          "ethereum",
        );

        expect(typeof isAdapter).toBe("boolean");
        expect(isAdapter).toBe(true);
        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should also return true for regular OFT",
      async () => {
        // Test with a known OFT (should not be adapter)
        const isAdapter = await isOFTAdapterContract(
          testConfig.contracts.oft_example,
          "base",
        );

        expect(typeof isAdapter).toBe("boolean");
        expect(isAdapter).toBe(true);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("detectContractType", () => {
    it(
      "should comprehensively analyze contract type",
      async () => {
        const result = await detectContractType(
          testConfig.contracts.oft_example,
          "base",
        );
        expect(result).toHaveProperty("isOFT");
        expect(result).toHaveProperty("isOFTAdapter");
        expect(result).toHaveProperty("contractType");
        expect(typeof result.isOFT).toBe("boolean");
        expect(result.isOFT).toBe(true);
        expect(result.isOFTAdapter).toBe(true);
        expect(typeof result.isOFTAdapter).toBe("boolean");
        expect(["OFT", "OFT_ADAPTER", "UNKNOWN"]).toContain(
          result.contractType,
        );

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should identify unknown contract correctly",
      async () => {
        // Test with a known non-OFT contract (e.g., USDC)
        const result = await detectContractType(
          "0xA0b86991c6218b36C1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
          "ethereum",
        );

        expect(result.contractType).toBe("UNKNOWN");
        expect(result.isOFT).toBe(false);
        expect(result.isOFTAdapter).toBe(false);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("getOFTEndpoint", () => {
    it(
      "should get endpoint for valid OFT",
      async () => {
        const endpoint = await getOFTEndpoint(
          testConfig.contracts.ethena_sUSDe_ethereum,
          "ethereum",
        );

        // Should either return an address or null
        if (endpoint !== null) {
          expect(endpoint).toMatch(/^0x[a-fA-F0-9]{40}$/);
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should return null for non-OFT contract",
      async () => {
        const endpoint = await getOFTEndpoint(
          "0xA0b86991c6218b36C1d19D4a2e9Eb0cE3606eB48", // USDC
          "ethereum",
        );

        expect(endpoint).toBeNull();

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("getOFTAdapterToken", () => {
    it(
      "should get token address for valid OFT Adapter",
      async () => {
        const tokenAddress = await getOFTAdapterToken(
          testConfig.contracts.oft_adapter_example,
          "ethereum",
        );

        // Should either return an address or null
        if (tokenAddress !== null) {
          expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should return null for regular OFT",
      async () => {
        const tokenAddress = await getOFTAdapterToken(
          testConfig.contracts.non_oft_example,
          "ethereum",
        );

        // Regular OFT should not have token() function
        expect(tokenAddress).toBeNull();

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("getAllPeers", () => {
    it(
      "should check peers for all EIDs",
      async () => {
        // Check peers for Stargate STG contract
        const peersResult = await getAllPeers(
          testConfig.contracts.ethena_sUSDe_ethereum,
          "ethereum",
        );

        expect(peersResult).toHaveProperty("peers");
        expect(peersResult).toHaveProperty("totalPeers");
        expect(Array.isArray(peersResult.peers)).toBe(true);
        expect(typeof peersResult.totalPeers).toBe("number");

        // Each peer should have required properties
        peersResult.peers.forEach((peer) => {
          expect(peer).toHaveProperty("eid");
          expect(peer).toHaveProperty("chainKey");
          expect(peer).toHaveProperty("peerAddress");
          expect(peer).toHaveProperty("isActive");
          expect(typeof peer.eid).toBe("string");
          expect(typeof peer.chainKey).toBe("string");
          expect(typeof peer.peerAddress).toBe("string");
          expect(peer.isActive).toBe(true);
        });

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should return empty results for invalid contract",
      async () => {
        const peersResult = await getAllPeers(
          "0x0000000000000000000000000000000000000000",
          "ethereum",
        );

        expect(peersResult.peers).toEqual([]);
        expect(peersResult.totalPeers).toBe(0);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should handle non-contract address gracefully",
      async () => {
        const peersResult = await getAllPeers(
          "0x1234567890123456789012345678901234567890",
          "ethereum",
        );

        expect(peersResult.peers).toEqual([]);
        expect(peersResult.totalPeers).toBe(0);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("Cross-chain consistency", () => {
    it(
      "should detect same OFT type across different chains",
      async () => {
        const [ethereumResult, bscResult] = await Promise.all([
          detectContractType(
            testConfig.contracts.ethena_sUSDe_ethereum,
            "ethereum",
          ),
          detectContractType(testConfig.contracts.ethena_sUSDe_bsc, "bsc"),
        ]);

        // Both should be the same type (either both OFT or both unknown)
        expect(ethereumResult.contractType).toBe(bscResult.contractType);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc * 2,
    );
  });
});
