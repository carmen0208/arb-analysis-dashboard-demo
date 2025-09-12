import { createMoralisClient } from "./client";
import { makeMoralisRequest } from "./request";
import { PoolTransaction } from "./types";
import { EvmWalletHistoryTransaction } from "moralis/common-evm-utils";

/**
 * Fetches recent transactions for a pool address on EVM chains.
 * @param poolAddress The pool (pair) contract address
 * @param chain The EVM chain (e.g., 'eth', '0x1', 'bsc', etc.)
 * @param limit The number of transactions to fetch (default 100, max 100)
 * @returns Array of PoolTransaction objects
 */
export async function getPoolRecentTransactions({
  poolAddress,
  chain,
  limit = 100,
}: {
  poolAddress: string;
  chain: string;
  limit?: number;
}): Promise<PoolTransaction[]> {
  const Moralis = await createMoralisClient();

  // Bind the function to the Moralis instance to maintain context
  const boundGetWalletHistory = Moralis.EvmApi.wallets.getWalletHistory.bind(
    Moralis.EvmApi.wallets,
  );

  const response = await makeMoralisRequest(
    boundGetWalletHistory,
    {
      address: poolAddress,
      chain,
      limit,
    },
    "getPoolRecentTransactions",
  );

  // Map Moralis transaction response to our PoolTransaction interface
  return response.result.map((tx: EvmWalletHistoryTransaction) => ({
    transactionHash: tx.hash,
    from: tx.fromAddress.toString(),
    to: tx.toAddress?.toString() || "",
    value: tx.value,
    timestamp: tx.blockTimestamp,
    type: tx.category || "transfer", // Assuming 'category' exists or defaulting
  }));
}
