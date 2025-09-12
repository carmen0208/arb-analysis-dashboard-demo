import { defaultLogger } from "./logger/index"; // Corrected import path and type name
import { createTokenRotator, TokenRotator } from "./tokenRotator";

/**
 * Sets up token rotation based on environment variables.
 *
 * @param envVarName The name of the environment variable containing comma-separated API keys.
 * @returns An object containing the TokenRotator instance and the count of API keys found.
 * @throws Error if the environment variable is not set or contains no valid keys.
 */
export function setupTokenRotatorFromEnv(envVarName: string): {
  tokenRotator: TokenRotator;
  apiKeyCount: number;
} {
  const logger = defaultLogger;
  const apiKeysEnv = process.env[envVarName];
  if (!apiKeysEnv) {
    const message = `${envVarName} environment variable not set. Rotation disabled.`;
    if (logger) {
      logger.warn(message);
    } else {
      console.warn(message);
    }
    // Depending on requirements, you might want to throw here or return a dummy rotator
    throw new Error(
      `${envVarName} environment variable is required for token rotation.`,
    );
  }

  const apiKeys = apiKeysEnv
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key);

  if (apiKeys.length === 0) {
    throw new Error(
      `No valid API keys found in ${envVarName}. Cannot initialize token rotation.`,
    );
  }

  if (logger) {
    logger.info(
      `Found ${apiKeys.length} API keys in ${envVarName} for rotation.`,
    );
  } else {
    console.log(
      `Found ${apiKeys.length} API keys in ${envVarName} for rotation.`,
    );
  }

  return {
    tokenRotator: createTokenRotator(apiKeys),
    apiKeyCount: apiKeys.length,
  };
}
