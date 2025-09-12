interface Token {
  token_address: string;
  token_name: string;
  token_symbol?: string;
  token_decimals?: string;
  liquidity_usd?: number;
  pair_token_type?: string;
  token_logo?: string;
}

export interface TokenPair {
  pair_address: string;
  pair_label?: string;
  exchange_name?: string;
  exchange_address: string;
  exchange_logo?: string;
  liquidity_usd?: number;
  volume_24h_usd?: number;
  pair: [Token, Token];
}

export interface SolanaTokenPair {
  pairAddress: string;
  pairLabel?: string;
  exchangeName?: string;
  exchangeAddress: string;
  exchangeLogo?: string;
  liquidityUsd?: number;
  volume24hrUsd?: number;
  pair: [Token, Token];
}

export interface TokenPool {
  pair_address: string;
  token0: Token;
  token1: Token;
  exchange_name?: string;
  exchange_address: string;
  exchange_logo?: string;
  pair_label?: string;
  liquidity_usd: number;
  volume_24h_usd: number;
}

export interface PoolTransaction {
  transactionHash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  type: "swap" | "transfer" | string;
}

export interface ClassificationResult {
  address: string;
  type: "smart" | "sniper" | "whale";
  reason: string;
}
