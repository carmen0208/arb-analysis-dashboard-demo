export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
  onError?: (error: unknown, attempt: number) => void;
}

const defaultShouldRetry = (error: unknown): boolean => {
  const retryableErrors = [
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "rate limit exceeded",
  ];
  return retryableErrors.some(
    (msg) =>
      error instanceof Error && error.message.toLowerCase().includes(msg),
  );
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = defaultShouldRetry,
    onError,
  } = options;
  const attempt = async (retryCount: number): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (
        retryCount < maxRetries &&
        (!shouldRetry || shouldRetry(error as Error))
      ) {
        onError?.(error as Error, retryCount);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return attempt(retryCount + 1);
      }
      throw error;
    }
  };
  return attempt(0);
};
