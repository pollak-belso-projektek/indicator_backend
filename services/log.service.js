import prisma from "../utils/prisma.js";
import * as cache from "../utils/cache.js";

// Cache TTLs
const CACHE_TTL = {
  LIST: 30 * 1000, // 30 seconds for log lists (shorter TTL since logs update frequently)
  DETAIL: 60 * 1000, // 1 minute for log details
  STATS: 5 * 60 * 1000, // 5 minutes for statistics
};

// Queue to batch log requests
const logQueue = [];
const MAX_QUEUE_SIZE = 10;
const MAX_QUEUE_AGE_MS = 5000; // 5 seconds
let queueTimer = null;
let queueRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Process logs in batch rather than one at a time
async function processLogQueue() {
  if (logQueue.length === 0) return;

  const logsToProcess = [...logQueue];
  logQueue.length = 0; // Clear queue

  try {
    // Use createMany for batch insertion

    await prisma.log.createMany({
      data: logsToProcess,
      skipDuplicates: true,
    });

    // Only invalidate specific cache keys related to logs, not all of them
    await cache.delByPattern("logs:list:*");
    await cache.delByPattern("logs:stats:*");

    // Reset retry counter on success
    queueRetryCount = 0;
  } catch (error) {
    console.error("Error batch processing logs:", error);

    // Implement retry logic for failed batch inserts
    if (queueRetryCount < MAX_RETRY_ATTEMPTS) {
      queueRetryCount++;
      console.log(`Retrying batch log processing (attempt ${queueRetryCount})`);

      // Put the logs back in the queue and retry after a delay
      logQueue.push(...logsToProcess);

      setTimeout(() => {
        processLogQueue();
      }, 1000 * queueRetryCount); // Progressive backoff
    } else {
      console.error(
        `Failed to process logs after ${MAX_RETRY_ATTEMPTS} attempts`
      );
      // Could implement fallback logging here (e.g., to file system)
      queueRetryCount = 0;
    }
  }
}

/**
 * Log a request with detailed information
 * @param {Object} logData - Data to log
 * @returns {Promise<void>}
 */
export async function logRequest(logData) {
  // Generate a correlation ID if not provided
  if (!logData.correlationId) {
    logData.correlationId = generateCorrelationId();
  }

  // Set default level if not provided
  if (!logData.level) {
    logData.level = determineLogLevel(logData);
  }

  // Add to queue instead of immediate database write
  logQueue.push(logData);

  // If queue gets big enough, process immediately
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    processLogQueue();
  }
  // Otherwise set a timer to process if one isn't already set
  else if (!queueTimer) {
    queueTimer = setTimeout(() => {
      processLogQueue();
      queueTimer = null;
    }, MAX_QUEUE_AGE_MS);
  }

  // This is now non-blocking - immediately return
  return;
}

/**
 * Generate a correlation ID for request tracking
 * @returns {string} A unique correlation ID
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Determine the appropriate log level based on request data
 * @param {Object} logData - The request log data
 * @returns {string} The determined log level
 */
function determineLogLevel(logData) {
  // Determine log level based on status code if available
  if (logData.statusCode) {
    if (logData.statusCode >= 500) return "ERROR";
    if (logData.statusCode >= 400) return "WARN";
  }
  return "INFO";
}

/**
 * Get logs with pagination and filtering
 * @param {Object} options - Query options
 * @returns {Promise<{logs: Array, total: number}>} Logs and total count
 */
export async function getLogsWithPagination(options = {}) {
  const {
    skip = 0,
    take = 50,
    userId,
    level,
    path,
    method,
    dateRange = {},
  } = options;

  // Build a cache key based on the filter parameters
  const filterParams = JSON.stringify({
    skip,
    take,
    userId,
    level,
    path,
    method,
    dateRange,
  });
  const cacheKey = `logs:list:${filterParams}`;

  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Build the where clause based on filters
  const where = {};

  if (userId) where.userId = userId;
  if (level) where.level = level;
  if (path) where.path = { contains: path };
  if (method) where.method = method;

  // Add date range filter if provided
  if (dateRange.start || dateRange.end) {
    where.createdAt = {};

    if (dateRange.start) {
      where.createdAt.gte = dateRange.start;
    }

    if (dateRange.end) {
      where.createdAt.lte = dateRange.end;
    }
  }

  // Execute query with count to get total
  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.log.count({ where }),
  ]);

  const result = { logs, total };

  // Store in cache
  await cache.set(cacheKey, result, CACHE_TTL.LIST);

  return result;
}

/**
 * Get a specific log entry by ID
 * @param {string} id - The log ID
 * @returns {Promise<Object|null>} The log entry or null if not found
 */
export async function getLogById(id) {
  const cacheKey = `logs:detail:${id}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.log.findUnique({
    where: {
      id,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (data) {
    // Store in cache
    await cache.set(cacheKey, data, CACHE_TTL.DETAIL);
  }

  return data;
}

/**
 * Get logs for a specific user by user ID
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} The user's logs
 */
export async function getLogsByUserId(userId) {
  return getLogsWithPagination({
    userId,
    take: 100,
  }).then((result) => result.logs);
}

/**
 * Clear logs older than the specified date
 * @param {Date} cutoffDate - Delete logs older than this date
 * @param {string} [level] - Only clear logs at this level (optional)
 * @returns {Promise<number>} Number of deleted logs
 */
export async function clearOldLogs(cutoffDate, level) {
  const where = {
    createdAt: {
      lt: cutoffDate,
    },
  };

  if (level) {
    where.level = level;
  }

  const result = await prisma.log.deleteMany({
    where,
  });

  // Invalidate relevant caches
  await cache.delByPattern("logs:*");

  return result.count;
}

/**
 * Get log statistics
 * @param {Date} since - Only include logs since this date
 * @returns {Promise<Object>} Log statistics
 */
export async function getLogStats(since) {
  const cacheKey = `logs:stats:${since.getTime()}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  // Base where clause for all queries
  const where = {
    createdAt: {
      gte: since,
    },
  };

  // Execute all statistic queries in parallel for better performance
  const [totalLogs, logsByLevel, errorLogs, topPaths, topMethods] =
    await Promise.all([
      // Get total log count
      prisma.log.count({
        where,
      }),

      // Get counts grouped by log level
      prisma.log.groupBy({
        by: ["level"],
        where,
        _count: true,
      }),

      // Get recent error logs
      prisma.log.findMany({
        where: {
          ...where,
          level: "ERROR",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          path: true,
          method: true,
          statusCode: true,
          createdAt: true,
        },
      }),

      // Get top 10 most accessed paths
      prisma.$queryRaw`
      SELECT path, COUNT(*) as count 
      FROM logs 
      WHERE "createdAt" >= ${since}
      GROUP BY path 
      ORDER BY count DESC 
      LIMIT 10
    `,

      // Get counts by HTTP method
      prisma.log.groupBy({
        by: ["method"],
        where,
        _count: true,
      }),
    ]);

  // Process and format the log level counts
  const logsByLevelFormatted = {};
  for (const item of logsByLevel) {
    logsByLevelFormatted[item.level] = item._count;
  }

  // Process and format the HTTP method counts
  const methodCounts = {};
  for (const item of topMethods) {
    methodCounts[item.method] = item._count;
  }

  const stats = {
    totalLogs,
    logsByLevel: logsByLevelFormatted,
    recentErrors: errorLogs,
    topPaths,
    methodCounts,
  };

  // Store in cache
  await cache.set(cacheKey, stats, CACHE_TTL.STATS);

  return stats;
}
