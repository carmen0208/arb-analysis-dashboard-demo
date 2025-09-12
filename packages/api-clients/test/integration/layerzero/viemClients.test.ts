import { describe, it, expect } from "vitest";
import {
  createPublicClientForChain,
  createPublicClientsForChains,
  isViemSupportedChain,
  getChainInfo,
  validateRpcConnection,
} from "../../../src/blockchain/layerzero/utils/viemClients";
import { LAYERZERO_MAINNET_CHAINS } from "../../../src/blockchain/layerzero";
import { testConfig, delay } from "./setup";

describe("LayerZero Viem Clients Integration", () => {
  describe("createPublicClientForChain", () => {
    it(
      "should create client for Ethereum",
      async () => {
        const client = createPublicClientForChain("ethereum");
        expect(client).toBeDefined();

        // Test basic functionality
        const blockNumber = await client.getBlockNumber();
        expect(blockNumber).toBeGreaterThan(0n);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should create client for BSC",
      async () => {
        const client = createPublicClientForChain("bsc");
        expect(client).toBeDefined();

        const blockNumber = await client.getBlockNumber();
        expect(blockNumber).toBeGreaterThan(0n);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should create client for non-viem supported chain (Sonic)",
      async () => {
        const client = createPublicClientForChain("sonic");
        expect(client).toBeDefined();

        // Test if we can get basic chain info
        const chainId = await client.getChainId();
        expect(chainId).toBe(146); // Sonic chain ID

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("isViemSupportedChain", () => {
    it("should identify viem supported chains", () => {
      expect(isViemSupportedChain("ethereum")).toBe(true);
      expect(isViemSupportedChain("bsc")).toBe(true);
      expect(isViemSupportedChain("polygon")).toBe(true);
      expect(isViemSupportedChain("arbitrum")).toBe(true);
      expect(isViemSupportedChain("optimism")).toBe(true);
      expect(isViemSupportedChain("base")).toBe(true);
      expect(isViemSupportedChain("avalanche")).toBe(true);
    });

    it("should identify non-viem supported chains", () => {
      expect(isViemSupportedChain("sonic")).toBe(false);
      expect(isViemSupportedChain("hyperliquid")).toBe(false);
      expect(isViemSupportedChain("sei")).toBe(false);
      expect(isViemSupportedChain("solana")).toBe(false);
    });
  });

  describe("getChainInfo", () => {
    it("should return complete info for viem supported chain", () => {
      const info = getChainInfo("ethereum");

      expect(info.config).toBeDefined();
      expect(info.config.eid).toBe("30101");
      expect(info.config.nativeChainId).toBe(1);
      expect(info.isViemSupported).toBe(true);
      expect(info.viemChain).toBeDefined();
      expect(info.customChain).toBeUndefined();
    });

    it("should return complete info for non-viem supported chain", () => {
      const info = getChainInfo("sonic");

      expect(info.config).toBeDefined();
      expect(info.config.eid).toBe("30332");
      expect(info.config.nativeChainId).toBe(146);
      expect(info.isViemSupported).toBe(false);
      expect(info.viemChain).toBeUndefined();
      expect(info.customChain).toBeDefined();
      expect(info.customChain?.id).toBe(146);
    });
  });

  describe("validateRpcConnection", () => {
    it(
      "should validate Ethereum RPC connection",
      async () => {
        const isValid = await validateRpcConnection("ethereum");
        expect(isValid).toBe(true);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should validate BSC RPC connection",
      async () => {
        const isValid = await validateRpcConnection("bsc");
        expect(isValid).toBe(true);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should handle invalid RPC gracefully",
      async () => {
        const isValid = await validateRpcConnection(
          "ethereum",
          "https://invalid-rpc-url.com",
        );
        expect(isValid).toBe(false);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });

  describe("createPublicClientsForChains", () => {
    it("should create clients for multiple chains", () => {
      const testChains = ["ethereum", "bsc", "polygon"] as const;
      const clients = createPublicClientsForChains(testChains);

      expect(Object.keys(clients)).toHaveLength(3);
      expect(clients.ethereum).toBeDefined();
      expect(clients.bsc).toBeDefined();
      expect(clients.polygon).toBeDefined();
    });

    it("should handle mix of supported and unsupported chains", () => {
      const testChains = ["ethereum", "sonic", "hyperliquid"] as const;
      const clients = createPublicClientsForChains(testChains);

      expect(Object.keys(clients)).toHaveLength(3);
      expect(clients.ethereum).toBeDefined();
      expect(clients.sonic).toBeDefined();
      expect(clients.hyperliquid).toBeDefined();
    });
  });
});
