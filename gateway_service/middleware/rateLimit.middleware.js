import rateLimit from "express-rate-limit";

// Default rate limiting configuration
const defaultConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: "Check the Retry-After header for when to retry.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(
      `🚫 Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`
    );
    res.status(429).json({
      error: "Too many requests",
      message: "You have exceeded the rate limit. Please try again later.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
};

// General rate limiter
export const generalRateLimit = rateLimit(defaultConfig);

// Strict rate limiter for auth endpoints
export const authRateLimit = rateLimit({
  ...defaultConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    error: "Too many authentication attempts",
    message: "Too many login attempts. Please try again later.",
  },
  skip: (req) => {
    // Skip rate limiting for refresh token requests (they're already limited by token validity)
    return req.path.includes("/refresh");
  },
});

// Lenient rate limiter for read operations
export const readOnlyRateLimit = rateLimit({
  ...defaultConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for read operations
  skip: (req) => {
    // Only apply to GET requests
    return req.method !== "GET";
  },
});
