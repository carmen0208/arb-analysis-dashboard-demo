import { type PublicClient, type Address, getContract, getAddress } from "viem";
import { multicall } from "viem/actions";
import type { ContractDetectionResult, Peer } from "../types";
import type { LayerZeroChainKey } from "../constants";
import { LayerZeroMainnetV2EndpointConfig } from "../constants";
import { createPublicClientForChain } from "../utils/viemClients";
import logger from "../utils/logger";

// OFT Contract ABI - unified definitions for both multicall and contract instance
const OFT_ABI = [
  {
    name: "endpoint",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "peers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "eid", type: "uint32" }],
    outputs: [{ name: "peer", type: "bytes32" }],
  },
  {
    name: "token",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "oftVersion",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "interfaceId", type: "uint8" },
      { name: "version", type: "uint8" },
    ],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Extract individual function definitions from ABI for multicall
const OFT_FUNCTIONS = {
  endpoint: OFT_ABI.find((f) => f.name === "endpoint")!,
  peers: OFT_ABI.find((f) => f.name === "peers")!,
  token: OFT_ABI.find((f) => f.name === "token")!,
  oftVersion: OFT_ABI.find((f) => f.name === "oftVersion")!,
} as const;

/**
 * Convert LayerZero peer address from bytes32 to Ethereum address format
 * LayerZero stores peer addresses as 32 bytes, but Ethereum addresses are only 20 bytes
 * @param bytes32Address - The 32-byte peer address from LayerZero (e.g., "0x000000000000000000000000211cc4dd073734da055fbf44a2b4667d5e5fe5d2")
 * @returns Standard Ethereum address format (e.g., "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2")
 */
