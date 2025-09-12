import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";
import {
  ChainId,
  ERC20Token,
  CurrencyAmount,
  TradeType,
} from "@pancakeswap/sdk";
import { bscTokens } from "@pancakeswap/tokens";
import { GraphQLClient } from "graphql-request";
import { OnChainProvider, Pool, SmartRouter } from "@pancakeswap/smart-router";
import { fileCacheAdapter as cache } from "@dex-ai/core";
import logger from "../../common/logger";
import { SerializedPool } from "@pancakeswap/smart-router/dist/evm/v3-router/utils/transformer";

// Token input type
export type TokenInput = {
  chainId?: number;
  address: string;
  decimals?: number;
  symbol: string;
  name?: string;
};

const CACHE_NAME = "pancake-pools";
const CACHE_TTL = 1000 * 60 * 60 * 8; // 8 hours

const publicClient = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed1.binance.org"),
  batch: {
    multicall: {
      batchSize: 1024 * 200,
    },
  },
});

const onChainProvider: OnChainProvider = (_opts?: { chainId?: number }) =>
  publicClient;

const toERC20Token = (token: TokenInput) =>
  new ERC20Token(
    token.chainId ?? ChainId.BSC,
    token.address as `0x${string}`,
    token.decimals ?? 18,
    token.symbol,
    token.name ?? "",
  );

// --- Serialization helpers ---
const serializePools = (pools: Pool[]): SerializedPool[] =>
  pools.map((pool) => SmartRouter.Transformer.serializePool(pool));
const deserializePools = (objs: SerializedPool[]): Pool[] =>
  objs.map((obj) => SmartRouter.Transformer.parsePool(56, obj));

export const getPools = async (
  swapFrom: TokenInput,
  swapTo: TokenInput,
): Promise<Pool[]> => {
  logger.info("[Pancake] getPools called", { swapFrom, swapTo });
  const fromToken = !swapFrom ? bscTokens.usdt : toERC20Token(swapFrom);
  const toToken = toERC20Token(swapTo);
  const cacheKeys = [fromToken.address, toToken.address];
  const cached = await cache.getFromCache<{
    data: SerializedPool[];
    timestamp: string;
  }>(CACHE_NAME, ...cacheKeys);
  if (cached && Array.isArray(cached.data)) {
    logger.info("[Pancake] Returning pools from valid cache", {
      from: fromToken.symbol,
      to: toToken.symbol,
      count: cached.data.length,
    });
    return deserializePools(cached.data);
  }
  if (cached) {
    logger.info("[Pancake] Cache is stale, will fetch fresh pools", {
      from: fromToken.symbol,
      to: toToken.symbol,
    });
  } else {
    logger.info("[Pancake] No cache found, will fetch fresh pools", {
      from: fromToken.symbol,
      to: toToken.symbol,
    });
  }
  try {
    const v3SubgraphClient = new GraphQLClient(
      "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
    );
    const v2SubgraphClient = new GraphQLClient(
      "https://proxy-worker-api.pancakeswap.com/bsc-exchange",
    );
    const [v2Pools, v3Pools] = await Promise.all([
      SmartRouter.getV2CandidatePools({
        onChainProvider,
        v3SubgraphProvider: (_options: unknown) => v2SubgraphClient,
        currencyA: fromToken,
        currencyB: toToken,
      }),
      SmartRouter.getV3CandidatePools({
        onChainProvider,
        subgraphProvider: (_options: unknown) => v3SubgraphClient,
        currencyA: fromToken,
        currencyB: toToken,
      }),
    ]);
    const allPools = [...v2Pools, ...v3Pools];
    await cache.saveToCache(
      CACHE_NAME,
      { data: serializePools(allPools), timestamp: new Date().toISOString() },
      CACHE_TTL,
      ...cacheKeys,
    );
    logger.info("[Pancake] Fetched and cached fresh pools", {
      from: fromToken.symbol,
      to: toToken.symbol,
      count: allPools.length,
    });
    return allPools;
  } catch (err) {
    logger.error("[Pancake] Error fetching pools", {
      from: fromToken.symbol,
      to: toToken.symbol,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (cached) {
      logger.warn(
        "[Pancake] Returning potentially stale pools from cache due to error",
        {
          from: fromToken.symbol,
          to: toToken.symbol,
          count: cached.data.length,
        },
      );
      return deserializePools(cached.data);
    }
    throw err;
  }
};

export const fetchTradePrice = async (
  swapFrom: TokenInput,
  toToken: TokenInput,
  pools: Pool[],
) => {
  logger.info("[Pancake] fetchTradePrice called", { swapFrom, toToken });
  const fromToken = swapFrom ? toERC20Token(swapFrom) : bscTokens.usdt;
  const toTokenObj = toERC20Token(toToken);
  const quoteProvider = SmartRouter.createQuoteProvider({
    onChainProvider,
  });
  const amount = CurrencyAmount.fromRawAmount(
    fromToken,
    10 ** fromToken.decimals,
  );
  try {
    const trade = await SmartRouter.getBestTrade(
      amount,
      toTokenObj,
      TradeType.EXACT_INPUT,
      {
        gasPriceWei: () => publicClient.getGasPrice(),
        maxHops: 2,
        maxSplits: 2,
        poolProvider: SmartRouter.createStaticPoolProvider(pools),
        quoteProvider,
        quoterOptimization: true,
      },
    );
    if (trade !== null) {
      const price =
        Number(trade.inputAmount.toExact()) /
        Number(trade?.outputAmount.toExact());
      logger.info("[Pancake] Trade found", {
        from: fromToken.symbol,
        to: toToken.symbol,
        price,
        inputAmount: trade.inputAmount.toExact(),
        outputAmount: trade.outputAmount.toExact(),
      });
      return {
        toToken: toToken.symbol,
        price,
        inputAmount: trade.inputAmount.toExact(),
        outputAmount: trade.outputAmount.toExact(),
      };
    } else {
      logger.info("[Pancake] No trade found", {
        from: fromToken.symbol,
        to: toToken.symbol,
      });
    }
    return null;
  } catch (err) {
    logger.error("[Pancake] Error fetching trade price", {
      from: fromToken.symbol,
      to: toToken.symbol,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
};

export const getBestPrices = async ({
  swapFrom,
  toTokens,
}: {
  swapFrom: TokenInput;
  toTokens: TokenInput[];
}) => {
  logger.info("[Pancake] getBestPrices called", { swapFrom, toTokens });
  const results = await Promise.all(
    toTokens.map((toToken) => getBestPrice({ swapFrom, toToken })),
  );
  logger.info("[Pancake] getBestPrices finished", { count: results.length });
  return results.filter(Boolean);
};

export const getBestPrice = async ({
  swapFrom,
  toToken,
}: {
  swapFrom: TokenInput;
  toToken: TokenInput;
}) => {
  logger.info("[Pancake] getBestPrice called", { swapFrom, toToken });
  const pools = await getPools(swapFrom, toToken);
  const priceInfo = await fetchTradePrice(swapFrom, toToken, pools);
  logger.info("[Pancake] getBestPrice finished", {
    swapFrom,
    toToken,
    priceInfo,
  });
  return priceInfo;
};

export { ERC20Token, ChainId };
