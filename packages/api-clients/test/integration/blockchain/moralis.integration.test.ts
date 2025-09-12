import { describe, it, expect, beforeAll } from "vitest";
import {
  getTokenTopHolders,
  getTokenPools,
} from "../../../src/blockchain/moralis/";
import { getSolanaTokenPairs } from "../../../src/blockchain/moralis/pools";

const ETH_MAINNET = "0x1";
const PEPE_ADDRESS = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
const USDT_ADDRESS = "0xdac17f958d2ee523a2206206994597c13d831ec7";

describe("Moralis Solana Integration", () => {
  it("should fetch token pairs for a known Solana token address", async () => {
    // Example: USDC on Solana mainnet
    const tokenAddress = "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN"; // Replace with a real Solana token address for a real test
    const pairs = await getSolanaTokenPairs({
      tokenAddress,
      network: "mainnet",
    });
    expect(Array.isArray(pairs)).toBe(true);
    // If you use a real address, you can expect(pairs.length).toBeGreaterThan(0);
  });

  it("should return an empty array for a nonsense Solana address", async () => {
    const tokenAddress = "FakeSolanaAddress1234567890";
    const pairs = await getSolanaTokenPairs({
      tokenAddress,
      network: "mainnet",
    });
    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs.length).toBe(0);
  });
});

describe("Moralis EVM Integration", () => {
  beforeAll(() => {
    if (!process.env.MORALIS_API_KEY) {
      throw new Error("MORALIS_API_KEY must be set for integration tests");
    }
  });

  it("fetches top holders for PEPE", async () => {
    const { holders } = await getTokenTopHolders({
      address: PEPE_ADDRESS,
      chain: ETH_MAINNET,
      days: "30",
    });
    expect(Array.isArray(holders)).toBe(true);
    expect(holders.length).toBeGreaterThan(0);
    expect(holders[0]).toHaveProperty("address");
    expect(holders[0]).toHaveProperty("realizedProfitUsd");
  });

  it("fetches pools for USDT", async () => {
    const pools = await getTokenPools({
      chain: ETH_MAINNET,
      tokenAddress: USDT_ADDRESS,
    });

    expect(Array.isArray(pools)).toBe(true);
    expect(
      pools.find((pool) => pool.exchange_name === "Uniswap v3"),
    ).toBeDefined();
  });
});
