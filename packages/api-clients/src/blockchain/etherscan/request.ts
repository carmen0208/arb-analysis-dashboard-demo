/**
 * API Request Helper for Etherscan Client
 */
import { AxiosInstance, AxiosResponse } from "axios";
import { withRetry } from "@dex-ai/core";
import { getLogger, Logger } from "@dex-ai/core";
import {
  TokenTransactionParams,
  BlockParams,
  EtherscanResponse,
  EtherscanError,
} from "./types";

const logger: Logger = getLogger("etherscan-request");

/**
 * Make a request to Etherscan API with retries
 */
export async function makeApiRequest<T>(
  client: AxiosInstance,
  params: TokenTransactionParams | BlockParams,
  errorContext: Record<string, any> = {},
): Promise<AxiosResponse<EtherscanResponse<T>>> {
  const requestContext = {
    ...params,
    ...errorContext,
  };

  try {
    logger.debug("[Etherscan Request] Making API request", {
      chainid: params.chainid,
      module: params.module,
      action: params.action,
      ...("address" in params && { address: params.address }),
      ...("startblock" in params && { startblock: params.startblock }),
      ...("endblock" in params && { endblock: params.endblock }),
      ...("timestamp" in params && { timestamp: params.timestamp }),
      ...("closest" in params && { closest: params.closest }),
    });

    return await withRetry(
      () => client.get<EtherscanResponse<T>>("", { params }),
      {
        maxRetries: 3,
        retryDelay: 2000, // Longer delay for blockchain APIs
        onError: (error: unknown, attempt: number) => {
          logger.warn("[Etherscan Request] Request attempt failed", {
            attempt: attempt + 1,
            chainid: params.chainid,
            ...errorContext,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        },
      },
    );
  } catch (error) {
    logger.error("[Etherscan Request] Request failed after retries", {
      ...requestContext,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Check if response is an error response
 */
export function isErrorResponse<T>(
  response: EtherscanResponse<T> | EtherscanError,
): response is EtherscanError {
  return response.status === "0" && response.message === "NOTOK";
}

/**
 * Handle Etherscan API response and extract result
 */
export function handleApiResponse<T>(
  response: EtherscanResponse<T> | EtherscanError,
): T {
  if (isErrorResponse(response)) {
    throw new Error(`Etherscan API Error: ${response.result}`);
  }

  if (response.status !== "1") {
    throw new Error(`Etherscan API Error: ${response.message}`);
  }

  return response.result;
}
