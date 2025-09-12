import { V3PoolConfig, getChainById } from "./pools/config";
import { createPublicClient, http, type PublicClient } from "viem";

/**
 * Create viem client
 */
export function createClient(config: V3PoolConfig): PublicClient {
  const chain = getChainById(config.chainId);

  return createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  }) as PublicClient;
}
