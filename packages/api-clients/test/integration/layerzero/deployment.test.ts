import { describe, it, expect } from "vitest";
import { getChainDeploymentConfig } from "../../../src/blockchain/layerzero";
import { testConfig, delay } from "./setup";

describe("Deployment Configuration", () => {
  it(
    "should get chain deployment config",
    async () => {
      const result = await getChainDeploymentConfig("ethereum");
      // console.log(result);
      if (result) {
        expect(result).toHaveProperty("eid");
        expect(result).toHaveProperty("chainKey");
        expect(typeof result.eid).toBe("string");
        expect(typeof result.chainKey).toBe("string");
      }

      await delay(testConfig.delays.betweenCalls);
    },
    testConfig.timeouts.api,
  );
});
