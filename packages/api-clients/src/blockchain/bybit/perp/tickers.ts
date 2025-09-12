import WebSocket from "ws";
import { getLogger, Logger } from "@dex-ai/core";
import { RestClientV5 } from "bybit-api";

const logger: Logger = getLogger("bybit-perp-tickers");

export interface BybitTicker {
  symbol: string;
  markPrice?: string;
  ask1Price?: string;
  bid1Price?: string;
  indexPrice?: string;
}

export type BybitTickerCallback = (ticker: BybitTicker) => void;

export interface SubscribeBybitTickersOptions {
  reconnect?: boolean; // Whether to auto-reconnect
  onError?: (err: Error) => void;
}

export interface BybitTickerSubscription {
  ws: WebSocket;
  close: () => void;
}

const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/linear";

/**
 * Fetch the list of supported Bybit perp symbols (REST API)
 */
export async function fetchBybitSupportedSymbols(): Promise<string[]> {
  const client = new RestClientV5();
  // Fetch all contract tickers
  const res = await client.getTickers({
    category: "linear",
  });

  const result = res.result?.list || [];
  return result.map((item) => item.symbol);
}

export async function fetchBybitPerpTickers(
  symbols: string[],
): Promise<BybitTicker[]> {
  const client = new RestClientV5();
  // Fetch all contract tickers
  const res = await client.getTickers({
    category: "linear",
  });
  const allTickers = res.result?.list || [];

  const bybitSymbols = toBybitTickers(symbols);
  const symbolSet = new Set(bybitSymbols);
  return allTickers.filter((ticker) => symbolSet.has(ticker.symbol));
}

/**
 * Subscribe to Bybit USDT Perp tickers via WebSocket (does NOT validate symbol)
 * @param symbols Array of contract symbols, e.g. ["BTCUSDT","ETHUSDT"]
 * @param onUpdate Callback for each ticker update (single ticker per call)
 * @param options Optional settings, supports auto-reconnect and error callback
 * @returns WebSocket instance
 */
function _subscribeBybitTickers(
  symbols: string[],
  onUpdate: BybitTickerCallback,
  options?: SubscribeBybitTickersOptions,
): BybitTickerSubscription {
  if (!symbols.length)
    throw new Error("No symbols provided for Bybit ticker subscription");

  let reconnecting = false;

  const wrapper: BybitTickerSubscription = {
    ws: undefined as unknown as WebSocket, // will be set after connect
    close: () => {
      if (wrapper.ws && wrapper.ws.readyState === WebSocket.OPEN) {
        wrapper.ws.close();
      }
    },
  };

  const connect = (): WebSocket => {
    const socket = new WebSocket(BYBIT_WS_URL);

    socket.onopen = () => {
      logger.info("[Bybit Perp] WebSocket opened, subscribing to tickers", {
        symbols,
      });
      socket.send(
        JSON.stringify({
          op: "subscribe",
          args: symbols.map((s) => `tickers.${s}`),
        }),
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.topic && data.topic.startsWith("tickers.")) {
          const ticker = data.data;
          if (ticker && ticker.symbol) {
            const result: BybitTicker = {
              symbol: ticker.symbol,
              indexPrice: ticker.indexPrice,
              markPrice: ticker.markPrice,
              ask1Price: ticker.ask1Price,
              bid1Price: ticker.bid1Price,
            };
            onUpdate(result);
          }
        }
      } catch (err) {
        logger.error("[Bybit Perp] Failed to parse WebSocket message", {
          error: err,
        });
        options?.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    socket.onerror = (err) => {
      logger.error("[Bybit Perp] WebSocket error", { error: err });
      options?.onError?.(err instanceof Error ? err : new Error(String(err)));
    };

    socket.onclose = (event) => {
      logger.warn("[Bybit Perp] WebSocket closed", {
        code: event.code,
        reason: event.reason,
      });
      if (options?.reconnect && !reconnecting) {
        reconnecting = true;
        setTimeout(() => {
          reconnecting = false;
          const newWs = connect();
          wrapper.ws = newWs;
        }, 2000);
      }
    };

    wrapper.ws = socket;
    return socket;
  };

  connect();
  return wrapper;
}

/**
 * Safely subscribe to Bybit perp tickers: automatically filters out unsupported symbols before subscribing.
 * @param requestedSymbols Array of user-requested symbols
 * @param onUpdate Callback for each ticker update
 * @param options Subscription options
 * @returns WebSocket instance
 * @throws If no valid symbols are found
 */
export async function subscribeBybitTickers(
  requestedSymbols: string[],
  onUpdate: BybitTickerCallback,
  options?: SubscribeBybitTickersOptions,
): Promise<BybitTickerSubscription> {
  const supportedSymbols = await fetchBybitSupportedSymbols();
  const validSymbols = requestedSymbols.filter((s) =>
    supportedSymbols.includes(s),
  );
  if (!validSymbols.length)
    throw new Error("No valid Bybit symbols to subscribe");
  return _subscribeBybitTickers(validSymbols, onUpdate, options);
}

export function toBybitTicker(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}
export function toBybitTickers(symbols: string[]): string[] {
  return symbols.map(toBybitTicker);
}
