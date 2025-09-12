import { withRetry } from "@dex-ai/core";
import { getLogger, Logger } from "@dex-ai/core";
import type { ApiRequestParams } from "../../common/types";
const logger: Logger = getLogger("blockchain-moralis");

/**
 * Makes a request using the Moralis SDK with retries and logging.
 * @param moralisFunction The Moralis SDK function to call (e.g., Moralis.EvmApi.token.getTopProfitableWalletPerToken)
 * @param params The parameters object for the Moralis function.
 * @param operationName A descriptive name for the operation for logging purposes.
 * @returns The result of the Moralis SDK function call.
 */
export async function makeMoralisRequest<P extends ApiRequestParams, R>(
  moralisFunction: (params: P) => Promise<R>,
  params: P,
  operationName: string,
): Promise<R> {
  const requestContext = {
    operation: operationName,
    ...params,
  };

  try {
    logger.debug(`[Moralis Request] Calling ${operationName}`, { params });
    const result = await withRetry(() => moralisFunction(params), {
      maxRetries: 3,
      retryDelay: 1500,
      onError: (error: unknown, attempt: number) => {
        logger.warn(
          `[Moralis Request] Attempt ${attempt + 1} failed for ${operationName}`,
          {
            ...requestContext,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      },
    });
    logger.debug(`[Moralis Request] ${operationName} successful`, { params });
    return result;
  } catch (error) {
    logger.error(`[Moralis Request] ${operationName} failed after retries`, {
      ...requestContext,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Re-throw to maintain original behavior where functions threw errors on failure
    throw new Error(
      `Moralis API call ${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
