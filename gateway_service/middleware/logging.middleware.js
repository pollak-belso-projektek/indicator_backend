/**
 * Request logging middleware for the gateway
 */

export function requestLoggingMiddleware(req, res, next) {
  const start = Date.now();
  const requestId = generateRequestId();

  // Add request ID to headers
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  // Log request
  console.log(`🔍 [${requestId}] ${req.method} ${req.originalUrl} - Start`);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusEmoji = getStatusEmoji(statusCode);

    console.log(
      `${statusEmoji} [${requestId}] ${req.method} ${req.originalUrl} - ${statusCode} (${duration}ms)`
    );

    originalEnd.apply(this, args);
  };

  next();
}

function generateRequestId() {
  return Math.random().toString(36).substr(2, 9);
}

function getStatusEmoji(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return "✅";
  if (statusCode >= 300 && statusCode < 400) return "↩️";
  if (statusCode >= 400 && statusCode < 500) return "⚠️";
  if (statusCode >= 500) return "❌";
  return "📍";
}
