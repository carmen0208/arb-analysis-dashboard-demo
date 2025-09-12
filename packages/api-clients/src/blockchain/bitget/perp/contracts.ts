import { FuturesContractConfigV2, RestClientV2 } from "bitget-api";
import { getLogger, Logger } from "@dex-ai/core";

const logger: Logger = getLogger("bitget-perp-contracts");

/**
 * Bitget Contract Information
 * Based on the API response from: https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES
 */
export type BitgetContract = FuturesContractConfigV2;

/**
 * Bitget Contracts API Response
 */
export interface BitgetContractsResponse {
  code: string;
  msg: string;
  requestTime: number;
  data: BitgetContract[];
}

/**
 * Fetch all USDT-FUTURES contracts from Bitget
 * @returns Promise<BitgetContract[]> Array of contract information
 */
export async function fetchAllContracts(): Promise<BitgetContract[]> {
  try {
    const client = new RestClientV2();

    logger.info("[Bitget Contracts] Fetching all USDT-FUTURES contracts");

    const response = await client.getFuturesContractConfig({
      productType: "USDT-FUTURES",
    });

    logger.info("[Bitget Contracts] Successfully fetched contracts", {
      count: response.data.length,
    });

    return response.data;
  } catch (error) {
    logger.error("[Bitget Contracts] Error fetching contracts", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get contract information by symbol
 * @param symbol - The trading symbol (e.g., "BTCUSDT")
 * @param contracts - Array of contracts to search in (optional, will fetch if not provided)
 * @returns Promise<BitgetContract | undefined> Contract information or undefined if not found
 */
export async function getContractBySymbol(
  symbol: string,
  contracts?: BitgetContract[],
): Promise<BitgetContract | undefined> {
  try {
    const allContracts = contracts || (await fetchAllContracts());
    const contract = allContracts.find(
      (c) => c.symbol === symbol.toUpperCase(),
    );

    if (contract) {
      logger.info("[Bitget Contracts] Found contract", { symbol });
    } else {
      logger.warn("[Bitget Contracts] Contract not found", { symbol });
    }

    return contract;
  } catch (error) {
    logger.error("[Bitget Contracts] Error getting contract by symbol", {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get contracts by base coin
 * @param baseCoin - The base coin symbol (e.g., "BTC")
 * @param contracts - Array of contracts to search in (optional, will fetch if not provided)
 * @returns Promise<BitgetContract[]> Array of contracts for the base coin
 */
export async function getContractsByBaseCoin(
  baseCoin: string,
  contracts?: BitgetContract[],
): Promise<BitgetContract[]> {
  try {
    const allContracts = contracts || (await fetchAllContracts());
    const filteredContracts = allContracts.filter(
      (c) => c.baseCoin.toUpperCase() === baseCoin.toUpperCase(),
    );

    logger.info("[Bitget Contracts] Found contracts by base coin", {
      baseCoin,
      count: filteredContracts.length,
    });

    return filteredContracts;
  } catch (error) {
    logger.error("[Bitget Contracts] Error getting contracts by base coin", {
      baseCoin,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get active contracts (symbolStatus === "normal")
 * @param contracts - Array of contracts to filter (optional, will fetch if not provided)
 * @returns Promise<BitgetContract[]> Array of active contracts
 */
export async function getActiveContracts(
  contracts?: BitgetContract[],
): Promise<BitgetContract[]> {
  try {
    const allContracts = contracts || (await fetchAllContracts());
    const activeContracts = allContracts.filter(
      (c) => c.symbolStatus === "normal",
    );

    logger.info("[Bitget Contracts] Found active contracts", {
      total: allContracts.length,
      active: activeContracts.length,
    });

    return activeContracts;
  } catch (error) {
    logger.error("[Bitget Contracts] Error getting active contracts", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
