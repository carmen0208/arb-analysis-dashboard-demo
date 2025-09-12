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

        console.log("🔧 测试 validateOFTConfiguration 函数:");
        console.log("合约地址:", cookieDAOAddress);
        console.log("源链:", sourceChain);

        const result = await validateOFTConfiguration(
          cookieDAOAddress,
          sourceChain,
        );

        console.log("✅ OFT配置验证完成!");
        console.log("  是否有效:", result.isValid);
        console.log("  问题数量:", result.issues.length);
        console.log("  总链数:", result.summary.totalChains);
        console.log("  有效链数:", result.summary.validChains);
        console.log("  配置数量:", result.summary.configurations);

        // 基本属性验证
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("issues");
        expect(result).toHaveProperty("summary");

        // 类型验证
        expect(typeof result.isValid).toBe("boolean");
        expect(Array.isArray(result.issues)).toBe(true);
        expect(typeof result.summary).toBe("object");

        // 摘要属性验证
        expect(result.summary).toHaveProperty("totalChains");
        expect(result.summary).toHaveProperty("validChains");
        expect(result.summary).toHaveProperty("configurations");

        // 业务逻辑验证
        expect(result.summary.totalChains).toBeGreaterThan(0);
        expect(result.summary.validChains).toBeGreaterThan(0);
        expect(result.summary.configurations).toBeGreaterThan(0);

        // 如果有问题，验证问题结构
        if (result.issues.length > 0) {
          console.log("\n⚠️ 发现的问题:");
          result.issues.forEach((issue, index) => {
            console.log(
              `  ${index + 1}. 链: ${issue.chain}, 问题: ${issue.issue}, 严重性: ${issue.severity}`,
            );

            // 验证问题结构
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
      testConfig.timeouts.rpc * 3, // 给更多时间，因为需要获取配置
    );

    it(
      "should validate OFT configuration for Ethena sUSDe contract on Ethereum",
      async () => {
        const contractAddress = testConfig.contracts.ethena_sUSDe_ethereum;
        const sourceChain = "ethereum";

        console.log("\n🔧 测试 Ethena sUSDe 合约配置验证:");
        console.log("合约地址:", contractAddress);
        console.log("源链:", sourceChain);

        const result = await validateOFTConfiguration(
          contractAddress,
          sourceChain,
        );

        console.log("✅ Ethena sUSDe 配置验证完成!");
        console.log("  是否有效:", result.isValid);
        console.log("  问题数量:", result.issues.length);
        console.log("  总链数:", result.summary.totalChains);
        console.log("  有效链数:", result.summary.validChains);
        console.log("  配置数量:", result.summary.configurations);

        // 基本验证
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("issues");
        expect(result).toHaveProperty("summary");

        // 业务逻辑验证
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

        console.log("\n🔧 测试 analyzeOFT 函数 (包含配置):");
        console.log("合约地址:", cookieDAOAddress);
        console.log("源链:", sourceChain);

        const result = await LayerZeroClient.analyzeOFT(
          cookieDAOAddress,
          sourceChain,
          { includeConfigs: true },
        );

        console.log("✅ OFT分析完成!");
        console.log("  合约类型:", result.contractType);
        console.log("  Peers数量:", result.peers.length);
        console.log("  支持的链数量:", result.supportedChains.length);
        console.log("  桥接配置数量:", result.bridgeConfigs.length);

        // 基本属性验证
        expect(result).toHaveProperty("contractType");
        expect(result).toHaveProperty("peers");
        expect(result).toHaveProperty("supportedChains");
        expect(result).toHaveProperty("bridgeConfigs");

        // 类型验证
        expect(typeof result.contractType).toBe("string");
        expect(Array.isArray(result.peers)).toBe(true);
        expect(Array.isArray(result.supportedChains)).toBe(true);
        expect(Array.isArray(result.bridgeConfigs)).toBe(true);

        // 业务逻辑验证
        expect(result.peers.length).toBeGreaterThan(0);
        expect(result.supportedChains.length).toBeGreaterThan(0);
        expect(result.bridgeConfigs.length).toBeGreaterThan(0);

        // 验证桥接配置结构
        if (result.bridgeConfigs.length > 0) {
          console.log("\n📤 第一个桥接配置:");
          const firstConfig = result.bridgeConfigs[0];

          expect(firstConfig).toHaveProperty("fromChain");
          expect(firstConfig).toHaveProperty("toChain");
          expect(firstConfig).toHaveProperty("isAvailable");

          console.log("  从链:", firstConfig.fromChain);
          console.log("  到链:", firstConfig.toChain);
          console.log("  是否可用:", firstConfig.isAvailable);

          // 验证执行器配置
          if (firstConfig.executorConfig) {
            expect(firstConfig.executorConfig).toHaveProperty(
              "executorAddress",
            );
            expect(firstConfig.executorConfig).toHaveProperty("maxMessageSize");
            expect(firstConfig.executorConfig).toHaveProperty("executorFeeCap");

            console.log(
              "  执行器地址:",
              firstConfig.executorConfig.executorAddress,
            );
          }

          // 验证DVN配置
          if (firstConfig.dvnConfig) {
            expect(firstConfig.dvnConfig).toHaveProperty("address");
            expect(firstConfig.dvnConfig).toHaveProperty("canonicalName");
            expect(firstConfig.dvnConfig).toHaveProperty("threshold");
            expect(firstConfig.dvnConfig).toHaveProperty("requiredDVNs");

            console.log("  DVN地址:", firstConfig.dvnConfig.address);
            console.log("  DVN名称:", firstConfig.dvnConfig.canonicalName);
            console.log("  DVN阈值:", firstConfig.dvnConfig.threshold);
            console.log(
              "  必需DVN数量:",
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

        console.log("\n🔧 测试无效合约地址处理:");
        console.log("合约地址:", invalidAddress);
        console.log("源链:", sourceChain);

        try {
          const result = await validateOFTConfiguration(
            invalidAddress,
            sourceChain,
          );

          // 如果返回结果，验证错误处理
          if (result) {
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // 如果抛出错误，验证错误信息
          expect(error).toBeInstanceOf(Error);
          console.log(
            "❌ 预期错误:",
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

        console.log("\n🔧 测试不支持的链处理:");
        console.log("合约地址:", contractAddress);
        console.log("源链:", unsupportedChain);

        try {
          const result = await validateOFTConfiguration(
            contractAddress,
            unsupportedChain,
          );

          // 如果返回结果，验证错误处理
          if (result) {
            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
          }
        } catch (error) {
          // 如果抛出错误，验证错误信息
          expect(error).toBeInstanceOf(Error);
          console.log(
            "❌ 预期错误:",
            error instanceof Error ? error.message : String(error),
          );
        }

        await delay(testConfig.delays.betweenCalls);
      },
      testConfig.timeouts.rpc,
    );
  });
});
