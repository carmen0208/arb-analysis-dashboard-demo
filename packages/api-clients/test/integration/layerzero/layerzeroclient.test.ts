import { describe, it, expect } from "vitest";
import {
  LayerZeroClient,
  validateOFTConfiguration,
} from "../../../src/blockchain/layerzero";
import { testConfig, delay } from "./setup";

describe("LayerZeroClient", () => {
  it(
    "should perform comprehensive OFT analysis",
    async () => {
      const result = await LayerZeroClient.analyzeOFT(
        testConfig.contracts.ethena_sUSDe_ethereum,
        "ethereum",
        {
          includeConfigs: false, // Keep simple for testing
        },
      );
      expect(result).toHaveProperty("isOFT");
      expect(result).toHaveProperty("isOFTAdapter");
      expect(result).toHaveProperty("contractType");
      expect(result).toHaveProperty("peers");
      expect(result).toHaveProperty("supportedChains");
      expect(result).toHaveProperty("bridgeConfigs");

      expect(Array.isArray(result.peers)).toBe(true);
      expect(Array.isArray(result.supportedChains)).toBe(true);
      expect(Array.isArray(result.bridgeConfigs)).toBe(true);

      await delay(testConfig.delays.betweenCalls);
    },
    testConfig.timeouts.rpc * 2,
  );

  it(
    "should check bridge availability",
    async () => {
      const result = await LayerZeroClient.getBridgeInfo(
        testConfig.contracts.ethena_sUSDe_ethereum,
        "ethereum",
        "bsc",
      );

      expect(result).toHaveProperty("isAvailable");
      expect(result).toHaveProperty("directPath");
      expect(typeof result.isAvailable).toBe("boolean");
      expect(typeof result.directPath).toBe("boolean");

      await delay(testConfig.delays.betweenCalls);
    },
    testConfig.timeouts.rpc,
  );

  describe("validateOFTConfiguration", () => {
    it(
      "should validate OFT configuration for CookieDAO contract on BSC",
      async () => {
        const cookieDAOAddress = "0xc0041ef357b183448b235a8ea73ce4e4ec8c265f";
        const sourceChain = "bsc";

        console.log("🔧 Testing validateOFTConfiguration function:");
        console.log("Contract address:", cookieDAOAddress);
        console.log("Source chain:", sourceChain);

        const result = await validateOFTConfiguration(
          cookieDAOAddress,
          sourceChain,
        );

        console.log("✅ OFT configuration validation completed!");
        console.log("  Is valid:", result.isValid);
        console.log("  Issue count:", result.issues.length);
        console.log("  Total chains:", result.summary.totalChains);
        console.log("  Valid chains:", result.summary.validChains);
        console.log("  Configuration count:", result.summary.configurations);

        // Basic property validation
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("issues");
        expect(result).toHaveProperty("summary");

        // Type validation
        expect(typeof result.isValid).toBe("boolean");
        expect(Array.isArray(result.issues)).toBe(true);
        expect(typeof result.summary).toBe("object");

        // Summary property validation
        expect(result.summary).toHaveProperty("totalChains");
        expect(result.summary).toHaveProperty("validChains");
        expect(result.summary).toHaveProperty("configurations");

        // Business logic validation
        expect(result.summary.totalChains).toBeGreaterThan(0);
        expect(result.summary.validChains).toBeGreaterThan(0);
        expect(result.summary.configurations).toBeGreaterThan(0);

        // If there are issues, verify issue structure
        if (result.issues.length > 0) {
          console.log("\n⚠️ Issues found:");
          result.issues.forEach((issue, index) => {
            console.log(
              `  ${index + 1}. Chain: ${issue.chain}, Issue: ${issue.issue}, Severity: ${issue.severity}`,
            );

            // Verify issue structure
            expect(issue).toHaveProperty("chain");
            expect(issue).toHaveProperty("issue");
            expect(issue).toHaveProperty("severity");
            expect(typeof issue.chain).toBe("string");
            expect(typeof issue.issue).toBe("string");
            expect(["error", "warning"]).toContain(issue.severity);
          });
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc * 3, // Give more time as configuration needs to be fetched
    );

    it(
      "should validate OFT configuration for Ethena sUSDe contract on Ethereum",
      async () => {
        const contractAddress = testConfig.contracts.ethena_sUSDe_ethereum;
        const sourceChain = "ethereum";

        console.log(
          "\n🔧 Testing Ethena sUSDe contract configuration validation:",
        );
        console.log("Contract address:", contractAddress);
        console.log("Source chain:", sourceChain);

        const result = await validateOFTConfiguration(
          contractAddress,
          sourceChain,
        );

        console.log("✅ Ethena sUSDe configuration validation completed!");
        console.log("  Is valid:", result.isValid);
        console.log("  Issue count:", result.issues.length);
        console.log("  Total chains:", result.summary.totalChains);
        console.log("  Valid chains:", result.summary.validChains);
        console.log("  Configuration count:", result.summary.configurations);

        // Basic validation
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("issues");
        expect(result).toHaveProperty("summary");

        // Business logic validation
        expect(result.summary.totalChains).toBeGreaterThan(0);
        expect(result.summary.validChains).toBeGreaterThan(0);

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc * 3,
    );
  });

  describe("LayerZeroClient.analyzeOFT with configs", () => {
    it(
      "should analyze OFT and include bridge configurations",
      async () => {
        const cookieDAOAddress = "0xc0041ef357b183448b235a8ea73ce4e4ec8c265f";
        const sourceChain = "bsc";

        console.log(
          "\n🔧 Testing analyzeOFT function (including configuration):",
        );
        console.log("Contract address:", cookieDAOAddress);
        console.log("Source chain:", sourceChain);

        const result = await LayerZeroClient.analyzeOFT(
          cookieDAOAddress,
          sourceChain,
          { includeConfigs: true },
        );

        console.log("✅ OFT analysis completed!");
        console.log("  Contract type:", result.contractType);
        console.log("  Peers count:", result.peers.length);
        console.log("  Supported chains count:", result.supportedChains.length);
        console.log(
          "  Bridge configurations count:",
          result.bridgeConfigs.length,
        );

        // Basic property validation
        expect(result).toHaveProperty("contractType");
        expect(result).toHaveProperty("peers");
        expect(result).toHaveProperty("supportedChains");
        expect(result).toHaveProperty("bridgeConfigs");

        // Type validation
        expect(typeof result.contractType).toBe("string");
        expect(Array.isArray(result.peers)).toBe(true);
        expect(Array.isArray(result.supportedChains)).toBe(true);
        expect(Array.isArray(result.bridgeConfigs)).toBe(true);

        // Business logic validation
        expect(result.peers.length).toBeGreaterThan(0);
        expect(result.supportedChains.length).toBeGreaterThan(0);
        expect(result.bridgeConfigs.length).toBeGreaterThan(0);

        // Verify bridge configuration structure
        if (result.bridgeConfigs.length > 0) {
          console.log("\n📤 First bridge configuration:");
          const firstConfig = result.bridgeConfigs[0];

          expect(firstConfig).toHaveProperty("fromChain");
          expect(firstConfig).toHaveProperty("toChain");
          expect(firstConfig).toHaveProperty("isAvailable");

          console.log("  From chain:", firstConfig.fromChain);
          console.log("  To chain:", firstConfig.toChain);
          console.log("  Is available:", firstConfig.isAvailable);

          // Verify executor configuration
          if (firstConfig.executorConfig) {
            expect(firstConfig.executorConfig).toHaveProperty(
              "executorAddress",
            );
            expect(firstConfig.executorConfig).toHaveProperty("maxMessageSize");
            expect(firstConfig.executorConfig).toHaveProperty("executorFeeCap");

            console.log(
              "  Executor address:",
              firstConfig.executorConfig.executorAddress,
            );
          }

          // Verify DVN configuration
          if (firstConfig.dvnConfig) {
            expect(firstConfig.dvnConfig).toHaveProperty("address");
            expect(firstConfig.dvnConfig).toHaveProperty("canonicalName");
            expect(firstConfig.dvnConfig).toHaveProperty("threshold");
            expect(firstConfig.dvnConfig).toHaveProperty("requiredDVNs");

            console.log("  DVN address:", firstConfig.dvnConfig.address);
            console.log("  DVN name:", firstConfig.dvnConfig.canonicalName);
            console.log("  DVN threshold:", firstConfig.dvnConfig.threshold);
            console.log(
              "  Required DVN count:",
              firstConfig.dvnConfig.requiredDVNs?.length || 0,
            );
          }
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc * 3,
    );
  });

  describe("Error handling and edge cases", () => {
    it(
      "should handle invalid contract address gracefully",
      async () => {
        const invalidAddress = "0x0000000000000000000000000000000000000000";
        const sourceChain = "ethereum";

        console.log("\n🔧 Testing invalid contract address handling:");
        console.log("Contract address:", invalidAddress);
        console.log("Source chain:", sourceChain);

        try {
          const result = await validateOFTConfiguration(
            invalidAddress,
            sourceChain,
          );

          // If result is returned, verify error handling
          if (result) {
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // If error is thrown, verify error message
          expect(error).toBeInstanceOf(Error);
          console.log(
            "❌ Expected error:",
            error instanceof Error ? error.message : String(error),
          );
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );

    it(
      "should handle unsupported chain gracefully",
      async () => {
        const contractAddress = testConfig.contracts.ethena_sUSDe_ethereum;
        const unsupportedChain = "unsupported_chain" as any;

        console.log("\n🔧 Testing unsupported chain handling:");
        console.log("Contract address:", contractAddress);
        console.log("Source chain:", unsupportedChain);

        try {
          const result = await validateOFTConfiguration(
            contractAddress,
            unsupportedChain,
          );

          // If result is returned, verify error handling
          if (result) {
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // If error is thrown, verify error message
          expect(error).toBeInstanceOf(Error);
          console.log(
            "❌ Expected error:",
            error instanceof Error ? error.message : String(error),
          );
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });
});
