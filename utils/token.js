import jwt from "jsonwebtoken";
import { getByEmail } from "../services/user.service.js";
import * as cache from "./cache.js";
import { mapTableAccess } from "./permissions.js";
// Import process from 'node:process' for ES modules
import process from "node:process";

// Load configuration once
const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

// Default JWT options to avoid repeating them
const JWT_DEFAULT_OPTIONS = {
  algorithm: "HS256", // Changed from HS512 to HS256 for better performance with minimal security impact
  issuer: "https://indicator-api.pollak.info",
};

export function generateToken(user) {
  // Streamlined payload with only necessary data
  const payload = {
    email: user.email,
    name: user.name,
    permissions: user.permissionsDetails,
    school: user.alapadatok,
    tableAccess: user.tableAccess
      ? user.tableAccess.map((access) => ({
          tableName: access.tableName,
          permissions: mapTableAccess(access.access),
        }))
      : [],
  };

  // Use default options to simplify code
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    ...JWT_DEFAULT_OPTIONS,
    expiresIn: JWT_EXPIRES_IN,
    subject: String(user.id),
  });

  const refreshToken = jwt.sign(
    { email: user.email, name: user.name },
    JWT_SECRET,
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

export function verifyToken(token) {
  // Check cache first
  const cacheKey = `token:verify:${token}`;
  const cachedDecoded = cache.get(cacheKey);
  if (cachedDecoded) {
    return cachedDecoded;
  }

  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_DEFAULT_OPTIONS.algorithm], // Use consistent algorithm
    issuer: JWT_DEFAULT_OPTIONS.issuer,
  });

  // Cache the successful verification
  cache.set(cacheKey, decoded, TOKEN_CACHE_TTL);

  return decoded;
}

export function verifyRefreshToken(token) {
  // Check cache first
  const cacheKey = `token:refresh:${token}`;
  const cachedDecoded = cache.get(cacheKey);
  if (cachedDecoded) {
    return cachedDecoded;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_DEFAULT_OPTIONS.algorithm], // Use consistent algorithm
      issuer: JWT_DEFAULT_OPTIONS.issuer,
    });

    // Cache the successful verification
    cache.set(cacheKey, decoded, TOKEN_CACHE_TTL);

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

export async function refreshAccessToken(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null; // Invalid refresh token
  }

  const user = await getByEmail(decoded.email);
  if (!user) {
    return null; // User not found
  }

  return generateToken(user); // Generate new access token
}

// Settings for user token cache
const USER_TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserFromToken(token) {
  try {
    // Check cache first
    const cacheKey = `token:user:${token}`;
    const cachedUser = cache.get(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    const decoded = verifyToken(token);
    const user = await getByEmail(decoded.email);

    if (user) {
      // Cache the user for this token
      cache.set(cacheKey, user, USER_TOKEN_CACHE_TTL);
    }

    return user;
  } catch (error) {
    console.error("Error getting user from token:", error);
    return null; // Return null if there's an error
  }
}
