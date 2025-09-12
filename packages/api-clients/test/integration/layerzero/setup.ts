import { beforeAll } from "vitest";

// Test configuration
export const testConfig = {
  // Known OFT contracts for testing
  contracts: {
    // USDC OFT on different chains
    ethereum_usdc_oft: "0x0000000000000000000000000000000000000000", // Placeholder
    bsc_usdc_oft: "0x0000000000000000000000000000000000000000", // Placeholder

    ethena_sUSDe_ethereum: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2",
    ethena_sUSDe_bsc: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2",
    ethena_sUSDe_optimism: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2",

    // Example OFT Adapter (wraps existing tokens)
    oft_example: "0x31ea904a7eca45122890deb8da3473a2081bc9d1",
    oft_adapter_example: "0x88b06c36fcba5a8cf53fa80cee7dc44e86f2d55a",

    non_oft_example: "0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6",
  },

  // Test timeouts
  timeouts: {
    rpc: 15000,
    api: 10000,
  },

  // Rate limiting
  delays: {
    betweenCalls: 1000, // 1 second between calls
  },
};

// Validation setup
export function validateTestEnvironment() {
  const issues: string[] = [];

  // Add any environment validations here

  if (issues.length > 0) {
    throw new Error(
      `Test environment validation failed:\n${issues.join("\n")}`,
    );
  }
}

// Setup function
beforeAll(() => {
  validateTestEnvironment();
});

// Helper to add delay between tests
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
