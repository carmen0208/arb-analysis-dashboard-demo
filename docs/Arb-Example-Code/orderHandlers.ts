import { DexPairWithPrice } from "./types";
import { performSwap, performSwapBack } from "./okexchange/swapOperations";
import { handleBybitOpenShort, handleBybitClosePosition } from "./bybit/perp";
import {
  handleBitgetOpenShort,
  handleBitgetClosePosition,
} from "./bitget/perp";
import { Account, WalletClient } from "viem";
import { BybitCredentials } from "@/app/utils/bybitAuth";
import { BitgetCredentials } from "@/app/utils/bitgetAuth";
import { EXCHANGE } from "@dex-ai/api-clients/types";

export type OrderParams = {
  pair: DexPairWithPrice;
  amount: string;
  account?: Account;
  walletClient?: WalletClient;
  bybitCredentials?: BybitCredentials;
  bitgetCredentials?: BitgetCredentials;
  getApiKey?: () => string;
};

export type LegResult = {
  success: boolean;
  message: string;
  exchange: string;
  pair: string;
  legIndex: number;
};

export type CloseOrderResult = {
  success: boolean;
  message: string;
  details?: {
    totalLegs: number;
    successfulLegs: number;
    failedLegs: number;
    failures?: LegResult[];
    allResults: LegResult[];
  };
};

export type OrderHandler = {
  open: (params: OrderParams) => Promise<void>;
  close: (
    params: OrderParams,
  ) => Promise<{ success: boolean; message: string }>;
};

export const exchangeHandlers: Record<string, OrderHandler> = {
  [EXCHANGE.OKX_DEX]: {
    open: async ({ pair, amount, account, walletClient }) =>
      performSwap(
        amount,
        pair,
        account as Account,
        walletClient as WalletClient,
      ),
    close: async ({ pair, account, walletClient }) =>
      performSwapBack(pair, account as Account, walletClient as WalletClient),
  },
  [EXCHANGE.BYBIT_FUTURES]: {
    open: async ({ pair, amount, bybitCredentials, getApiKey }) =>
      handleBybitOpenShort(
        amount,
        pair,
        bybitCredentials as BybitCredentials,
        getApiKey as () => string,
      ),
    close: async ({ pair, bybitCredentials, getApiKey }) =>
      handleBybitClosePosition(
        pair.pairSymbol,
        bybitCredentials as BybitCredentials,
        getApiKey as () => string,
      ),
  },
  [EXCHANGE.BITGET_FUTURES]: {
    open: async ({ pair, amount, bitgetCredentials, getApiKey }) =>
      handleBitgetOpenShort(
        amount,
        pair,
        bitgetCredentials as BitgetCredentials,
        getApiKey as () => string,
      ),
    close: async ({ pair, bitgetCredentials, getApiKey }) =>
      handleBitgetClosePosition(
        pair.pairSymbol,
        bitgetCredentials as BitgetCredentials,
        getApiKey as () => string,
      ),
  },
  [EXCHANGE.BINANCE_FUTURES]: {
    open: async ({ pair, amount, binanceCredentials, getApiKey }) =>
      handleBitgetOpenShort(
        amount,
        pair,
        binanceCredentials as BinanceCredentials,
        getApiKey as () => string,
      ),
    close: async ({ pair, bitgetCredentials, getApiKey }) =>
      handleBinanceClosePosition(
        pair.pairSymbol,
        binanceCredentials as BinanceCredentials,
        getApiKey as () => string,
      ),
  },
  // Can be extended with more exchanges in the future
};

export type ArbitrageOrderLeg = {
  exchange: string;
  pair: DexPairWithPrice;
  amount: string;
};

export type ArbitrageOrderParams = {
  legs: ArbitrageOrderLeg[];
  account?: Account;
  walletClient?: WalletClient;
  bybitCredentials?: BybitCredentials;
  bitgetCredentials?: BitgetCredentials;
  getApiKey?: () => string;
};

