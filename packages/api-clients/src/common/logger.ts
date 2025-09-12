import { getLogger, Logger } from "@dex-ai/core"; // Assuming '@core' alias or adjust relative path

/**
 * Logger instance specifically configured for the DiscoveryAgent.
 * Automatically includes the 'component: DiscoveryAgent' metadata in all log entries.
 * Consumers within the DiscoveryAgent should import this instance directly.
 *
 * Example:
 * import logger from './tools/logger'; // Adjust path as needed
 * logger.info('Starting discovery process...');
 */
const logger: Logger = getLogger("api-client");

export default logger;
