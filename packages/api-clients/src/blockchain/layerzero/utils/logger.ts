import { getLogger, Logger } from "@dex-ai/core";

/**
 * Logger instance specifically configured for LayerZero integration.
 * Automatically includes the 'component: layerzero' metadata in all log entries.
 * Consumers within the LayerZero module should import this instance directly.
 *
 * Example:
 * import logger from './utils/logger';
 * logger.info('[OFT Detection] Starting contract analysis...');
 */
const logger: Logger = getLogger("layerzero");

export default logger;
