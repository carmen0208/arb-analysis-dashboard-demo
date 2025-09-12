declare const window: any;
import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

// Define severity levels (npm levels are default: error, warn, info, http, verbose, debug, silly)
const levels = winston.config.npm.levels;

// Determine log directory (adjust path as needed, maybe from config)
const logDirectory = process.env.LOG_DIR || path.resolve(process.cwd(), "logs"); // Default to project root 'logs' folder

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }), // Log stack traces
  winston.format.splat(),
  winston.format.json(), // Structured logging (JSON format)
);

// 判断是否为 Vercel/serverless 环境
const isServerless = !!process.env.VERCEL;
const isBrowser =
  typeof window !== "undefined" || process.env.BUILD_ENV === "browser";
// Create transports based on environment
const transports: winston.transport[] = [];

if (isBrowser) {
  transports.push(
    new winston.transports.Console({ format: winston.format.simple() }),
  );
} else if (isServerless) {
  // 只用 Console transport
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
      level: "info",
    }),
  );
} else if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test"
) {
  // Console transport for development
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colors for readability
        winston.format.simple(), // Simple format for console
      ),
      level: process.env.LOG_LEVEL || "debug", // Respect LOG_LEVEL environment variable
    }),
  );
} else if (process.env.BUILD_ENV === "monitoring") {
  // File transport with rotation for non-development environments
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logDirectory, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true, // Compress rotated files
      maxSize: "20m", // Rotate log file if it exceeds 20MB
      maxFiles: "14d", // Keep logs for 14 days
      level: "info", // Log info messages and above in production
      format: logFormat, // Use JSON format for files
    }),
  );

  // Optional: Add a separate file for errors
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logDirectory, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d", // Keep error logs longer
      level: "error", // Only log errors
      format: logFormat,
    }),
  );
} else {
  transports.push(
    new winston.transports.Console({ format: winston.format.simple() }),
  );
}

// Central logger container
const loggers = new Map<string, winston.Logger>();

/**
 * Clears the logger cache to force recreation of loggers
 * Useful when LOG_LEVEL environment variable changes
 */
export function clearLoggerCache(): void {
  loggers.clear();
}

/**
 * Creates or retrieves a logger instance for a specific component.
 * @param componentName - The name of the component (e.g., 'TradingEngine', 'DataFetcher').
 * @returns A Winston logger instance.
 */
export function getLogger(
  componentName: string = "application",
): winston.Logger {
  // Check if LOG_LEVEL has changed and clear cache if needed
  const currentLogLevel =
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "development" ? "debug" : "info");
  const cachedLogger = loggers.get(componentName);

  if (cachedLogger) {
    // If LOG_LEVEL changed, clear cache and recreate
    const cachedLevel = cachedLogger.level;
    if (cachedLevel !== currentLogLevel) {
      loggers.delete(componentName);
    } else {
      return cachedLogger;
    }
  }

  const newLogger = winston.createLogger({
    levels: levels,
    level: currentLogLevel, // Default level
    format: logFormat, // Default format (JSON for files)
    transports: transports,
    exitOnError: false, // Do not exit on handled exceptions
    defaultMeta: { component: componentName }, // Add component name to all logs
  });

  loggers.set(componentName, newLogger);
  return newLogger;
}

// Export a default logger instance
export const defaultLogger = getLogger();

// --- Audit Logging ---
// Separate configuration for audit logs

const auditLogDirectory =
  process.env.AUDIT_LOG_DIR || path.join(logDirectory, "audit");

const auditTransports: winston.transport[] = isBrowser
  ? [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ]
  : isServerless
    ? [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
          level: "info",
        }),
      ]
    : [
        new winston.transports.DailyRotateFile({
          filename: path.join(auditLogDirectory, "audit-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: "50m", // Potentially larger size for audit logs
          maxFiles: "90d", // Keep audit logs longer
          level: "info", // Audit logs are typically info level
          format: logFormat, // Use the same structured format
        }),
      ];

export const auditLogger = winston.createLogger({
  levels: { audit: 0 }, // Custom level for audit logs
  level: "audit",
  format: logFormat,
  transports: auditTransports,
  exitOnError: false,
  defaultMeta: { type: "audit" }, // Differentiate audit logs
});

// Helper function for audit logging
export function logAuditEvent(event: string, details: Record<string, unknown>) {
  auditLogger.log("audit", event, { details });
}

export type Logger = winston.Logger;

// Example Usage (can be removed later)
// logger.info('Application started');
// logger.warn('Configuration issue detected', { setting: 'apiKey' });
// logger.error('Failed to connect to database', new Error('Connection timeout'));
// getLogger('TradingEngine').debug('Initializing trading strategy');
// logAuditEvent('TradeExecuted', { symbol: 'BTC/USD', amount: 1.5, price: 50000, decisionId: 'xyz' });
