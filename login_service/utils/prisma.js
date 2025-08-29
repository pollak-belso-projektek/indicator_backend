// Singleton pattern for PrismaClient to avoid multiple instances
import { PrismaClient } from "@prisma/client";

// Configuration for database connection retry
const DB_RETRY_CONFIG = {
  maxRetries: parseInt(process.env.DB_RETRY_MAX_ATTEMPTS) || 5,
  initialDelay: parseInt(process.env.DB_RETRY_INITIAL_DELAY) || 1000, // 1 second
  maxDelay: parseInt(process.env.DB_RETRY_MAX_DELAY) || 30000, // 30 seconds
  backoffMultiplier: parseFloat(process.env.DB_RETRY_BACKOFF_MULTIPLIER) || 2,
  retryCondition: (error) => {
    // Log the error for debugging
    console.debug(
      `Checking if error is retryable: ${error.constructor.name}: ${error.message}`
    );

    // Retry on connection errors, timeouts, and network issues
    const retryableErrors = [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "ECONNRESET",
      "EPIPE",
      "P1001", // Prisma: Can't reach database server
      "P1008", // Prisma: Operations timed out
      "P1017", // Prisma: Server has closed the connection
    ];

    // Check for Prisma-specific errors
    if (
      error.constructor.name === "PrismaClientInitializationError" ||
      error.constructor.name === "PrismaClientKnownRequestError" ||
      error.constructor.name === "PrismaClientUnknownRequestError"
    ) {
      const errorMessage = error.message?.toLowerCase() || "";
      const connectionErrorMessages = [
        "can't reach database server",
        "connection refused",
        "connection timeout",
        "connection reset",
        "network error",
        "database server",
        "timeout",
        "connection",
        "refused",
        "unreachable",
      ];

      const isConnectionError = connectionErrorMessages.some((msg) =>
        errorMessage.includes(msg)
      );

      if (isConnectionError) {
        console.debug(
          `Prisma connection error detected, will retry: ${error.message}`
        );
        return true;
      }
    }

    // Check for standard error codes
    const hasRetryableCode = retryableErrors.some(
      (code) => error.code === code || error.message?.includes(code)
    );

    if (hasRetryableCode) {
      console.debug(
        `Retryable error code detected: ${error.code || "unknown"}`
      );
      return true;
    }

    console.debug(`Error is not retryable: ${error.constructor.name}`);
    return false;
  },
};

// Sleep utility function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calculate delay with exponential backoff and jitter
function calculateDelay(attempt, config) {
  const exponentialDelay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter (±25% of the delay)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, cappedDelay + jitter);
}

// Enhanced retry mechanism for database operations
async function withRetry(operation, config = DB_RETRY_CONFIG) {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = config.retryCondition(error);
      const isLastAttempt = attempt === config.maxRetries;

      if (!shouldRetry || isLastAttempt) {
        throw error;
      }

      const delay = calculateDelay(attempt, config);
      console.warn(
        `Database operation failed (attempt ${attempt}/${
          config.maxRetries
        }), retrying in ${Math.round(delay)}ms: ${error.message}`
      );
      await sleep(delay);
    }
  }
}

// Create a singleton instance
let prisma = null;

function getPrismaInstance() {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
      errorFormat: "pretty",
    });
  }
  return prisma;
}

// Initialize database connection with enhanced error handling and retry logic
export async function initializeDatabase(options = {}) {
  const { allowDegradedStart = false } = options;

  const operation = async () => {
    const prismaInstance = getPrismaInstance();

    // Test database connection with a simple query
    await prismaInstance.$queryRaw`SELECT 1 as test`;

    console.log("✅ Database connection established successfully");
    return { success: true, degraded: false };
  };

  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("❌ Failed to establish database connection:", error.message);

    if (allowDegradedStart) {
      console.warn(
        "⚠️  Starting in degraded mode - database operations will be retried on each request"
      );
      return { success: false, degraded: true, error: error.message };
    }

    throw error;
  }
}

// Enhanced database operation wrapper
export async function executeWithRetry(operation) {
  return withRetry(async () => {
    const prismaInstance = getPrismaInstance();
    return await operation(prismaInstance);
  });
}

// Export the singleton instance
const prismaInstance = getPrismaInstance();
export default prismaInstance;
