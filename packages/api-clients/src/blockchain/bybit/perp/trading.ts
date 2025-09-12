import { RestClientV5 } from "bybit-api";
import logger from "../../../common/logger";

// Bybit API response types based on actual usage
interface BybitOrderResult {
  orderId?: string;
  orderLinkId?: string;
  [key: string]: unknown;
}

interface BybitPosition {
  symbol: string;
  side: string;
  size: string;
  positionValue?: string;
  unrealisedPnl?: string;
  entryPrice?: string;
  markPrice?: string;
  liqPrice?: string;
  leverage?: string;
  margin?: string;
  [key: string]: unknown;
}

interface BybitWalletBalance {
  coin: string;
  equity: string;
  usdValue?: string;
  [key: string]: unknown;
}

export interface BybitCredentials {
  apiKey: string;
  apiSecret: string;
  useTestnet?: boolean;
}

export interface OpenShortParams {
  symbol: string;
  amount: string;
  credentials: BybitCredentials;
}

export interface OpenPositionParams {
  symbol: string;
  amount: string;
  side: "Buy" | "Sell";
  credentials: BybitCredentials;
}

export interface ClosePositionParams {
  symbol: string;
  credentials: BybitCredentials;
}

export interface GetPositionsParams {
  symbol?: string;
  credentials: BybitCredentials;
}

export interface TradeResult {
  success: boolean;
  data?: {
    order?: BybitOrderResult;
    message?: string;
    side?: string;
    positionType?: string;
    positionClosed?: {
      symbol: string;
      side: string;
      size: string;
      closeSide?: string;
    };
    positions?: BybitPosition[];
    allPositions?: BybitPosition[];
    balance?: BybitWalletBalance[];
    [key: string]: unknown;
  };
  error?: string;
  details?: string;
}

export interface PositionInfo {
  symbol: string;
  side: string;
  size: string;
  positionValue?: string;
  unrealisedPnl?: string;
  // Additional properties that may be returned by the API
  entryPrice?: string;
  markPrice?: string;
  liqPrice?: string;
  leverage?: string;
  margin?: string;
  [key: string]: unknown; // Allow any additional properties from the API
}

export interface PositionsResult {
  success: boolean;
  positions?: BybitPosition[];
  allPositions?: BybitPosition[];
  error?: string;
  details?: string;
}

/**
 * Create Bybit client instance
 */
function createBybitClient(credentials: BybitCredentials): RestClientV5 {
  logger.debug("[Bybit Trading] Creating client instance", {
    useTestnet: credentials.useTestnet ?? true,
    hasApiKey: !!credentials.apiKey,
  });

  return new RestClientV5({
    key: credentials.apiKey,
    secret: credentials.apiSecret,
    demoTrading: credentials.useTestnet ?? true, // Default to use testnet
  });
}

/**
 * Set leverage
 */
