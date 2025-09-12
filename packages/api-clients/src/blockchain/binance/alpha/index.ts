// Alpha Token Management and Query
import { createPublicClient, http, type PublicClient, isAddress } from "viem";
import { bsc } from "viem/chains";
import { DexToken } from "../../types";
import presetAlphaTokens from "./alphaTokens.json";
import { getLogger, Logger } from "@dex-ai/core";
import { put } from "@vercel/blob";

// Constants
const DEFAULT_RPC_URL = "https://bsc-dataseed.binance.org";
const DEFAULT_BLOB_NAME = "binance-alpha-cache.json"; // Separate blob for cache
const logger: Logger = getLogger("blockchain-binance");

// Types
export interface BinanceAlphaConfig {
  rpcUrl?: string;
  blobName?: string;
}

export interface AlphaToken extends DexToken {
  platform: "binance-smart-chain";
  verified: boolean;
}

const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
];

// Backup cache to Vercel Blob
async function backupCacheToBlob(
  cache: Map<string, AlphaToken>,
  blobName: string,
): Promise<void> {
  try {
    const tokens = Array.from(cache.values());
    logger.info(`Backing up ${tokens.length} tokens to Vercel Blob`, {
      blobName,
    });
    const blob = await put(blobName, JSON.stringify(tokens, null, 2), {
      access: "public",
      allowOverwrite: true,
      contentType: "application/json",
    });
    logger.info("Cache backed up to Vercel Blob successfully", {
      url: blob.url,
    });
  } catch (e) {
    logger.error("Failed to back up cache to Vercel Blob", {
      error: e instanceof Error ? e.message : String(e),
    });
    // Do not throw, as this is a non-critical background operation
  }
}

// Fetch token info from chain
async function fetchTokenFromChain(
  client: PublicClient,
  address: `0x${string}`,
): Promise<AlphaToken | null> {
  try {
    const [decimals, symbol, name] = await client.multicall({
      contracts: [
        {
          address: address,
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        },
        {
          address: address,
          abi: ERC20_ABI,
          functionName: "symbol",
          args: [],
        },
        {
          address: address,
          abi: ERC20_ABI,
          functionName: "name",
          args: [],
        },
      ],
      allowFailure: false,
      batchSize: 4096,
    });

    return {
      platform: "binance-smart-chain",
      symbol: symbol as string,
      address,
      decimals: Number(decimals),
      name: name as string,
      verified: false, // Newly discovered tokens default to unverified
    };
  } catch (e) {
    logger.error(`Failed to fetch token info for ${address}`, {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// Client interface
export interface BinanceAlphaClient {
  fetchTokens: (symbolOrAddress: string) => Promise<AlphaToken[]>;
  fetchToken: (address: `0x${string}`) => Promise<AlphaToken | null>;
  // the rest of the functions will be added later
  // fetchPair: (address: string) => Promise<...>;
  // fetchPrice: (address: string) => Promise<...>;
}
const cache = new Map<string, AlphaToken>(); // In-memory cache

// Create client with all functionality
export async function createClient(
  config?: BinanceAlphaConfig,
): Promise<BinanceAlphaClient> {
  const rpcUrl = config?.rpcUrl || DEFAULT_RPC_URL;
  const blobName = config?.blobName || DEFAULT_BLOB_NAME;

  // Validate Vercel Blob token for backup
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.warn(
      "BLOB_READ_WRITE_TOKEN not found. Cache backup will be disabled.",
    );
  }

  // Create viem client
  const viemClient = createPublicClient({
    chain: bsc,
    transport: http(rpcUrl),
  });

  const fetchTokens = async (symbolOrAddress: string) => {
    const query = symbolOrAddress.toLowerCase();

    // 1. Search in local preset alphaTokens.json
    const presetTokensList: Omit<AlphaToken, "platform" | "verified">[] =
      presetAlphaTokens;

    const foundInPreset: AlphaToken[] = isAddress(query)
      ? presetTokensList
          .filter((t) => t.address.toLowerCase() === query) // Exact match for address
          .map((t) => ({
            ...t,
            platform: "binance-smart-chain",
            verified: true,
          }))
      : presetTokensList
          .filter((t) => t.symbol.toLowerCase().startsWith(query)) // Partial match for symbol
          .map((t) => ({
            ...t,
            platform: "binance-smart-chain",
            verified: true,
          }));

    if (foundInPreset.length > 0) {
      logger.info("Found token(s) in preset list", {
        count: foundInPreset.length,
      });
      return foundInPreset;
    }

    // 2. If not found in preset list, search in local memory cache
    const tokensFromCache: AlphaToken[] = isAddress(query)
      ? cache.get(query)
        ? [cache.get(query) as AlphaToken]
        : []
      : Array.from(cache.values()).filter((t) =>
          t.symbol.toLowerCase().includes(query),
        );

    if (tokensFromCache.length > 0) {
      logger.info("Found token(s) in local cache", {
        count: tokensFromCache.length,
      });
      return tokensFromCache;
    }

    // 3. If not in cache and input is a valid address, query from chain
    if (isAddress(symbolOrAddress)) {
      const chainToken = await fetchTokenFromChain(viemClient, symbolOrAddress);
      if (chainToken) {
        // Add to cache, key by address
        cache.set(chainToken.address.toLowerCase(), chainToken);
        logger.info("Fetched token from chain and cached", {
          symbol: chainToken.symbol,
          address: chainToken.address,
          test: "test",
          decimals: chainToken.decimals,
        });

        // Backup to Vercel Blob (fire and forget)
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          backupCacheToBlob(cache, blobName);
        }

        return [chainToken];
      }
    }

    return [];
  };

  const fetchToken = async (address: `0x${string}`) => {
    const tokens = await fetchTokens(address);
    return tokens[0] || null;
  };

  return {
    fetchTokens,
    fetchToken,
  };
}
