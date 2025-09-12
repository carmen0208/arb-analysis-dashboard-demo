/**
 * Type Definitions for Etherscan API Client
 */

import { ChainId } from "./constants";

// Token transaction response from Etherscan API
export interface TokenTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  methodId: string;
  functionName: string;
  confirmations: string;
}

// API response structure
export interface EtherscanResponse<T> {
  status: "0" | "1";
  message: "OK" | "NOTOK";
  result: T;
}

// Token information
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  priceUSD?: number;
}

// Enhanced token transaction with calculated values
export interface EnhancedTokenTransaction extends TokenTransaction {
  // Calculated fields
  valueInTokens: number;
  valueInUSD?: number;
  tokenInfo: TokenInfo;
  isLargeTransfer: boolean;
  transferThreshold: number;
}

// Monitoring configuration
export interface MonitoringConfig {
  addresses: string[];
  thresholds: {
    [address: string]: {
      minAmountUSD: number;
      minAmountTokens?: number;
    };
  };
  intervalMinutes: number;
  chainId: ChainId;
}

// Block range for monitoring
export interface BlockRange {
  startBlock: number;
  endBlock: number;
  timestamp: number;
}

// Monitoring result
export interface MonitoringResult {
  chainId: ChainId;
  blockRange: BlockRange;
  transactions: EnhancedTokenTransaction[];
  largeTransfers: EnhancedTokenTransaction[];
  summary: {
    totalTransactions: number;
    largeTransfersCount: number;
    totalValueUSD: number;
    monitoredAddresses: string[];
  };
}

// API request parameters
export interface TokenTransactionParams {
  chainid: number;
  module: "account";
  action: "tokentx";
  address: string;
  page?: number;
  offset?: number;
  startblock?: number;
  endblock?: number;
  sort?: "asc" | "desc";
  apikey: string;
}

// Block API request parameters
export interface BlockParams {
  chainid: number;
  module: "block";
  action: "getblocknobytime";
  timestamp: string;
  closest: "before" | "after";
  apikey: string;
}

// Error types
export interface EtherscanError {
  status: "0";
  message: "NOTOK";
  result: string;
}

// Price data for token valuation
export interface TokenPriceData {
  tokenAddress: string;
  priceUSD: number;
  lastUpdated: string;
  source: string;
}
