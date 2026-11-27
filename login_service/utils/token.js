import jwt from "jsonwebtoken";
import * as cache from "./cache.js";
import process from "node:process";
import { mapTableAccess } from "./permissions.js";

// Load configuration once
const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "default_refresh_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

// Default JWT options to avoid repeating them
const JWT_DEFAULT_OPTIONS = {
  algorithm: "HS256",
  issuer: "https://indicator-login-service.pollak.info",
};

export function generateToken(user) {
  // Streamlined payload with only necessary data
  const payload = {
    email: user.email,
    name: user.name,
    permissions: user.permissionsDetails,
    school: user.alapadatok,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    tableAccess: user.tableAccess
      ? user.tableAccess
          .filter((access) => access.table.isAvailable)
          .map((access) => ({
            tableName: access.tableName,
            permissions: mapTableAccess(access.access),
            isAvailable: access.table.isAvailable,
            alias: access.table.alias,
          }))
      : [],
  };

  // Use different secrets for access and refresh tokens for better security
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    ...JWT_DEFAULT_OPTIONS,
    expiresIn: JWT_EXPIRES_IN,
    subject: String(user.id),
  });

  const refreshToken = jwt.sign(
    { email: user.email, name: user.name, id: user.id, type: "refresh" },
    JWT_REFRESH_SECRET,
    {
      ...JWT_DEFAULT_OPTIONS,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      subject: String(user.id),
    }
  );

  return {
    accessToken,
    refreshToken,
  };
}

// Token verification cache settings
const TOKEN_CACHE_TTL = 60 * 1000; // 1 minute

export async function verifyToken(token) {
  // Check cache first
  const cacheKey = `token:verify:${token}`;
  const cachedDecoded = await cache.get(cacheKey);
  if (cachedDecoded) {
    return cachedDecoded;
  }

  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_DEFAULT_OPTIONS.algorithm],
    issuer: JWT_DEFAULT_OPTIONS.issuer,
  });

  // Cache the successful verification
  await cache.set(cacheKey, decoded, TOKEN_CACHE_TTL);

  return decoded;
}

export async function verifyRefreshToken(token) {
  // Check cache first
  const cacheKey = `token:refresh:${token}`;
  const cachedDecoded = await cache.get(cacheKey);
  if (cachedDecoded) {
    return cachedDecoded;
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: [JWT_DEFAULT_OPTIONS.algorithm],
      issuer: JWT_DEFAULT_OPTIONS.issuer,
    });

    // Trusted-device tokens share the refresh secret but may only skip 2FA at
    // login: they must never work as a refresh token (that would be a 30-day
    // session without a password). Older refresh tokens have no `type`, so only
    // tokens explicitly typed as something else are rejected.
    if (decoded.type !== undefined && decoded.type !== "refresh") {
      return null;
    }

    // Cache the successful verification
    await cache.set(cacheKey, decoded, TOKEN_CACHE_TTL);

    return decoded;
  } catch (error) {
    console.error("Refresh token verification failed:", error);
    return null;
  }
}

/**
 * Check if a token is expired
 * @param {string} token - The token to check
 * @param {string} tokenType - The type of token (for logging purposes)
 * @returns {boolean} - Whether the token is expired
 */
function isExpired(token, tokenType = "token") {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return true; // Token is invalid or does not have an expiration
    }
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    return decoded.exp < currentTime; // Check if the token is expired
  } catch (error) {
    console.error(`Error decoding ${tokenType}:`, error);
    return true; // If there's an error, consider the token expired
  }
}

export function isTokenExpired(token) {
  return isExpired(token, "access token");
}

export function isRefreshTokenExpired(token) {
  return isExpired(token, "refresh token");
}

/**
 * Generate a long-lived trusted device token
 * @param {object} user - The user object
 * @returns {string} - The generated JWT token
 */
export function generateTrustedDeviceToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name, id: user.id, type: "trusted_device" },
    JWT_REFRESH_SECRET,
    {
      ...JWT_DEFAULT_OPTIONS,
      expiresIn: "30d",
      subject: String(user.id),
    }
  );
}

/**
 * Verify a trusted device token
 * @param {string} token - The token to verify
 * @returns {object|null} - The decoded token if valid, null otherwise
 */
export function verifyTrustedDeviceToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, JWT_DEFAULT_OPTIONS);
    if (decoded && decoded.type === "trusted_device") {
      return decoded;
    }
    return null;
  } catch (error) {
    console.error("Trusted device token verification failed:", error);
    return null;
  }
}
