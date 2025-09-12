import {
  FuturesProductTypeV2,
  FuturesTickerV2,
  RestClientV2,
  WebsocketClientV2,
} from "bitget-api";
import { getLogger, Logger } from "@dex-ai/core";
import { getActiveContracts } from "./contracts";

const logger: Logger = getLogger("bitget-perp-tickers");

export type BitgetPerpTickerV2 = FuturesTickerV2;

type PriceCallback = (data: FuturesTickerV2) => void;

export interface SubscribeBitgetTickersOptions {
  reconnect?: boolean; // Whether to auto-reconnect
  onError?: (err: Error) => void;
}

export interface BitgetTickerSubscription {
  ws: WebsocketClientV2;
  close: () => void;
}

// Get all supported perp tickers (default USDT perpetual)
export async function fetchAllPerpTickers(): Promise<FuturesTickerV2[]> {
  const client = new RestClientV2();
  const res = await client.getFuturesAllTickers({
    productType: "USDT-FUTURES",
  });

  return res.data;
}

// Subscribe to real-time prices for specified symbol list
export function subscribePerpPrices(
  symbols: string[],
  onPrice: PriceCallback,
  options?: SubscribeBitgetTickersOptions,
): BitgetTickerSubscription {
  if (!symbols.length) {
    throw new Error("No symbols provided for Bitget ticker subscription");
  }

  let reconnecting = false;

  const wrapper: BitgetTickerSubscription = {
    ws: undefined as unknown as WebsocketClientV2, // will be set after connect
    close: () => {
      if (wrapper.ws) {
        wrapper.ws.closeAll();
      }
    },
  };

  const connect = (): WebsocketClientV2 => {
    // Create custom logger to suppress internal error logs
    const silentLogger = {
      silly: () => {}, // Empty function, no logging
      debug: () => {},
      notice: () => {},
      info: () => {},
      warning: () => {},
      error: () => {}, // Empty function, no error logging
    };

    // Configure WebSocket client to suppress internal error logs
    const ws = new WebsocketClientV2({}, silentLogger);

    // Construct subscription parameters
    const subs = symbols.map((symbol) => ({
      channel: "ticker" as const,
      instType: "USDT-FUTURES" as FuturesProductTypeV2,
      instId: symbol,
    }));
    ws.subscribe(subs);

    ws.on("open", () => {
      logger.info(
        "[Bitget Perp] WebSocket connection opened, subscribing to tickers",
        {
          symbols,
        },
      );
    });

    ws.on("update", (msg) => {
      if (msg.data && Array.isArray(msg.data)) {
        msg.data.forEach((item: FuturesTickerV2) => {
          onPrice(item);
        });
      }
    });

    ws.on("exception", (msg: string) => {
      logger.error("[Bitget Perp] WebSocket exception", { msg });
      const error = new Error(msg);
      options?.onError?.(error);
    });

    ws.on("close", () => {
      logger.warn("[Bitget Perp] WebSocket connection closed");
      if (options?.reconnect && !reconnecting) {
        reconnecting = true;
        setTimeout(() => {
          reconnecting = false;
          const newWs = connect();
          wrapper.ws = newWs;
        }, 2000);
      }
    });

    wrapper.ws = ws;
    return ws;
  };

  connect();
  return wrapper;
}

// Get single ticker by symbol
export function getPerpTickerBySymbol(
  symbol: string,
  allTickers: FuturesTickerV2[],
): FuturesTickerV2 | undefined {
  return allTickers.find((ticker) => ticker.symbol === symbol);
}

// Get multiple tickers by symbol list
export async function getPerpTickersBySymbols(
  symbols: string[],
): Promise<FuturesTickerV2[]> {
  const allTickers = await fetchAllPerpTickers();
  const activeContracts = await getActiveContracts();
  const bitgetSymbols = toBitgetTickers(symbols);
  const symbolSet = new Set(bitgetSymbols);
  return allTickers
    .filter((ticker) => symbolSet.has(ticker.symbol))
    .filter((ticker) =>
      activeContracts.some((contract) => contract.symbol === ticker.symbol),
    );
}

export function toBitgetTicker(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}

export function toBitgetTickers(symbols: string[]): string[] {
  return symbols.map(toBitgetTicker);
}

// Export contracts functionality
export * from "./contracts";

// Export mark price functionality
export * from "./markPrice";

// Export trading functionality
export * from "./trading";
