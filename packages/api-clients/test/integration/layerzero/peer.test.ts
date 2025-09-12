import { describe, it, expect } from "vitest";
import { analyzePeerRelationships } from "../../../src/blockchain/layerzero";
import { testConfig, delay } from "./setup";
describe("Peer Analysis", () => {
  it(
    "should analyze peer relationships",
    async () => {
      const result = await analyzePeerRelationships(
        testConfig.contracts.ethena_sUSDe_ethereum,
        "ethereum",
      );
      expect(result).toHaveProperty("peers");
      expect(result).toHaveProperty("bridgeConfigs");
      expect(result).toHaveProperty("totalPeers");
      expect(result).toHaveProperty("supportedChains");

      expect(Array.isArray(result.peers)).toBe(true);
      expect(Array.isArray(result.bridgeConfigs)).toBe(true);
      expect(typeof result.totalPeers).toBe("number");

      await delay(testConfig.delays.betweenCalls);
    },
    testConfig.timeouts.rpc,
  );
});