function formatPeerAddress(bytes32Address: string): string {
  // Remove "0x" prefix and take the last 40 characters (20 bytes)
  const addressWithoutPrefix = bytes32Address.slice(2);
  const last40Chars = addressWithoutPrefix.slice(-40);

  // Add back "0x" prefix and use getAddress for checksum formatting
  const ethereumAddress = `0x${last40Chars}`;

  try {
    // Use viem's getAddress to ensure proper checksum formatting
    return getAddress(ethereumAddress);
  } catch (error) {
    // If getAddress fails, return the raw address
    logger.warn("[OFT Detection] Failed to format peer address", {
      originalAddress: bytes32Address,
      extractedAddress: ethereumAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return ethereumAddress;
  }
}

/**
 * Check which OFT functions exist using multicall
 */
async function checkOFTFunctions(
  client: PublicClient,
  contractAddress: Address,
): Promise<{
  hasEndpoint: boolean;
  hasToken: boolean;
  hasOFTVersion: boolean;
}> {
  try {
    logger.debug("[OFT Detection] Checking OFT functions via multicall", {
      contract: contractAddress,
    });

    // Prepare multicall for core functions
    const calls = [
      {
        address: contractAddress,
        abi: [OFT_FUNCTIONS.endpoint],
        functionName: "endpoint",
      },
      {
        address: contractAddress,
        abi: [OFT_FUNCTIONS.token],
        functionName: "token",
      },
      {
        address: contractAddress,
        abi: [OFT_FUNCTIONS.oftVersion],
        functionName: "oftVersion",
      },
    ] as const;

    const results = await multicall(client, {
      contracts: calls,
      allowFailure: true,
    });

    const hasEndpoint = results[0].status === "success";
    const hasToken = results[1].status === "success";
    const hasOFTVersion = results[2].status === "success";

    logger.debug("[OFT Detection] Multicall results", {
      contract: contractAddress,
      hasEndpoint,
      hasToken,
      hasOFTVersion,
    });

    return {
      hasEndpoint,
      hasToken,
      hasOFTVersion,
    };
  } catch (error) {
    logger.error("[OFT Detection] Error in multicall function check", {
      contract: contractAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      hasEndpoint: false,
      hasToken: false,
      hasOFTVersion: false,
    };
  }
}

/**
 * Check if peers function exists by testing with a sample EID
 */
async function checkPeersFunction(
  client: PublicClient,
  contractAddress: Address,
): Promise<boolean> {
  try {
    // Test peers function with Ethereum EID (30101)
    const call = {
      address: contractAddress,
      abi: [OFT_FUNCTIONS.peers],
      functionName: "peers" as const,
      args: [30101] as const, // Ethereum EID
    };

    const result = await multicall(client, {
      contracts: [call],
      allowFailure: true,
    });

    return result[0].status === "success";
  } catch {
    return false;
  }
}

/**
 * Get contract instance for OFT operations
 */
function getOFTContract(client: PublicClient, contractAddress: Address) {
  return getContract({
    address: contractAddress,
    abi: OFT_ABI,
    client,
  });
}

/**
 * Check if contract is a standard OFT
 */
export async function isOFTContract(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<boolean> {
  try {
    const client = createPublicClientForChain(chainKey);
    const address = contractAddress as Address;

    logger.info("[OFT Detection] Checking if contract is OFT", {
      contract: contractAddress,
      chain: chainKey,
    });

    // Use multicall to check functions efficiently
    const { hasEndpoint, hasOFTVersion } = await checkOFTFunctions(
      client,
      address,
    );

    // Also check if peers function works with a sample call
    const hasPeers = await checkPeersFunction(client, address);

    // OFT should have endpoint and peers, oftVersion is optional but common
    const isOFT = hasEndpoint && hasPeers;

    logger.info("[OFT Detection] OFT detection completed", {
      contract: contractAddress,
      chain: chainKey,
      isOFT,
      hasEndpoint,
      hasPeers,
      hasOFTVersion,
    });

    return isOFT;
  } catch (error) {
    logger.error("[OFT Detection] Error checking OFT contract", {
      contract: contractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/**
 * Check if contract is an OFT Adapter
 */
export async function isOFTAdapterContract(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<boolean> {
  try {
    const client = createPublicClientForChain(chainKey);
    const address = contractAddress as Address;

    logger.info("[OFT Detection] Checking if contract is OFT Adapter", {
      contract: contractAddress,
      chain: chainKey,
    });

    // Use multicall to check functions efficiently
    const { hasEndpoint, hasToken } = await checkOFTFunctions(client, address);

    // Also check if peers function works
    const hasPeers = await checkPeersFunction(client, address);

    // OFT Adapter should have all three functions
    const isOFTAdapter = hasEndpoint && hasPeers && hasToken;

    logger.info("[OFT Detection] OFT Adapter detection completed", {
      contract: contractAddress,
      chain: chainKey,
      isOFTAdapter,
      hasEndpoint,
      hasPeers,
      hasToken,
    });

    return isOFTAdapter;
  } catch (error) {
    logger.error("[OFT Detection] Error checking OFT Adapter contract", {
      contract: contractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/**
 * Comprehensive contract type detection
 */
export async function detectContractType(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<ContractDetectionResult> {
  logger.info("[OFT Detection] Starting comprehensive contract analysis", {
    contract: contractAddress,
    chain: chainKey,
  });

  const [isOFT, isOFTAdapter] = await Promise.all([
    isOFTContract(contractAddress, chainKey),
    isOFTAdapterContract(contractAddress, chainKey),
  ]);
  let contractType: "OFT" | "OFT_ADAPTER" | "UNKNOWN";

  if (isOFTAdapter) {
    contractType = "OFT_ADAPTER";
  } else if (isOFT) {
    contractType = "OFT";
  } else {
    contractType = "UNKNOWN";
  }

  const result: ContractDetectionResult = {
    isOFT,
    isOFTAdapter,
    contractType,
  };

  logger.info("[OFT Detection] Contract analysis completed", {
    contract: contractAddress,
    chain: chainKey,
    result,
  });

  return result;
}

/**
 * Get the LayerZero endpoint address from an OFT contract
 */
export async function getOFTEndpoint(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<string | null> {
  try {
    const client = createPublicClientForChain(chainKey);
    const contract = getOFTContract(client, contractAddress as Address);

    const endpointAddress = await contract.read.endpoint();

    logger.debug("[OFT Detection] Retrieved endpoint address", {
      contract: contractAddress,
      chain: chainKey,
      endpoint: endpointAddress,
    });

    return endpointAddress;
  } catch (error) {
    logger.error("[OFT Detection] Error getting OFT endpoint", {
      contract: contractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get the wrapped token address from an OFT Adapter
 */
export async function getOFTAdapterToken(
  contractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<string | null> {
  try {
    const client = createPublicClientForChain(chainKey);
    const contract = getOFTContract(client, contractAddress as Address);

    const tokenAddress = await contract.read.token();

    logger.debug("[OFT Detection] Retrieved wrapped token address", {
      contract: contractAddress,
      chain: chainKey,
      token: tokenAddress,
    });

    return tokenAddress;
  } catch (error) {
    logger.error("[OFT Detection] Error getting OFT Adapter token", {
      contract: contractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Get peer information for a specific target chain (more efficient than getAllPeers)
 */
export async function getPeer(
  contractAddress: string,
  sourceChain: LayerZeroChainKey,
  targetChain: LayerZeroChainKey,
): Promise<Peer | null> {
  try {
    // Skip if source and target are the same
    if (sourceChain === targetChain) {
      logger.warn("[OFT Detection] Source and target chain are the same", {
        sourceChain,
        targetChain,
      });
      return null;
    }

    // Get target chain EID directly
    const targetChainConfig = LayerZeroMainnetV2EndpointConfig[targetChain];
    if (!targetChainConfig) {
      logger.warn("[OFT Detection] Target chain not found in config", {
        targetChain,
        availableChains: Object.keys(LayerZeroMainnetV2EndpointConfig),
      });
      return null;
    }

    const targetEid = targetChainConfig.eid;
    const client = createPublicClientForChain(sourceChain);
    const address = contractAddress as Address;

    logger.info("[OFT Detection] Checking peer for specific target chain", {
      contract: contractAddress,
      sourceChain,
      targetChain,
      targetEid,
    });

    // Single call to check peer for target EID
    const result = await client.readContract({
      address,
      abi: [OFT_FUNCTIONS.peers],
      functionName: "peers",
      args: [parseInt(targetEid)],
    });

    const rawPeerAddress = result as string;
    const isActive =
      rawPeerAddress !==
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    if (!isActive) {
      logger.debug("[OFT Detection] No active peer found for target chain", {
        contract: contractAddress,
        sourceChain,
        targetChain,
        targetEid,
      });
      return null;
    }

    // Format the peer address from bytes32 to standard Ethereum address
    const formattedPeerAddress = formatPeerAddress(rawPeerAddress);

    logger.debug("[OFT Detection] Found active peer for target chain", {
      contract: contractAddress,
      sourceChain,
      targetChain,
      targetEid,
      rawAddress: rawPeerAddress,
      formattedAddress: formattedPeerAddress,
    });

    return {
      eid: targetEid,
      chainKey: targetChain,
      peerAddress: formattedPeerAddress,
      isActive: true,
    };
  } catch (error) {
    logger.error("[OFT Detection] Error checking peer for target chain", {
      contract: contractAddress,
      sourceChain,
      targetChain,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * Check which peers exist for all LayerZero EIDs using multicall
 */
export async function getAllPeers(
  oftContractAddress: string,
  chainKey: LayerZeroChainKey,
): Promise<{
  peers: Array<Peer>;
  totalPeers: number;
}> {
  try {
    const client = createPublicClientForChain(chainKey);

    logger.info("[OFT Detection] Checking peers for all EIDs via multicall", {
      contract: oftContractAddress,
      chain: chainKey,
    });

    // Get all EIDs from LayerZero config, excluding current chain
    const allChains = Object.entries(LayerZeroMainnetV2EndpointConfig)
      .filter(([chain]) => chain !== chainKey)
      .map(([chain, config]) => ({
        chainKey: chain as LayerZeroChainKey,
        eid: config.eid,
      }));

    // Prepare multicall for all EIDs
    const calls = allChains.map(({ eid }) => ({
      address: oftContractAddress as Address,
      abi: [OFT_FUNCTIONS.peers],
      functionName: "peers" as const,
      args: [parseInt(eid)] as const,
    }));

    logger.debug("[OFT Detection] Checking peers for EIDs", {
      contract: oftContractAddress,
      chain: chainKey,
      totalEIDs: calls.length,
      eids: allChains.map(({ eid }) => eid),
    });

    const results = await multicall(client, {
      contracts: calls,
      allowFailure: true,
    });

    const peers = [];
    let totalPeers = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const { chainKey: peerChainKey, eid } = allChains[i];

      if (result.status === "success") {
        const rawPeerAddress = result.result as string;
        const isActive =
          rawPeerAddress !==
          "0x0000000000000000000000000000000000000000000000000000000000000000";

        if (isActive) {
          // Format the peer address from bytes32 to standard Ethereum address
          const formattedPeerAddress = formatPeerAddress(rawPeerAddress);

          peers.push({
            eid,
            chainKey: peerChainKey,
            peerAddress: formattedPeerAddress,
            isActive,
          });
          totalPeers++;

          logger.debug("[OFT Detection] Found active peer", {
            eid,
            chainKey: peerChainKey,
            rawAddress: rawPeerAddress,
            formattedAddress: formattedPeerAddress,
          });
        }
      }
    }

    logger.info("[OFT Detection] Peer discovery completed", {
      contract: oftContractAddress,
      chain: chainKey,
      totalPeers,
      activePeers: peers.length,
      peers: peers.map((p) => ({ eid: p.eid, chain: p.chainKey })),
    });

    return {
      peers,
      totalPeers,
    };
  } catch (error) {
    logger.error("[OFT Detection] Error checking peers", {
      contract: oftContractAddress,
      chain: chainKey,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      peers: [],
      totalPeers: 0,
    };
  }
}
