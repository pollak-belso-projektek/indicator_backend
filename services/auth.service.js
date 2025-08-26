import { loginServiceClient } from "../utils/loginServiceClient.js";

export async function login(email, password) {
  try {
    // Delegate to login service
    const result = await loginServiceClient.login(email, password);
    return result;
  } catch (error) {
    console.error("Login error:", error.message);
    throw error;
  }
}

export async function refresh(refreshToken) {
  try {
    // Delegate to login service
    const result = await loginServiceClient.refresh(refreshToken);
    return result;
  } catch (error) {
    console.error("Token refresh error:", error.message);
    throw error;
  }
}
