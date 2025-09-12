// Auto-generated from layerzero-api-metadata.json
// DO NOT EDIT MANUALLY - Run MetadataExtractor to regenerate

export const LayerZeroMainnetV2EndpointConfig = {
  ethereum: {
    eid: "30101",
    rpc: "https://eth.drpc.org",
    name: "Ethereum",
    nativeChainId: 1,
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
  bsc: {
    eid: "30102",
    rpc: "https://bsc.drpc.org",
    name: "BSC",
    nativeChainId: 56,
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      cgId: "binancecoin",
      cmcId: 1839,
      decimals: 18,
    },
  },
  polygon: {
    eid: "30109",
    rpc: "https://polygon.drpc.org",
    name: "Polygon",
    nativeChainId: 137,
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      cgId: "polygon-ecosystem-token",
      cmcId: 28321,
      decimals: 18,
    },
  },
  arbitrum: {
    eid: "30110",
    rpc: "https://arbitrum.drpc.org",
    name: "Arbitrum",
    nativeChainId: 42161,
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
  optimism: {
    eid: "30111",
    rpc: "https://optimism.drpc.org",
    name: "Optimism",
    nativeChainId: 10,
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
  base: {
    eid: "30184",
    rpc: "https://base.drpc.org",
    name: "Base",
    nativeChainId: 8453,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
  avalanche: {
    eid: "30106",
    rpc: "https://avalanche.drpc.org",
    name: "Avalanche",
    nativeChainId: 43114,
    nativeCurrency: {
      name: "Avalanche Token",
      symbol: "AVAX",
      cgId: "avalanche-2",
      cmcId: 5805,
      decimals: 18,
    },
  },
  mantle: {
    eid: "30181",
    rpc: "https://rpc.mantle.xyz",
    name: "Mantle",
    nativeChainId: 5000,
    nativeCurrency: {
      name: "Mantle",
      symbol: "MNT",
      cgId: "mantle",
      cmcId: 27075,
      decimals: 18,
    },
  },
  zkevm: {
    eid: "30158",
    rpc: "https://zkevm-rpc.com",
    name: "Polygon zkEVM",
    nativeChainId: 1101,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
  sei: {
    eid: "30280",
    rpc: "https://evm-rpc.sei-apis.com",
    name: "Sei",
    nativeChainId: 1329,
    nativeCurrency: {
      symbol: "SEI",
      cgId: "sei-network",
      cmcId: 23149,
      decimals: 18,
    },
  },
  solana: {
    eid: "30168",
    rpc: "https://api.mainnet-beta.solana.com",
    name: "Solana",
    nativeChainId: 101,
    nativeCurrency: {
      symbol: "SOL",
      cgId: "solana",
      cmcId: 5426,
      decimals: 9,
    },
  },
  sonic: {
    eid: "30332",
    rpc: "https://rpc.soniclabs.com",
    name: "Sonic",
    nativeChainId: 146,
    nativeCurrency: {
      symbol: "S",
      cgId: "sonic-3",
      cmcId: 32684,
      decimals: 18,
    },
  },
  hyperliquid: {
    eid: "30367",
    rpc: "https://api.hyperliquid.xyz/evm",
    name: "Hyperliquid",
    nativeChainId: 998,
    nativeCurrency: {
      symbol: "ETH",
      cgId: "ethereum",
      cmcId: 1027,
      decimals: 18,
    },
  },
} as const;

export type LayerZeroChainKey = keyof typeof LayerZeroMainnetV2EndpointConfig;
export type LayerZeroEndpoint =
  (typeof LayerZeroMainnetV2EndpointConfig)[LayerZeroChainKey];
