import jwt from "jsonwebtoken";
import { getByEmail } from "../services/user.service.js";
import * as cache from "./cache.js";
import { loginServiceClient } from "./loginServiceClient.js";
import process from "node:process";

// Load configuration once - these should match the login service
const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";

// Default JWT options to avoid repeating them
const JWT_DEFAULT_OPTIONS = {
  algorithm: "HS256",
  issuer: "https://indicator-login-service.pollak.info",
};

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
    algorithms: [JWT_DEFAULT_OPTIONS.algorithm],
    issuer: JWT_DEFAULT_OPTIONS.issuer,
  });

  // Cache the successful verification
  cache.set(cacheKey, decoded, TOKEN_CACHE_TTL);

  return decoded;
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

    // For login service tokens, we get more complete user data from the token payload
    // and only fetch from database if we need additional information
    let user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      name: decoded.name,
      permissions: decoded.permissions,
    };

    // Get additional user data from database if needed (with detailed permissions, etc.)
    try {
      const dbUser = await getByEmail(decoded.email);
      if (dbUser) {
        // Merge database user data with token data
        user = {
          ...user,
          ...dbUser,
          // Keep token data as authoritative for these fields
          id: decoded.sub || decoded.id,
          email: decoded.email,
          name: decoded.name,
          permissions: decoded.permissions,
        };
      }
    } catch (dbError) {
      console.warn(
        "Could not fetch additional user data from database:",
        dbError.message
      );
      // Continue with token data only
    }

    if (user) {
      // Cache the user for this token
      cache.set(cacheKey, user, USER_TOKEN_CACHE_TTL);
    }

    return user;
  } catch (error) {
    console.error("Error getting user from token:", error);
    return null;
  }
}

export async function refreshAccessToken(refreshToken) {
  try {
    // Delegate to login service
    const result = await loginServiceClient.refresh(refreshToken);
    return result;
  } catch (error) {
    console.error("Error refreshing token via login service:", error);
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
