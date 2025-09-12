import {
  getCoinInfo,
  getCoinPrice,
  getCoinAddresses,
  getCoinInfoBySymbol,
  getCoinTickers,
} from "../coingecko";
import { getTokenPools } from "../moralis";
import {
  TokenAggregateInfo,
  TokenSearchResult,
  TokenSearchOptions,
  TokenDetailOptions,
} from "./types";
import logger from "../../common/logger";
import { TokenPool } from "../moralis/types";
import { safeGetTokenTopHolders, TokenTopHolders } from "../moralis/holders";

/**
 * Search for tokens matching the provided query
 *
 * @param options Search options including query and result limit
 * @returns Array of matching token results for user selection
 */
export async function searchTokens(
  options: TokenSearchOptions,
): Promise<TokenSearchResult[]> {
  const { query, limit = 20 } = options;

  try {
    logger.info("[TokenAggregator] Searching for tokens", { query, limit });

    // Get token matches from CoinGecko
    const coinInfo = await getCoinInfoBySymbol(query);

    if (!coinInfo || coinInfo.length === 0) {
      logger.info("[TokenAggregator] No tokens found for query", { query });
      return [];
    }

    // Map to search results and limit the number of results
    const results = coinInfo.slice(0, limit).map((token) => ({
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      platforms: token.platforms || {},
    }));

    logger.info("[TokenAggregator] Found matching tokens", {
      query,
      resultCount: results.length,
    });

    return results;
  } catch (error) {
    logger.error("[TokenAggregator] Error searching for tokens", {
      query,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

/**
 * Mapping of native tokens to their wrapped versions for different chains
 * This allows us to get pools and holders for native tokens which don't have addresses themselves
 */
const WRAPPED_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH on Ethereum
    "binance-smart-chain": "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // WETH on BSC
    "polygon-pos": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH on Polygon
  },
  bitcoin: {
    ethereum: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC on Ethereum
    "binance-smart-chain": "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB on BSC
    "polygon-pos": "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC on Polygon
  },
  // Add more native tokens as needed
};

/**
 * Check if a token is a native token for its blockchain
 */
function isNativeToken(tokenId: string): boolean {
  return Object.keys(WRAPPED_TOKEN_ADDRESSES).includes(tokenId);
}

/**
 * Get wrapped token address for native tokens
 */
function getWrappedTokenAddress(
  tokenId: string,
  platformId: string,
): string | null {
  if (
    isNativeToken(tokenId) &&
    WRAPPED_TOKEN_ADDRESSES[tokenId] &&
    WRAPPED_TOKEN_ADDRESSES[tokenId][platformId]
  ) {
    return WRAPPED_TOKEN_ADDRESSES[tokenId][platformId];
  }
  return null;
}

/**
 * Get detailed token information after user selects a specific token
 *
 * @param options Token detail options including tokenId and chain
 * @returns Comprehensive token information from multiple sources
 */
export async function getTokenDetails(
  options: TokenDetailOptions,
): Promise<TokenAggregateInfo | null> {
  const {
    tokenId,
    chain = "0x1",
    includeHolders = true,
    includePools = true,
    poolLimit = 10,
    holdersLimit = 10,
  } = options;

  try {
    logger.info("[TokenAggregator] Fetching detailed token info", {
      tokenId,
      chain,
    });

    // Step 1: Get price data
    const price = await getCoinPrice(tokenId);

    // Step 1.5: Get tickers
    const tickers = await getCoinTickers(tokenId);

    // Step 2: Get platform addresses
    const platforms = await getCoinAddresses(tokenId);

    if (!platforms) {
      logger.warn("[TokenAggregator] No platform addresses found", { tokenId });
      return null;
    }

    // Find the address on the requested chain
    const chainPlatformId = getChainMapping(chain);
    let address: string | null = platforms[chainPlatformId];

    // Handle native tokens (like ETH, BTC) that don't have contract addresses on their own chains
    const isNative = isNativeToken(tokenId);

    if (!address && isNative) {
      logger.info(
        "[TokenAggregator] This appears to be a native token, using wrapped version",
        {
          tokenId,
          chain,
          chainPlatformId,
        },
      );

      // Try to get wrapped token address
      address = getWrappedTokenAddress(tokenId, chainPlatformId);

      if (!address) {
        logger.warn(
          "[TokenAggregator] No wrapped token address found for native token",
          {
            tokenId,
            chain,
            chainPlatformId,
          },
        );

        // For native tokens without a wrapped version in our mapping, we'll continue
        // without pools and holders data
        if (includeHolders || includePools) {
          logger.info(
            "[TokenAggregator] Will return basic token info without pools/holders",
          );
        }
      }
    }

    // Get basic token info again to ensure we have the most accurate data
    const tokenInfoList = await getCoinInfo(tokenId);
    const tokenInfo = tokenInfoList.find((t) => t.id === tokenId);

    if (!tokenInfo) {
      logger.error("[TokenAggregator] Failed to get token info", { tokenId });
      return null;
    }

    // If there's no address at all for this token on this chain, return null
    if (!address && !isNative) {
      logger.warn("[TokenAggregator] Token not available on requested chain", {
        chain,
        tokenId,
        chainPlatformId,
        availablePlatforms: Object.keys(platforms),
      });
      return {
        basicInfo: {
          id: tokenInfo.id,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          price: price || 0,
        },
        price: {
          current: price || 0,
          change24h: null, // Would need additional API call to get this
        },
        tickers,
        platforms,
        isNativeToken: isNative,
        pools: [],
        topHolders: null,
      };
    }

    // Step 3: Parallel fetch pools and holders if address is available
    let pools: TokenPool[] = [];
    let topHolders: TokenTopHolders | null = null;
    logger.debug(
      "getTokenPools({ tokenAddress: address, chain, limit: poolLimit })",
      { tokenAddress: address, chain, limit: poolLimit },
    );
    logger.debug("getTokenTopHolders({ address, chain, days })", {
      address,
      chain,
      holdersLimit,
    });
    if (address) {
      [pools, topHolders] = await Promise.all([
        includePools
          ? getTokenPools({ tokenAddress: address, chain, limit: poolLimit })
          : Promise.resolve([]),
        includeHolders
          ? safeGetTokenTopHolders({ address, chain, limit: holdersLimit })
          : Promise.resolve(null),
      ]);
    } else {
      // If no address (native token without wrapped mapping), use empty values
      pools = [];
      topHolders = null;
    }
    logger.info("[TokenAggregator]: get Pools and topHolder", {
      pools: pools.length,
      topHolder: topHolders?.holders.length,
    });

    // Step 4: Assemble the response
    return {
      basicInfo: {
        id: tokenInfo.id,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        price: price || 0,
      },
      price: {
        current: price || 0,
        change24h: null, // Would need additional API call to get this
      },
      platforms,
      pools,
      topHolders,
      isNativeToken: isNative,
      tickers,
    };
  } catch (error) {
    logger.error("[TokenAggregator] Error fetching token details", {
      tokenId,
      chain,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Helper function to map chain IDs to CoinGecko platform IDs
 */
function getChainMapping(chain: string): string {
  const chainMappings: Record<string, string> = {
    eth: "ethereum",
    "0x1": "ethereum",
    bsc: "binance-smart-chain",
    "0x56": "binance-smart-chain",
    polygon: "polygon-pos",
    "0x89": "polygon-pos",
    avalanche: "avalanche",
    "0xa86a": "avalanche",
    // Add more chains as needed
  };

  return chainMappings[chain.toLowerCase()] || chain.toLowerCase();
}
