/**
 * Type Definitions for CoinGecko API Client
 */

export interface CoinListInfo {
  id: string;
  symbol: string;
  name: string;
  platforms?: CoinPlatformInfo;
}

export interface CoinPlatformInfo {
  [platformId: string]: string;
}

export interface CoinDetailInfo extends CoinListInfo {
  platforms: CoinPlatformInfo;
  // Add other fields from the /coins/{id} endpoint if needed
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  platforms?: CoinPlatformInfo;
}

export interface TickerMarket {
  name: string;
  identifier: string;
  has_trading_incentive: boolean;
  logo?: string;
}

export interface Ticker {
  base: string;
  target: string;
  market: TickerMarket;
  last: number;
  volume: number;
  converted_last: Record<string, number>;
  converted_volume: Record<string, number>;
  trust_score: string;
  bid_ask_spread_percentage: number;
  timestamp: string;
  last_traded_at: string;
  last_fetch_at: string;
  is_anomaly: boolean;
  is_stale: boolean;
  trade_url?: string;
  token_info_url?: string | null;
  coin_id?: string;
  target_coin_id?: string;
}

export interface CoinTickerResponse {
  name: string;
  tickers: Ticker[];
}

// New: Historical price data related types
export interface MarketChartDataPoint {
  timestamp: number; // UNIX timestamp in milliseconds
  price: number;
  marketCap: number;
  volume: number;
}

export interface MarketChartResponse {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

export interface TokenPriceData {
  source: "coingecko";
  tokenAddress: string;
  platform: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  lastUpdated: string;
  historicalData?: MarketChartDataPoint[];
}

export interface PriceDataPoint {
  timestamp: number;
  price: number;
  source: string;
}

/**
 * Price Source Enum
 *
 * This enum defines all supported price data sources in the system.
 * Used for multi-source price aggregation and comparison.
 */
export enum PriceSourceName {
  COINGECKO = "coingecko",
  BYBIT = "bybit",
  OKX = "okx",
  BINANCE = "binance",
  BITGET = "bitget",
}

// Type-safe version using enum as keys
export interface MultiSourcePriceData {
  tokenAddress: string;
  sources: Partial<{
    [K in PriceSourceName]: {
      currentPrice: number;
      lastUpdated: string;
      historicalData?: PriceDataPoint[];
    };
  }>;
}

/**
 * Top Pools by Network API Types
 */

export interface PoolToken {
  id: string;
  type: "token";
}

export interface PoolData {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: number;
    base_token_price_native_currency: number;
    quote_token_price_usd: number;
    quote_token_price_native_currency: number;
    base_token_price_quote_token: number;
    quote_token_price_base_token: number;
    pool_id: string;
    fdv_usd: number;
    market_cap_usd?: number;
    market_cap_fully_diluted_usd?: number;
    total_supply: string;
    quote_token_balance: string;
    base_token_balance: string;
    price_change_percentage: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    volume_usd: {
      h24: number;
      h6: number;
      h1: number;
      m5: number;
    };
    reserve_in_usd: number;
    transactions: {
      h24: {
        buys: number;
        sells: number;
      };
      h6: {
        buys: number;
        sells: number;
      };
      h1: {
        buys: number;
        sells: number;
      };
      m5: {
        buys: number;
        sells: number;
      };
    };
    network: string;
    dex_id: string;
    pair_contract_address?: string;
    liquidity_in_usd?: number;
    liquidity_in_quote_token?: number;
    liquidity_in_base_token?: number;
    created_at: string;
    updated_at: string;
  };
  relationships: {
    base_token: {
      data: PoolToken;
    };
    quote_token: {
      data: PoolToken;
    };
  };
}

export interface TopPoolsResponse {
  data: PoolData[];
  links: {
    first: string;
    last: string;
    prev?: string;
    next?: string;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

export interface TopPoolsOptions {
  page?: number;
  include?: string[];
}
