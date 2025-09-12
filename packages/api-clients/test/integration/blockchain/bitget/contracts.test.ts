import { describe, it, expect, beforeAll } from "vitest";
import {
  fetchAllContracts,
  getContractBySymbol,
  getContractsByBaseCoin,
  getActiveContracts,
  type BitgetContract,
} from "../../../../src/blockchain/bitget/perp/contracts";

describe("Bitget Contracts API Integration", () => {
  let allContracts: BitgetContract[];

  beforeAll(async () => {
    // Fetch all contracts once for all tests
    allContracts = await fetchAllContracts();
  });

  describe("fetchAllContracts", () => {
    it("should fetch all USDT-FUTURES contracts", async () => {
      expect(allContracts).toBeDefined();
      expect(Array.isArray(allContracts)).toBe(true);
      expect(allContracts.length).toBeGreaterThan(0);
    });

    it("should have valid contract structure", () => {
      const contract = allContracts[0];
      expect(contract).toHaveProperty("symbol");
      expect(contract).toHaveProperty("baseCoin");
      expect(contract).toHaveProperty("quoteCoin");
      expect(contract).toHaveProperty("maxLever");
      expect(contract).toHaveProperty("minTradeUSDT");
      expect(contract).toHaveProperty("symbolStatus");
    });
  });

  describe("getContractBySymbol", () => {
    it("should find BTCUSDT contract", async () => {
      const btcContract = await getContractBySymbol("BTCUSDT", allContracts);
      expect(btcContract).toBeDefined();
      expect(btcContract?.symbol).toBe("BTCUSDT");
      expect(btcContract?.baseCoin).toBe("BTC");
      expect(btcContract?.quoteCoin).toBe("USDT");
    });

    it("should return undefined for non-existent symbol", async () => {
      const nonExistentContract = await getContractBySymbol(
        "NONEXISTENT",
        allContracts,
      );
      expect(nonExistentContract).toBeUndefined();
    });
  });

  describe("getContractsByBaseCoin", () => {
    it("should find ETH contracts", async () => {
      const ethContracts = await getContractsByBaseCoin("ETH", allContracts);
      expect(ethContracts).toBeDefined();
      expect(Array.isArray(ethContracts)).toBe(true);
      expect(ethContracts.length).toBeGreaterThan(0);
      expect(ethContracts.every((c) => c.baseCoin === "ETH")).toBe(true);
    });

    it("should return empty array for non-existent base coin", async () => {
      const nonExistentContracts = await getContractsByBaseCoin(
        "NONEXISTENT",
        allContracts,
      );
      expect(nonExistentContracts).toBeDefined();
      expect(Array.isArray(nonExistentContracts)).toBe(true);
      expect(nonExistentContracts.length).toBe(0);
    });
  });

  describe("getActiveContracts", () => {
    it("should return only active contracts", async () => {
      const activeContracts = await getActiveContracts(allContracts);
      expect(activeContracts).toBeDefined();
      expect(Array.isArray(activeContracts)).toBe(true);
      expect(activeContracts.length).toBeGreaterThan(0);
      expect(activeContracts.every((c) => c.symbolStatus === "normal")).toBe(
        true,
      );
    });

    it("should have fewer or equal contracts than total", () => {
      const activeContracts = allContracts.filter(
        (c) => c.symbolStatus === "normal",
      );
      expect(activeContracts.length).toBeLessThanOrEqual(allContracts.length);
    });
  });

  describe("Contract data validation", () => {
    it("should have valid leverage values", () => {
      allContracts.forEach((contract) => {
        const minLever = parseInt(contract.minLever);
        const maxLever = parseInt(contract.maxLever);

        expect(minLever).toBeGreaterThan(0);
        expect(maxLever).toBeGreaterThan(0);
        expect(maxLever).toBeGreaterThanOrEqual(minLever);
      });
    });

    it("should have valid fee rates", () => {
      allContracts.forEach((contract) => {
        const makerFee = parseFloat(contract.makerFeeRate);
        const takerFee = parseFloat(contract.takerFeeRate);

        expect(makerFee).toBeGreaterThanOrEqual(0);
        expect(takerFee).toBeGreaterThanOrEqual(0);
        expect(takerFee).toBeGreaterThanOrEqual(makerFee); // Taker fee is usually higher
      });
    });

    it("should have valid minimum trade amounts", () => {
      allContracts.forEach((contract) => {
        const minTrade = parseFloat(contract.minTradeUSDT);
        expect(minTrade).toBeGreaterThan(0);
      });
    });
  });
});