// Order type compatible with UI/OrderContext
export type ArbitrageOrder = {
  pairA: DexPairWithPrice;
  pairB: DexPairWithPrice;
  amount: number;
  qty: string;
  message?: string;
  // Additional properties for future multi-leg orders
  legs?: Array<{
    pair: DexPairWithPrice;
    amount: number;
    direction: "long" | "short";
  }>;
  [key: string]: unknown; // More type-safe than any
};

// Multi-leg arbitrage order entry point
export async function handleCreateOrder(params: ArbitrageOrderParams) {
  for (const leg of params.legs) {
    const handler = exchangeHandlers[leg.exchange];
    if (!handler) throw new Error(`Unsupported exchange: ${leg.exchange}`);
    await handler.open({
      pair: leg.pair,
      amount: leg.amount,
      account: params.account,
      walletClient: params.walletClient,
      bybitCredentials: params.bybitCredentials,
      bitgetCredentials: params.bitgetCredentials,
      getApiKey: params.getApiKey,
    });
  }
}

// Execute close position operation for a single leg
async function executeCloseLeg(
  leg: { exchange: string; pair: DexPairWithPrice },
  legIndex: number,
  context: {
    account?: Account;
    walletClient?: WalletClient;
    bybitCredentials?: BybitCredentials;
    bitgetCredentials?: BitgetCredentials;
    getApiKey?: () => string;
  },
): Promise<LegResult> {
  const handler = exchangeHandlers[leg.exchange];
  if (!handler) {
    throw new Error(`Unsupported exchange: ${leg.exchange}`);
  }

  try {
    const result = await handler.close({
      pair: leg.pair,
      amount: "0", // For close position, amount is 0 or ignored
      account: context.account,
      walletClient: context.walletClient,
      bybitCredentials: context.bybitCredentials,
      bitgetCredentials: context.bitgetCredentials,
      getApiKey: context.getApiKey,
    });

    return {
      ...result,
      exchange: leg.exchange,
      pair: leg.pair.pairSymbol,
      legIndex,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      exchange: leg.exchange,
      pair: leg.pair.pairSymbol,
      legIndex,
    };
  }
}

// Build failure message string
function buildFailureMessage(failedResults: LegResult[]): string {
  return failedResults
    .map(
      (result) =>
        `Leg ${result.legIndex}(${result.exchange}-${result.pair}): ${result.message}`,
    )
    .join("; ");
}

// Create close order result object
function createCloseOrderResult(
  results: LegResult[],
  isSuccess: boolean,
  failureMessage?: string,
): CloseOrderResult {
  const totalLegs = results.length;
  const failedResults = results.filter((result) => !result.success);
  const successfulLegs = totalLegs - failedResults.length;

  if (isSuccess) {
    return {
      success: true,
      message: `Close position successful (${totalLegs}/${totalLegs} legs all successful)`,
      details: {
        totalLegs,
        successfulLegs,
        failedLegs: 0,
        allResults: results,
      },
    };
  }

  return {
    success: false,
    message: `Close position failed (${successfulLegs}/${totalLegs} successful): ${failureMessage}`,
    details: {
      totalLegs,
      successfulLegs,
      failedLegs: failedResults.length,
      failures: failedResults,
      allResults: results,
    },
  };
}

// Multi-leg arbitrage order close position entry point, directly pass Order
export async function handleCloseOrder(
  order: ArbitrageOrder,
  context: {
    account?: Account;
    walletClient?: WalletClient;
    bybitCredentials?: BybitCredentials;
    getApiKey?: () => string;
  },
): Promise<CloseOrderResult> {
  // Support pairA, pairB, can be extended with more legs in the future
  const legs = [
    { exchange: order.pairA.exchange, pair: order.pairA },
    { exchange: order.pairB.exchange, pair: order.pairB },
  ];

  // Execute close position operations for all legs
  const results: LegResult[] = [];
  for (let i = 0; i < legs.length; i++) {
    const result = await executeCloseLeg(legs[i], i + 1, context);
    results.push(result);
  }

  // Check if there are any failed legs
  const failedResults = results.filter((result) => !result.success);
  const hasFailures = failedResults.length > 0;

  if (hasFailures) {
    const failureMessage = buildFailureMessage(failedResults);
    return createCloseOrderResult(results, false, failureMessage);
  }

  return createCloseOrderResult(results, true);
}
