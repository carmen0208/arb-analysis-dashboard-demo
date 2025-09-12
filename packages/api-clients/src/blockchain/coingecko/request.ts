/**
 * API Request Helper for CoinGecko Client
 */
import { AxiosInstance, AxiosResponse } from "axios"; // Added AxiosInstance import
import { withRetry } from "@dex-ai/core";
import logger from "../../common/logger";
import type { ApiRequestParams, ApiErrorContext } from "../../common/types";

/**
 * Make a request to CoinGecko API with retries
 */
export async function makeApiRequest<T>(
  client: AxiosInstance, // Added client parameter
  endpoint: string,
  params: ApiRequestParams = {},
  errorContext: ApiErrorContext = {},
): Promise<AxiosResponse<T>> {
  const requestContext = {
    endpoint,
    ...params,
    ...errorContext,
  };

  try {
    logger.debug("[Request] Making API request", { endpoint, params });
    return await withRetry(() => client.get<T>(endpoint, { params }), {
      maxRetries: 3,
      retryDelay: 1500,
      onError: (error: unknown, attempt: number) => {
        logger.warn("[Request] Request attempt failed", {
          attempt: attempt + 1,
          endpoint,
          ...errorContext,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      },
    });
  } catch (error) {
    logger.error("[Request] Request failed after retries", {
      ...requestContext,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to allow caller to handle
  }
}
