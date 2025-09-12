// LayerZero related types for configuration and client operations
import type { LayerZeroChainKey } from "./constants";

export type { LayerZeroChainKey };

export interface NativeCurrency {
  name?: string;
  symbol: string;
  cgId?: string;
  cmcId?: number;
  decimals: number;
}

export interface EndpointConfig {
  eid: string;
  rpc: string;
  name: string;
  nativeChainId: number;
  nativeCurrency: NativeCurrency;
}

export interface PeerConnectivity {
  isConnected: boolean;
  peerAddress: string;
  sourceEid: string;
  targetEid: string;
}

export interface DeploymentConfig {
  eid: string;
  chainKey: string;
  stage: string;
  version: number;
  endpointV2: { address: string };
  sendUln302: { address: string };
  receiveUln302: { address: string };
  sendUln301?: { address: string };
  receiveUln301?: { address: string };
  executor?: { address: string };
}

export interface LayerZeroDeployment {
  deployments: DeploymentConfig[];
  chainKey: string;
  executor?: { address: string };
  dvns?: { [address: string]: DVNInfo };
}

export interface DVNInfo {
  version: number;
  canonicalName: string;
  id: string;
  lzReadCompatible?: boolean;
  deprecated?: boolean;
}

export interface Peer {
  eid: string;
  chainKey: LayerZeroChainKey;
  peerAddress: string;
  isActive: boolean;
}

export interface ExecutorConfig {
  executorAddress: string;
  maxMessageSize: number;
  executorFeeCap: string;
}

export interface DVNConfig {
  address: string;
  canonicalName: string;
  threshold?: number;
  optionalDVNs?: string[];
  requiredDVNs?: string[];
}

export interface ULNConfig {
  confirmations: number;
  requiredDVNs: readonly string[];
  optionalDVNs: readonly string[];
  optionalDVNThreshold: number;
}

// LayerZero OApp Configuration structure based on the actual LayerZero config format
export interface OAppConfigDetails {
  requiredDVNs: readonly string[];
  requiredDVNCount: number;
  optionalDVNs: readonly string[];
  optionalDVNCount: number;
  optionalDVNThreshold: number;
  confirmations: number;
}

export interface SenderOAppConfig extends OAppConfigDetails {
  sendLibrary: string;
  sendLibVersion: string;
  executor: string;
}

export interface ReceiverOAppConfig extends OAppConfigDetails {
  receiveLibrary: string;
  receiveLibVersion: string;
}

export interface ExecutorAndDVNConfig {
  senderOAppConfig: SenderOAppConfig;
  receiverOAppConfig: ReceiverOAppConfig;
}

export interface OFTConfiguration {
  contractAddress: string;
  chainKey: string;
  contractType: "OFT" | "OFT_ADAPTER" | "UNKNOWN";
  layerZeroDeployments: LayerZeroDeployment;
  peers: Peer[];
  executorAndDVNConfigs: ExecutorAndDVNConfig[];
  supportedChains: string[];
}

export interface OFTAnalysisResult {
  isOFT: boolean;
  isOFTAdapter: boolean;
  contractType: "OFT" | "OFT_ADAPTER" | "UNKNOWN";
  peers: Peer[];
  supportedChains: LayerZeroChainKey[];
  bridgeConfigs: BridgeConfig[];
  layerZeroDeployments?: DeploymentConfig;
}

export interface OFTConfigRequest {
  contractAddress: string;
  chainId: string;
  targetEids?: string[];
  peers?: Peer[];
}

export interface BridgeConfig {
  fromChain: string;
  toChain: string;
  isAvailable: boolean;
  executorConfig?: ExecutorConfig;
  dvnConfig?: DVNConfig;
  fees?: {
    executorFee: string;
    dvnFee: string;
    protocolFee: string;
  };
}

// LayerZero Metadata API Response for deployments
export interface LayerZeroMetadataAPIResponse {
  [chainName: string]: LayerZeroDeployment;
}

// Configuration reading request
export interface ConfigReadRequest {
  contractAddress: string;
  chainKey: string;
  targetEids: string[];
  deploymentConfig: DeploymentConfig;
  peers: Peer[]; // Add peers information for configuration reading
}

// Contract detection result
export interface ContractDetectionResult {
  isOFT: boolean;
  isOFTAdapter: boolean;
  contractType: "OFT" | "OFT_ADAPTER" | "UNKNOWN";
}

// API response types for LayerZero metadata API
export interface LayerZeroAPIResponse {
  [tokenSymbol: string]: Array<{
    name: string;
    sharedDecimals: number;
    endpointVersion: string;
    deployments: {
      [chainName: string]: {
        address: string;
        localDecimals: number;
        type: string;
        innerTokenAddress?: string;
        approvalRequired?: boolean;
      };
    };
  }>;
}

// Viem client configuration
export interface ViemClientConfig {
  rpc: string;
  chainId: number;
  name: string;
}
