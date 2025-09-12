import { describe, it, expect } from "vitest";
import {
  LAYERZERO_MAINNET_CHAINS,
  getChainConfig,
  getChainConfigByEID,
  isSupportedChain,
  createPublicClientForChain,
} from "../../../src/blockchain/layerzero";
import { testConfig, delay } from "./setup";

describe("LayerZero Basic Integration", () => {
  describe("Configuration", () => {
    it("should have all expected chains", () => {
      expect(LAYERZERO_MAINNET_CHAINS).toContain("ethereum");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("bsc");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("polygon");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("arbitrum");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("optimism");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("base");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("avalanche");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("sonic");
      expect(LAYERZERO_MAINNET_CHAINS).toContain("hyperliquid");

      // Should have at least 10 chains
      expect(LAYERZERO_MAINNET_CHAINS.length).toBeGreaterThanOrEqual(10);
    });

    it("should get chain config correctly", () => {
      const ethConfig = getChainConfig("ethereum");
      expect(ethConfig.eid).toBe("30101");
      expect(ethConfig.name).toBe("Ethereum");
      expect(ethConfig.nativeChainId).toBe(1);
      expect(ethConfig.rpc).toContain("https://");

      const bscConfig = getChainConfig("bsc");
      expect(bscConfig.eid).toBe("30102");
      expect(bscConfig.name).toBe("BSC");
      expect(bscConfig.nativeChainId).toBe(56);
    });

    it("should get chain config by EID", () => {
      const ethConfig = getChainConfigByEID("30101");
      expect(ethConfig?.name).toBe("Ethereum");

      const bscConfig = getChainConfigByEID("30102");
      expect(bscConfig?.name).toBe("BSC");

      const invalidConfig = getChainConfigByEID("99999");
      expect(invalidConfig).toBeUndefined();
    });

    it("should validate supported chains", () => {
      expect(isSupportedChain("ethereum")).toBe(true);
      expect(isSupportedChain("bsc")).toBe(true);
      expect(isSupportedChain("invalid_chain")).toBe(false);
    });
  });

  describe("Client Creation", () => {
    it(
      "should create ethereum client",
      async () => {
        const client = createPublicClientForChain("ethereum");
        expect(client).toBeDefined();

        // Test basic functionality
        const chainId = await client.getChainId();
        expect(chainId).toBe(1);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should create bsc client",
      async () => {
        const client = createPublicClientForChain("bsc");
        expect(client).toBeDefined();

        const chainId = await client.getChainId();
        expect(chainId).toBe(56);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should create sonic client (custom chain)",
      async () => {
        const client = createPublicClientForChain("sonic");
        expect(client).toBeDefined();

        const chainId = await client.getChainId();
        expect(chainId).toBe(146);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("Functional Implementation Style", () => {
    it(
      "should demonstrate functional approach",
      async () => {
        // All our functions are functional, not class-based
        const chains = ["ethereum", "bsc"] as const;

        // Functional chain configuration
        const configs = chains.map((chain) => ({
          chain,
          config: getChainConfig(chain),
        }));

        expect(configs).toHaveLength(2);
        configs.forEach(({ chain, config }) => {
          expect(config.name).toBeTruthy();
          expect(config.eid).toBeTruthy();
          expect(isSupportedChain(chain)).toBe(true);
        });

        // Functional client creation
        const clients = chains.map((chain) => ({
          chain,
          client: createPublicClientForChain(chain),
        }));

        // Test all clients
        for (const { chain, client } of clients) {
          const chainId = await client.getChainId();
          const expectedChainId = getChainConfig(chain).nativeChainId;
          expect(chainId).toBe(expectedChainId);

          await delay(testConfig.delays.betweenCalls);
        }
      },
      testConfig.timeouts.rpc * 3,
    );
  });
});
