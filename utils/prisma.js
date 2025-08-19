// Singleton pattern for PrismaClient to avoid multiple instances
import { PrismaClient } from "../generated/prisma/client.js";

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
      // Check for connection-related error messages
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

      const errorMessage = error.message?.toLowerCase() || "";
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

    // Check for general connection/network terms in error message
    const generalConnectionErrors = [
      "connection",
      "timeout",
      "network",
      "refused",
      "unreachable",
      "reset",
    ];

    const hasConnectionKeyword = generalConnectionErrors.some((keyword) =>
      error.message?.toLowerCase().includes(keyword)
    );

    if (hasConnectionKeyword) {
      console.debug(`Connection-related error detected in message, will retry`);
      return true;
    }

    console.debug(`Error is not retryable: ${error.constructor.name}`);
    return false;
  },
};

// Sleep utility function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calculate delay with exponential backoff and jitter
const calculateDelay = (attempt, config) => {
  const exponentialDelay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return exponentialDelay + jitter;
};

// Retry wrapper function
const withRetry = async (operation, config = DB_RETRY_CONFIG) => {
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // If this is the last attempt or error is not retryable, throw
      if (attempt === config.maxRetries || !config.retryCondition(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, config);
      console.warn(
        `Database operation failed (attempt ${attempt + 1}/${
          config.maxRetries + 1
        }): ${error.message}. ` + `Retrying in ${Math.round(delay)}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
};

// Create a single PrismaClient instance and export it
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  errorFormat: "minimal",
  transactionOptions: {
    timeout: 10000, // 10 seconds
    maxWait: 5000, // 5 seconds
    isolationLevel: "ReadCommitted",
  },
});

// Test database connection with retry
const testDatabaseConnection = async () => {
  return withRetry(async () => {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connection established successfully");
  });
};

// Initialize database connection with retry
const initializeDatabase = async (options = {}) => {
  const { allowDegradedStart = false } = options;

  try {
    console.log("🔄 Initializing database connection...");
    await testDatabaseConnection();
    return { success: true, degraded: false };
  } catch (error) {
    console.error(
      "❌ Failed to establish database connection after all retries:",
      error.message
    );

    if (allowDegradedStart) {
      console.warn(
        "⚠️  Starting server in degraded mode - database operations will fail until connection is restored"
      );
      return { success: false, degraded: true, error };
    }

    throw error;
  }
};

// Enhanced Prisma client with retry capabilities
const enhancedPrisma = new Proxy(prisma, {
  get(target, prop) {
    const original = target[prop];

    // Wrap database operations with retry logic
    if (typeof original === "function" && prop.startsWith("$")) {
      return async (...args) => {
        return withRetry(() => original.apply(target, args));
      };
    }

    // For model operations, wrap the model proxy
    if (typeof original === "object" && original !== null) {
      return new Proxy(original, {
        get(modelTarget, modelProp) {
          const modelMethod = modelTarget[modelProp];

          if (typeof modelMethod === "function") {
            return async (...args) => {
              return withRetry(() => modelMethod.apply(modelTarget, args));
            };
          }

          return modelMethod;
        },
      });
    }

    return original;
  },
});

const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, disconnecting from database...`);
  try {
    await enhancedPrisma.$disconnect();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Error disconnecting from database:", error);
  }
};

if (!process.listenerCount("SIGTERM")) {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}
if (!process.listenerCount("SIGINT")) {
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// Export the enhanced prisma client and utility functions
export default enhancedPrisma;
export { initializeDatabase, testDatabaseConnection, withRetry };