async function setLeverage(
  client: RestClientV5,
  symbol: string,
  leverage: string = "1",
): Promise<void> {
  try {
    logger.debug("[Bybit Trading] Setting leverage", { symbol, leverage });

    await client.setLeverage({
      category: "linear",
      symbol: symbol,
      buyLeverage: leverage,
      sellLeverage: leverage,
    });

    logger.info("[Bybit Trading] Leverage set successfully", {
      symbol,
      leverage,
    });
  } catch (error) {
    // Leverage setting failed should not prevent trading, may already be set
    logger.warn(
      "[Bybit Trading] Leverage setting failed (might already be set)",
      {
        symbol,
        leverage,
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
  const { symbol, amount, side, credentials } = params;

  logger.info("[Bybit Trading] Opening position", { symbol, amount, side });

  try {
    if (
      !symbol ||
      !amount ||
      !side ||
      !credentials.apiKey ||
      !credentials.apiSecret
    ) {
      logger.error(
        "[Bybit Trading] Missing required parameters for opening position",
        {
          hasSymbol: !!symbol,
          hasAmount: !!amount,
          hasSide: !!side,
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
        },
      );

      return {
        success: false,
        error:
          "Missing required parameters: symbol, amount, side, apiKey, apiSecret",
      };
    }

    const client = createBybitClient(credentials);

    // First set leverage to 1x
    await setLeverage(client, symbol, "1");

    const positionType = side === "Buy" ? "long" : "short";
    const orderLinkId = `${positionType}-${symbol}-${Date.now()}`;

    logger.debug("[Bybit Trading] Submitting order", {
      symbol,
      amount,
      side,
      orderType: "Market",
      positionType,
    });

    // Open position
    const order = await client.submitOrder({
      category: "linear",
      symbol: symbol,
      side,
      orderType: "Market", // Market order
      qty: amount.toString(),
      positionIdx: 0, // Single-sided position mode
      orderLinkId: orderLinkId,
      reduceOnly: false, // Open position
    });

    logger.info("[Bybit Trading] Position opened successfully", {
      symbol,
      amount,
      side,
      positionType,
      retCode: order.retCode,
      retMsg: order.retMsg,
      result: order.result,
      orderId: order.result?.orderId,
      orderLinkId: order.result?.orderLinkId,
    });

    if (order.retCode !== 0) {
      logger.error("[Bybit Trading] Failed to open position", {
        symbol,
        amount,
        side,
        positionType,
        error: order.retMsg,
      });
      return {
        success: false,
        error: `Failed to open ${positionType} position`,
        details: order.retMsg,
      };
    }

    return {
      success: true,
      data: {
        order: order.result as BybitOrderResult,
        message: `Successfully opened ${positionType} position for ${symbol}`,
        side,
        positionType,
      },
    };
  } catch (error: unknown) {
    logger.error("[Bybit Trading] Failed to open position", {
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
 * Close position
 */
export async function closePosition(
  params: ClosePositionParams,
): Promise<TradeResult> {
  const { symbol, credentials } = params;

  logger.info("[Bybit Trading] Closing position", { symbol });

  try {
    if (!symbol || !credentials.apiKey || !credentials.apiSecret) {
      logger.error(
        "[Bybit Trading] Missing required parameters for closing position",
        {
          hasSymbol: !!symbol,
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
        },
      );

      return {
        success: false,
        error: "Missing required parameters: symbol, apiKey, apiSecret",
      };
    }

    const client = createBybitClient(credentials);

    logger.debug("[Bybit Trading] Getting current position info", { symbol });

    // Get current position info
    const positions = await client.getPositionInfo({
      category: "linear",
      symbol: symbol,
    });

    const position = positions.result.list?.find(
      (p) => p.symbol === symbol && p.size !== "0",
    );

    if (!position || position.size === "0") {
      logger.warn("[Bybit Trading] No open position found for closing", {
        symbol,
      });

      return {
        success: false,
        error: `No open position found for ${symbol}`,
      };
    }

    // Determine close side: if it's a short position (side=Sell), close needs to be buy
    const closeSide = position.side === "Sell" ? "Buy" : "Sell";
    const qty = position.size;

    logger.debug("[Bybit Trading] Submitting close order", {
      symbol,
      currentSide: position.side,
      closeSide,
      qty,
    });

    // Execute close position
    const order = await client.submitOrder({
      category: "linear",
      symbol: symbol,
      side: closeSide,
      orderType: "Market",
      qty: qty,
      positionIdx: 0,
      reduceOnly: true, // Reduce only, no new position
      orderLinkId: `close-${symbol}-${Date.now()}`,
    });

    if (order.retCode !== 0) {
      logger.error("[Bybit Trading] Failed to close position", {
        symbol,
        error: order.retMsg,
      });
      return {
        success: false,
        error: "Failed to close position",
        details: order.retMsg,
      };
    }

    logger.info("[Bybit Trading] Position closed successfully", {
      symbol,
      originalSide: position.side,
      closeSide,
      qty,
      orderId: order.result?.orderId,
      orderLinkId: order.result?.orderLinkId,
    });

    return {
      success: true,
      data: {
        order: order.result as BybitOrderResult,
        positionClosed: {
          symbol: symbol,
          side: position.side,
          size: qty,
          closeSide: closeSide,
        },
        message: `Successfully closed ${position.side.toLowerCase()} position for ${symbol}`,
      },
    };
  } catch (error: unknown) {
    logger.error("[Bybit Trading] Failed to close position", {
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

  logger.info("[Bybit Trading] Getting positions", { symbol: symbol || "all" });

  try {
    if (!credentials.apiKey || !credentials.apiSecret) {
      logger.error(
        "[Bybit Trading] Missing required credentials for getting positions",
        {
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
        },
      );

      return {
        success: false,
        error: "Missing required parameters: apiKey, apiSecret",
      };
    }

    const client = createBybitClient(credentials);

    logger.debug("[Bybit Trading] Fetching position info from API", { symbol });

    // Get position info
    const positions = await client.getPositionInfo({
      category: "linear",
      symbol: symbol, // If symbol is provided, only get specific position, otherwise get all positions
    });

    // Filter out positions with non-zero size
    const activePositions = positions.result.list.filter((p) => p.size !== "0");

    logger.info("[Bybit Trading] Positions retrieved successfully", {
      symbol: symbol || "all",
      totalPositions: positions.result.list.length,
      activePositions: activePositions.length,
    });

    return {
      success: true,
      positions: activePositions as unknown as BybitPosition[],
      allPositions: positions.result.list as unknown as BybitPosition[], // Also return all positions info for future use
    };
  } catch (error: unknown) {
    logger.error("[Bybit Trading] Failed to get positions", {
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
  credentials: BybitCredentials,
): Promise<TradeResult> {
  logger.info("[Bybit Trading] Getting wallet balance");

  try {
    if (!credentials.apiKey || !credentials.apiSecret) {
      logger.error(
        "[Bybit Trading] Missing required credentials for getting wallet balance",
        {
          hasApiKey: !!credentials.apiKey,
          hasApiSecret: !!credentials.apiSecret,
        },
      );

      return {
        success: false,
        error: "Missing required parameters: apiKey, apiSecret",
      };
    }

    const client = createBybitClient(credentials);

    logger.debug("[Bybit Trading] Fetching wallet balance from API");

    const balance = await client.getWalletBalance({
      accountType: "UNIFIED", // Unified account
    });

    logger.info("[Bybit Trading] Wallet balance retrieved successfully", {
      accountCount: balance.result.list.length,
    });

    return {
      success: true,
      data: {
        balance: balance.result.list as unknown as BybitWalletBalance[],
      },
    };
  } catch (error: unknown) {
    logger.error("[Bybit Trading] Failed to get wallet balance", {
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
