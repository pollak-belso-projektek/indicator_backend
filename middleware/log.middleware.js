import { logRequest } from "../services/log.service.js";
import { getUserFromToken } from "../utils/tokenClient.js";
import process from "node:process";

// Simple user cache to avoid repeated database lookups
const userCache = new Map();
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// List of sensitive fields to redact in request bodies
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "credential",
];

/**
 * Middleware for logging HTTP requests
 */
export function logMiddleware(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  // Record start time for calculating request duration
  const startTime = process.hrtime();

  // Generate a correlation ID for request tracking
  const correlationId = generateCorrelationId();
  req.correlationId = correlationId; // Attach to request for potential use in other middleware/routes

  // Monkey patch response.end to capture status code
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    // Calculate request duration in milliseconds
    const hrTime = process.hrtime(startTime);
    const duration = Math.round(hrTime[0] * 1000 + hrTime[1] / 1000000);

    // Determine log path from Referer (frontend path) or fallback to API path
    let logPath = req.originalUrl.split("?")[0];
    if (req.headers.referer) {
      try {
        const url = new URL(req.headers.referer);
        logPath = url.pathname;
      } catch (e) {
        // Ignore invalid URLs
      }
    }

    // Extract token if available
    const token = req.headers.authorization?.split(" ")[1];
    let userId = null;

    // Determine log level based on response status
    let level = "INFO";
    if (res.statusCode >= 500) level = "ERROR";
    else if (res.statusCode >= 400) level = "WARN";

    // 1. Check if user is already attached to request (fastest)
    if (req.user && req.user.id) {
      userId = req.user.id;

      logRequest({
        userId,
        method: req.method,
        path: logPath,
        statusCode: res.statusCode,
        body: sanitizeRequestBody(req.body),
        query: req.query,
        headers: sanitizeHeaders(req.headers),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        duration,
        level,
        correlationId,
      });
    }
    // 2. Use access token to find user
    else if (token) {
      const cachedUser = userCache.get(token);
      if (cachedUser && cachedUser.expiry > Date.now()) {
        userId = cachedUser.id;

        // Create the log entry with all data
        logRequest({
          userId: userId,
          method: req.method,
          path: logPath,
          statusCode: res.statusCode,
          body: sanitizeRequestBody(req.body),
          query: req.query,
          headers: sanitizeHeaders(req.headers),
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
          duration,
          level,
          correlationId,
        });
      } else {
        // User will be fetched asynchronously without blocking the request
        getUserFromToken(token)
          .then((user) => {
            if (user) {
              // Cache user ID for future requests
              userCache.set(token, {
                id: user.id,
                expiry: Date.now() + USER_CACHE_TTL,
              });

              // Create the log entry with user data
              logRequest({
                userId: user.id,
                method: req.method,
                path: logPath,
                statusCode: res.statusCode,
                body: sanitizeRequestBody(req.body),
                query: req.query,
                headers: sanitizeHeaders(req.headers),
                ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                userAgent: req.headers["user-agent"],
                duration,
                level,
                correlationId,
              });
            } else {
              // Log without user ID if user not found (but token was present)
              logRequest({
                method: req.method,
                path: logPath,
                statusCode: res.statusCode,
                body: sanitizeRequestBody(req.body),
                query: req.query,
                headers: sanitizeHeaders(req.headers),
                ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                userAgent: req.headers["user-agent"],
                duration,
                level,
                correlationId,
              });
            }
          })
          .catch((err) => {
            console.error("Error getting user from token for logging:", err);

            // Log anyway without user ID
            logRequest({
              method: req.method,
              path: logPath,
              statusCode: res.statusCode,
              body: sanitizeRequestBody(req.body),
              query: req.query,
              headers: sanitizeHeaders(req.headers),
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
              userAgent: req.headers["user-agent"],
              duration,
              level: "ERROR", // Elevate to error since token validation failed
              correlationId,
            });
          });
      }
    } else {
      // Log without user ID
      logRequest({
        method: req.method,
        path: logPath,
        statusCode: res.statusCode,
        body: sanitizeRequestBody(req.body),
        query: req.query,
        headers: sanitizeHeaders(req.headers),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        duration,
        level,
        correlationId,
      });
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

  // Create a deep copy to avoid modifying the original
  const sanitizedBody = JSON.parse(JSON.stringify(body));

  // Recursive function to redact sensitive fields
  function redactSensitiveFields(obj) {
    if (!obj || typeof obj !== "object") return;

    for (const key in obj) {
      // Check if current key is sensitive
      if (
        SENSITIVE_FIELDS.some((field) =>
          key.toLowerCase().includes(field.toLowerCase())
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
