import { AxiosError } from "axios";
import { getLogger, Logger } from "@dex-ai/core";
import { apiClient, solanaApiClient } from "./client";
import { SolanaTokenPair, TokenPair, TokenPool } from "./types";

const logger: Logger = getLogger("blockchain-moralis");

export type SupportedExchange =
  | "uniswapv2"
  | "uniswapv3"
  | "sushiswapv2"
  | "pancakeswapv2"
  | "pancakeswapv1"
  | "quickswap";

type TokenPairsResponse = {
  pairs: TokenPair[];
};

/**
 * Fetches all liquidity pools for a given token across supported DEXes on a specific chain.
 * @param tokenAddress The ERC20 token contract address
 * @param chain The EVM chain (e.g., 'eth', '0x1', 'bsc', etc.)
 * @param limit Optional. Maximum number of token pairs to return (default: 30)
 * @param offset Optional. Pagination offset (default: 0)
 * @returns Array of TokenPool objects containing all pairs the token is part of
 */
export async function getTokenPools({
  tokenAddress,
  chain,
  limit = 30,
}: {
  tokenAddress: string;
  chain: string;
  limit?: number;
  offset?: number;
}): Promise<TokenPool[]> {
  try {
    // Make a direct HTTP request to the Moralis REST API using the existing apiClient
    const response = await apiClient.get<TokenPairsResponse>(
      `/erc20/${tokenAddress}/pairs`,
      {
        params: {
          chain,
          limit,
        },
      },
    );

    const data = response.data;
    if (!data.pairs || data.pairs.length === 0) {
      return [];
    }

    // Transform the response into our TokenPool format
    return data.pairs.map((pair) => ({
      pair_address: pair.pair_address,
      pair_label: pair.pair_label,
      exchange_name: pair.exchange_name,
      exchange_address: pair.exchange_address,
      exchange_logo: pair.exchange_logo,
      liquidity_usd: pair.liquidity_usd || 0,
      volume_24h_usd: pair.volume_24h_usd || 0,
      token0: pair.pair[0],
      token1: pair.pair[1],
    }));
  } catch (error) {
    logger.error(
      "[Moralis] Error fetching token pairs:",
      (error as AxiosError)?.response?.statusText || "unknown error",
    );
    return [];
  }
}

/**
 * Fetches token pairs for a Solana token address
 * @param tokenAddress The Solana token address
 * @param network The Solana network (default: 'mainnet')
 * @returns Array of TokenPool objects for Solana pairs
 */
export async function getSolanaTokenPairs({
  tokenAddress,
  network = "mainnet",
}: {
  tokenAddress: string;
  network?: string;
}): Promise<TokenPool[]> {
  try {
    // Correct Moralis Solana API path
    const response = await solanaApiClient.get<{ pairs: SolanaTokenPair[] }>(
      `/token/${network}/${tokenAddress}/pairs`,
    );

    const data = response.data;

    if (!data.pairs || data.pairs.length === 0) {
      return [];
    }
    // Transform the response into our TokenPool format
    return data.pairs.map((pair) => ({
      pair_address: pair.pairAddress,
      pair_label: pair.pairLabel,
      token0: pair.pair[0],
      token1: pair.pair[1],
      exchange_name: pair.exchangeName,
      exchange_address: pair.exchangeAddress,
      exchange_logo: pair.exchangeLogo,
      liquidity_usd: pair.liquidityUsd || 0,
      volume_24h_usd: pair.volume24hrUsd || 0,
    }));
  } catch (error) {
    logger.error(
      "[Moralis] Error fetching Solana token pairs:",
      (error as AxiosError)?.response?.statusText || "unknown error",
    );
    // logger.error("Error fetching Solana token pairs:", error);
    return [];
  }
}
