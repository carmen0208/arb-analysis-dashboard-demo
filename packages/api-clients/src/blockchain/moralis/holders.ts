import { EvmTopProfitableWalletPerTokenResponse } from "@moralisweb3/common-evm-utils";
import { createMoralisClient } from "./client";
import { makeMoralisRequest } from "./request";
import { getLogger, Logger } from "@dex-ai/core";
const logger: Logger = getLogger("blockchain-moralis");

export interface TokenTopHolders {
  name: string;
  logo: string;
  symbol: string;
  holders: TokenHolder[];
}

const supportedChains = [
  "eth",
  "0x1",
  "matic",
  "polygon",
  "0x89",
  "base",
  "0x2105",
];

export type TokenHolder = EvmTopProfitableWalletPerTokenResponse; // Export the type alias
/**
 * Fetches the top holders of an ERC20 token on EVM chains.
 * @param tokenAddress The ERC20 token contract address
 * @param chain The EVM chain (e.g., 'eth', '0x1', 'bsc', etc.)
 * @param limit The number of holders to fetch (default 100, max 100)
 * @returns Array of TokenHolder objects
 */
export async function getTokenTopHolders({
  address,
  chain,
  limit = 30,
}: {
  address: string;
  chain: string;
  limit?: number;
}): Promise<TokenTopHolders> {
  if (!supportedChains.includes(chain)) {
    throw new Error(
      `Chain ${chain} is not supported, (the supported chains are: ${supportedChains.join(
        ", ",
      )})`,
    );
  }

  const Moralis = await createMoralisClient();

  // Bind the function to the Moralis instance to maintain context
  const boundGetTopProfitableWalletPerToken =
    Moralis.EvmApi.token.getTopProfitableWalletPerToken.bind(
      Moralis.EvmApi.token,
    );

  const response = await makeMoralisRequest(
    boundGetTopProfitableWalletPerToken,
    {
      address,
      chain,
      limit,
    },
    "getTokenTopHolders",
  );

  const { name, symbol, logo, result: holders } = response.result;
  // Map to simplified structure
  return {
    name,
    symbol,
    logo,
    holders,
  };
}

export async function safeGetTokenTopHolders({
  address,
  chain,
  limit = 30,
}: {
  address: string;
  chain: string;
  limit?: number;
}): Promise<TokenTopHolders | null> {
  try {
    const result = await getTokenTopHolders({ address, chain, limit });
    return result;
  } catch (error) {
    logger.warn("[safeGetTokenTopHolders] Failed to get token top holders", {
      address,
      chain,
      limit,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
