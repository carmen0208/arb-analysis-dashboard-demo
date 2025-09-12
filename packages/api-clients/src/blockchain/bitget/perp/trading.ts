import { FuturesAccountV2, RestClientV2 } from "bitget-api";
import { getLogger, Logger } from "@dex-ai/core";

const logger: Logger = getLogger("bitget-perp-trading");

export interface BitgetCredentials {
  apiKey: string;
  apiSecret: string;
  apiPass: string; // Bitget-specific API password
  useTestnet?: boolean;
}

export interface OpenPositionParams {
  symbol: string;
  amount: string;
  side: "buy" | "sell";
  credentials: BitgetCredentials;
  marginMode?: "isolated" | "crossed";
  marginCoin?: string;
}

export interface ClosePositionResult {
  success: boolean;
  error?: string;
  details?: string;
  data?: {
    message: string;
    symbol: string;
    orders: Array<{
      orderId: string;
      clientOid: string;
      symbol: string;
    }>;
  };
}

export interface ClosePositionParams {
  symbol: string;
  credentials: BitgetCredentials;
  holdSide?: "long" | "short";
}

export interface GetPositionsParams {
  symbol?: string;
  credentials: BitgetCredentials;
}

export interface TradeResult {
  success: boolean;
  data?: {
    order: {
      orderId: string;
      orderLinkId: string;
    };
    message: string;
    side: "buy" | "sell";
    marginMode: "isolated" | "crossed";
    marginCoin: string;
  };
  error?: string;
  details?: string;
}

export interface WalletBalanceResult {
  success: boolean;
  data?: FuturesAccountV2;
  error?: string;
  details?: string;
}

export interface PositionInfo {
  symbol: string;
  holdSide: "long" | "short";
  total: string;
  available: string;
  margin: string;
  unrealizedPL: string;
  // Additional properties that may be returned by the API
  averagePrice?: string;
  leverage?: string;
  marginCoin?: string;
  productType?: string;
  positionValue?: string;
  [key: string]: string | undefined;
}

export interface PositionsResult {
  success: boolean;
  positions?: PositionInfo[];
  allPositions?: PositionInfo[];
  error?: string;
  details?: string;
}

/**
 * Create Bitget client instance
 */
function createBitgetClient(credentials: BitgetCredentials): RestClientV2 {
  logger.debug("[Bitget Trading] Creating client instance", {
    useTestnet: credentials.useTestnet ?? false,
    hasApiKey: !!credentials.apiKey,
    hasApiPass: !!credentials.apiPass,
  });

  return new RestClientV2({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    apiPass: credentials.apiPass,
    demoTrading: credentials.useTestnet ?? false, // Default to live trading
  });
}

/**
 * Set leverage for a symbol
 */
