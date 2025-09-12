import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openPosition,
  closePosition,
  getPositions,
  getWalletBalance,
  BitgetCredentials,
} from "../../../../src/blockchain/bitget/perp/trading";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../../../../.env") });

// Configure Bitget API authentication information
const mockCredentials: BitgetCredentials = {
  apiKey: process.env.BITGET_API_KEY || "",
  apiSecret: process.env.BITGET_API_SECRET || "",
  apiPass: process.env.BITGET_API_PASS || "",
  useTestnet: true, // Recommended to test on testnet first
};

const requiredBitgetEnvVars = [
  "BITGET_API_KEY",
  "BITGET_API_SECRET",
  "BITGET_API_PASS",
] as const;

const validateBitgetEnv = () => {
  const missingVars = requiredBitgetEnvVars.filter(
    (name) => !process.env[name],
  );
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Bitget environment variables: ${missingVars.join(", ")}\n` +
        "Please create a .env file in the packages/api-clients directory with these variables.",
    );
  }
};

describe("Bitget Perp Trading Integration", () => {
  beforeAll(() => {
    validateBitgetEnv();
  });
  describe("openPosition", () => {
    it("should validate required parameters", async () => {
      const result = await openPosition({
        symbol: "",
        amount: "",
        side: "buy",
        credentials: mockCredentials,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });

    it("should validate credentials", async () => {
      const result = await openPosition({
        symbol: "BTCUSDT",
        amount: "0.001",
        side: "buy",
        credentials: {
          apiKey: "",
          apiSecret: "",
          apiPass: "",
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });

    it("should create long position", async () => {
      const result = await openPosition({
        symbol: "ETHUSDT",
        amount: "0.01",
        side: "buy",
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
    });

    it("should create short position", async () => {
      const result = await openPosition({
        symbol: "ETHUSDT",
        amount: "0.01",
        side: "sell",
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("closePosition", () => {
    it("should validate required parameters", async () => {
      const result = await closePosition({
        symbol: "",
        credentials: mockCredentials,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });

    it("should validate symbol", async () => {
      const result = await closePosition({
        symbol: "",
        credentials: mockCredentials,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });

    it("should close all position", async () => {
      const result = await closePosition({
        symbol: "ETHUSDT",
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it("should validate credentials", async () => {
      const result = await closePosition({
        symbol: "BTCUSDT",
        credentials: {
          apiKey: "",
          apiSecret: "",
          apiPass: "",
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });
  });

  describe("getPositions", () => {
    it("should validate credentials", async () => {
      const result = await getPositions({
        credentials: {
          apiKey: "",
          apiSecret: "",
          apiPass: "",
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });

    it("should return placeholder response for now", async () => {
      const result = await getPositions({
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
      expect(result.positions).toEqual([]);
      expect(result.details).toContain("needs to be implemented");
    });
  });

  describe("getWalletBalance", () => {
    it("should validate credentials", async () => {
      const result = await getWalletBalance({
        apiKey: "",
        apiSecret: "",
        apiPass: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required parameters");
    });
  });

  afterAll(async () => {
    const result = await closePosition({
      symbol: "ETHUSDT",
      credentials: mockCredentials,
    });

    expect(result.success).toBe(true);
  });
});
