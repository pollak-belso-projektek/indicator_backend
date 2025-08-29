import crypto from "crypto";

/**
 * API Key middleware for gateway access control
 * Validates API keys to ensure only authorized clients can access the backend
 */
export function apiKeyMiddleware(req, res, next) {
  // Get API keys from environment (comma-separated for multiple keys)
  const validApiKeys = process.env.API_KEYS
    ? process.env.API_KEYS.split(",")
    : [];

  console.log(
    "---------------------------------------- Valid API Keys:",
    validApiKeys
  );

  if (validApiKeys.length === 0) {
    console.warn("⚠️  No API keys configured - API key validation disabled");
    return next();
  }

  // Skip API key validation for health checks and documentation
  const publicRoutes = ["/health", "/api-docs", "/"];

  if (
    publicRoutes.some(
      (route) => req.path === route || req.path.startsWith(route)
    )
  ) {
    return next();
  }

  // Skip OPTIONS requests (preflight)
  if (req.method === "OPTIONS") {
    return next();
  }

  // Check for API key in headers
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      error: "API Key Required",
      message: "API key is required to access this service",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  }

  // Validate API key using constant-time comparison to prevent timing attacks
  const isValidApiKey = validApiKeys.some((validKey) => {
    return crypto.timingSafeEqual(
      Buffer.from(apiKey, "utf8"),
      Buffer.from(validKey, "utf8")
    );
  });

  if (!isValidApiKey) {
    return res.status(403).json({
      error: "Invalid API Key",
      message: "The provided API key is not valid",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  }

  // API key is valid, add metadata to request
  req.apiKeyValidated = true;
  req.apiKey = apiKey;

  next();
}

/**
 * Generate a secure API key
 * @param {number} length - Length of the API key (default: 32)
 * @returns {string} - Generated API key
 */
export function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash an API key for secure storage
 * @param {string} apiKey - The API key to hash
 * @returns {string} - Hashed API key
 */
export function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}
