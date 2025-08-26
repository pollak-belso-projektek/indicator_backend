import { comparePassword } from "../utils/hash.js";
import { generateToken, verifyRefreshToken } from "../utils/token.js";
import { getByEmail, getById } from "./user.service.js";

export async function login(email, password) {
  try {
    // Get user data
    const user = await getByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    // Password comparison is inherently slow for security
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error("User not found");
    }

    // Generate token
    const token = generateToken(user);

    if (!token) {
      throw new Error("Failed to generate token");
    }

    // Return only necessary data
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      permissions: user.permissions,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
    };
  } catch (error) {
    // Improve error handling
    console.error("Login error:", error.message);
    throw error; // Re-throw to be handled by the controller
  }
}

export async function refresh(refreshToken) {
  try {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      throw new Error("Invalid or expired refresh token");
    }

    // Get fresh user data
    const user = await getById(decoded.id);

    if (!user) {
      throw new Error("User not found");
    }

    // Generate new tokens
    const newTokens = generateToken(user);

    if (!newTokens) {
      throw new Error("Failed to generate new tokens");
    }

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  } catch (error) {
    console.error("Token refresh error:", error.message);
    throw error; // Re-throw to be handled by the controller
  }
}