async function setLeverage(
  client: RestClientV2,
  symbol: string,
  leverage: string = "1",
  marginCoin: string = "USDT",
): Promise<void> {
  try {
    logger.debug("[Bitget Trading] Setting leverage", {
      symbol,
      leverage,
      marginCoin,
    });

    await client.setFuturesLeverage({
      symbol: symbol,
      productType: "USDT-FUTURES",
      marginCoin: marginCoin,
      leverage: leverage,
    });

    logger.info("[Bitget Trading] Leverage set successfully", {
      symbol,
      leverage,
      marginCoin,
    });
  } catch (error) {
    // Leverage setting failed should not prevent trading, may already be set
    logger.warn(
      "[Bitget Trading] Leverage setting failed (might already be set)",
      {
        symbol,
        leverage,
        marginCoin,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Open position (generic function, can choose to buy or sell)
 */
export async function openPosition(
  params: OpenPositionParams,
): Promise<TradeResult> {
  const {
    symbol,
    amount,
    side,
    credentials,
    marginMode = "isolated",
    marginCoin = "USDT",
  } = params;

  logger.info("[Bitget Trading] Opening position", {
    symbol,
    amount,
    side,
    marginMode,
    marginCoin,
  });

  try {
    if (
      !symbol ||
      !amount ||
      !side ||
      !credentials.apiKey ||
      !credentials.apiSecret ||
      !credentials.apiPass
    ) {
      logger.error(
        "[Bitget Trading] Missing required parameters for opening position",
        {
          hasSymbol: !!symbol,
          hasAmount: !!amount,
          hasSide: !!side,
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
          hasApiPass: !!credentials.apiPass,
        },
      );

      return {
        success: false,
        error:
          "Missing required parameters: symbol, amount, side, apiKey, apiSecret, apiPass",
      };
    }

    const client = createBitgetClient(credentials);

    // First set leverage to 1x
    await setLeverage(client, symbol, "1", marginCoin);

    const clientOid = `open-${side}-${symbol}-${Date.now()}`;

    logger.debug("[Bitget Trading] Submitting order", {
      symbol,
      amount,
      side,
      orderType: "market",
      tradeSide: "open",
      marginMode,
      marginCoin,
    });

    // Open position using market order
    const order = await client.futuresSubmitOrder({
      symbol: symbol,
      productType: "USDT-FUTURES",
      marginMode: marginMode,
      marginCoin: marginCoin,
      size: amount.toString(),
      side,
      //   tradeSide: "open",
      orderType: "market",
      clientOid: clientOid,
    });

    logger.info("[Bitget Trading] Position opened successfully", {
      symbol,
      amount,
      side,
      marginMode,
      marginCoin,
      retCode: order.code,
      retMsg: order.msg,
      result: order.data,
      orderId: order.data?.orderId,
      clientOid: order.data?.clientOid,
    });
    if (order.code !== "00000") {
      logger.error("[Bitget Trading] Failed to open position", {
        symbol,
        amount,
        side,
        error: order.msg,
      });
      return {
        success: false,
        error: `Failed to open ${side} position`,
        details: order.msg,
      };
    }

    return {
      success: true,
      data: {
        order: {
          orderId: order.data?.orderId ?? "",
          orderLinkId: order.data?.clientOid ?? "",
        },
        message: `Successfully opened ${side} position for ${symbol}`,
        side,
        marginMode,
        marginCoin,
      },
    };
  } catch (error: unknown) {
    logger.error("[Bitget Trading] Failed to open position", {
      symbol,
      amount,
      side,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: "Failed to open position",
      details: (error as Error).message || (error as string),
    };
  }
}

/**
 * Close position using flash close
 */
export async function closePosition(
  params: ClosePositionParams,
): Promise<ClosePositionResult> {
  const { symbol, credentials } = params;

  logger.info("[Bitget Trading] Closing position", { symbol });

  try {
    if (
      !symbol ||
      !credentials.apiKey ||
      !credentials.apiSecret ||
      !credentials.apiPass
    ) {
      logger.error(
        "[Bitget Trading] Missing required parameters for closing position",
        {
          hasSymbol: !!symbol,
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
          hasApiPass: !!credentials.apiPass,
        },
      );

      return {
        success: false,
        error:
          "Missing required parameters: symbol, apiKey, apiSecret, apiPass",
      };
    }

    const client = createBitgetClient(credentials);

    logger.debug("[Bitget Trading] Flash closing position", {
      symbol,
    });

    // Execute flash close position
    const result = await client.futuresFlashClosePositions({
      symbol: symbol,
      productType: "USDT-FUTURES",
    });
    if (result.code !== "00000") {
      logger.error("[Bitget Trading] Failed to close position", {
        symbol,
        error: result.msg,
      });
      return {
        success: false,
        error: "Failed to close position",
        details: result.msg,
      };
    }

    logger.info("[Bitget Trading] Position closed successfully", {
      symbol,
      result: result.data,
    });

    return {
      success: true,
      data: {
        orders: result.data.successList,
        message: `Successfully closed all position(s) for ${symbol}`,
        symbol,
      },
    };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "body" in error &&
      typeof (error as { body: { code?: string } }).body === "object" &&
      (error as { body: { code?: string } }).body.code === "22002"
    ) {
      return {
        success: true,
        data: {
          orders: [],
          message: "No position to close",
          symbol,
        },
      };
    }
    logger.error("[Bitget Trading] Failed to close position", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: "Failed to close position",
      details: (error as Error).message || (error as string),
    };
  }
}

/**
 * Get position info
 */
export async function getPositions(
  params: GetPositionsParams,
): Promise<PositionsResult> {
  const { symbol, credentials } = params;

  logger.info("[Bitget Trading] Getting positions", {
    symbol: symbol || "all",
  });

  try {
    if (!credentials.apiKey || !credentials.apiSecret || !credentials.apiPass) {
      logger.error(
        "[Bitget Trading] Missing required credentials for getting positions",
        {
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
          hasApiPass: !!credentials.apiPass,
        },
      );

      return {
        success: false,
        error: "Missing required parameters: apiKey, apiSecret, apiPass",
      };
    }

    const client = createBitgetClient(credentials);
    const positions = await client.getFuturesPositions({
      marginCoin: "USDT",
      productType: "USDT-FUTURES",
    });
    logger.debug("[Bitget Trading] Raw positions data", { positions });

    logger.debug("[Bitget Trading] Fetching position info from API", {
      symbol,
    });

    // Get position info - Bitget API doesn't have a direct getPositions method
    // We'll need to use account info or other methods to get position data
    // For now, return a placeholder response
    logger.warn(
      "[Bitget Trading] Position retrieval not fully implemented yet",
      {
        symbol: symbol || "all",
      },
    );

    return {
      success: true,
      positions: [],
      allPositions: [],
      details:
        "Position retrieval method needs to be implemented based on Bitget API capabilities",
    };
  } catch (error: unknown) {
    logger.error("[Bitget Trading] Failed to get positions", {
      symbol: symbol || "all",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: "Failed to get positions",
      details: (error as Error).message || (error as string),
    };
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(
  credentials: BitgetCredentials,
): Promise<WalletBalanceResult> {
  logger.info("[Bitget Trading] Getting wallet balance");

  try {
    if (!credentials.apiKey || !credentials.apiSecret || !credentials.apiPass) {
      logger.error(
        "[Bitget Trading] Missing required credentials for getting wallet balance",
        {
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
          hasApiPass: !!credentials.apiPass,
        },
      );

      return {
        success: false,
        error: "Missing required parameters: apiKey, apiSecret, apiPass",
      };
    }

    const client = createBitgetClient(credentials);

    logger.debug("[Bitget Trading] Fetching wallet balance from API");

    // Get account info for USDT-FUTURES
    const accountInfo = await client.getFuturesAccountAsset({
      symbol: "BTCUSDT", // Use a default symbol to get account info
      productType: "USDT-FUTURES",
      marginCoin: "USDT",
    });

    logger.info("[Bitget Trading] Wallet balance retrieved successfully", {
      accountInfo: accountInfo.data,
    });

    return {
      success: true,
      data: accountInfo.data,
    };
  } catch (error: unknown) {
    logger.error("[Bitget Trading] Failed to get wallet balance", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: "Failed to get wallet balance",
      details: (error as Error).message || (error as string),
    };
  }
}
