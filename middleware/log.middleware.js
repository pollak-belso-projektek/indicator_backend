import { logRequest } from "../services/log.service.js";
import { getUserFromToken } from "../utils/tokenClient.js";
import process from "node:process";

// Simple user cache with max size to avoid memory leaks
const userCache = new Map();
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_USER_CACHE_SIZE = 1000;

// Periodic cleanup for userCache (every 10 minutes)
const userCacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache.entries()) {
    if (entry.expiry < now) {
      userCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
if (userCacheCleanupTimer.unref) {
  userCacheCleanupTimer.unref();
}

// List of sensitive fields to redact in request bodies
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "credential",
];

/**
 * Build a consistent log entry object
 */
function buildLogEntry(req, res, { userId, duration, level, correlationId }) {
  return {
    userId: userId || null,
    method: req.method,
    path: req.originalUrl.split("?")[0],
    statusCode: res.statusCode,
    body: sanitizeRequestBody(req.body),
    query: req.query,
    headers: sanitizeHeaders(req.headers),
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
    duration,
    level,
    correlationId,
  };
}

/**
 * Cache a user token mapping, enforcing max size
 */
function cacheUser(token, userId) {
  // Evict oldest entries if at capacity
  if (userCache.size >= MAX_USER_CACHE_SIZE) {
    const firstKey = userCache.keys().next().value;
    userCache.delete(firstKey);
  }
  userCache.set(token, {
    id: userId,
    expiry: Date.now() + USER_CACHE_TTL,
  });
}

// Paths excluded from request logging (e.g. health probes)
const IGNORED_PATH_PREFIXES = ["/health", "/api/v1/health"];

/**
 * Middleware for logging HTTP requests
 */
export function logMiddleware(req, res, next) {
  const requestPath = (req.originalUrl || req.url || "").split("?")[0];
  if (
    req.method === "OPTIONS" ||
    IGNORED_PATH_PREFIXES.some(
      (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
    )
  ) {
    return next();
  }

  // Record start time for calculating request duration
  const startTime = process.hrtime();

  // Generate a correlation ID for request tracking
  const correlationId = generateCorrelationId();
  req.correlationId = correlationId;

  // Monkey patch response.end to capture status code
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Calculate request duration in milliseconds
    const hrTime = process.hrtime(startTime);
    const duration = Math.round(hrTime[0] * 1000 + hrTime[1] / 1000000);

    // Determine log level based on response status
    let level = "INFO";
    if (res.statusCode >= 500) level = "ERROR";
    else if (res.statusCode >= 400) level = "WARN";

    const baseContext = { duration, level, correlationId };

    // 1. Check if user is already attached to request (fastest path)
    if (req.user && req.user.id) {
      logRequest(buildLogEntry(req, res, { ...baseContext, userId: req.user.id }));
      return;
    }

    // 2. Use access token to find user
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const cachedUser = userCache.get(token);
      if (cachedUser && cachedUser.expiry > Date.now()) {
        logRequest(buildLogEntry(req, res, { ...baseContext, userId: cachedUser.id }));
      } else {
        // Fetch user asynchronously without blocking
        getUserFromToken(token)
          .then((user) => {
            if (user) {
              cacheUser(token, user.id);
            }
            logRequest(buildLogEntry(req, res, { ...baseContext, userId: user?.id }));
          })
          .catch((err) => {
            console.error("Error getting user from token for logging:", err);
            logRequest(buildLogEntry(req, res, { ...baseContext, level: "ERROR" }));
          });
      }
    } else {
      // No token - log without user ID
      logRequest(buildLogEntry(req, res, baseContext));
    }
  };

  // Continue processing the request without blocking
  next();
}

/**
 * Generate a correlation ID for request tracking
 * @returns {string} A unique correlation ID
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Sanitize request headers to remove sensitive information
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
  if (!headers) return {};

  const sanitized = { ...headers };

  // Remove sensitive headers
  if (sanitized.authorization) sanitized.authorization = "***REDACTED***";
  if (sanitized.cookie) sanitized.cookie = "***REDACTED***";

  return sanitized;
}

/**
 * Sanitize request body to remove sensitive fields
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
function sanitizeRequestBody(body) {
  if (!body) return null;

  // If body is not an object, return as is
  if (typeof body !== "object") return body;

  // Create a deep copy to avoid modifying the original and handle BigInts
  const sanitizedBody = JSON.parse(
    JSON.stringify(body, (key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );

  // Recursive function to redact sensitive fields
  function redactSensitiveFields(obj) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      // Check if current key is sensitive
      if (
        SENSITIVE_FIELDS.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        )
      ) {
        obj[key] = "***REDACTED***";
      }
      // If value is an object or array, recursively check its properties
      else if (typeof obj[key] === "object" && obj[key] !== null) {
        redactSensitiveFields(obj[key]);
      }
    }
  }

  redactSensitiveFields(sanitizedBody);
  return sanitizedBody;
}

export default logMiddleware;
