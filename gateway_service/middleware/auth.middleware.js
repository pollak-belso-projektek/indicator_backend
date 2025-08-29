import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

/**
 * Authentication middleware for the gateway
 * Validates JWT tokens without requiring database access
 */
export function authMiddleware(req, res, next) {
  // Skip authentication for certain routes
  const publicRoutes = [
    "/health",
    "/api-docs",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/",
  ];

  if (
    publicRoutes.some(
      (route) => req.path === route || req.path.startsWith(route)
    )
  ) {
    return next();
  }

  // Skip OPTIONS requests
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "https://indicator-login-service.pollak.info",
    });

    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      permissions: decoded.permissions,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    } else {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
}

/**
 * Optional authentication middleware
 * Adds user info if token is valid, but doesn't block if invalid
 */
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "https://indicator-login-service.pollak.info",
    });

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      permissions: decoded.permissions,
    };
  } catch (error) {
    // Silently ignore token errors in optional mode
  }

  next();
}
