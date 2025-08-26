/**
 * Client to communicate with the login service
 */

const LOGIN_SERVICE_URL =
  process.env.LOGIN_SERVICE_URL || "http://localhost:5301";

class LoginServiceClient {
  constructor() {
    this.baseUrl = LOGIN_SERVICE_URL;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(
        `Login service request failed for ${endpoint}:`,
        error.message
      );
      throw error;
    }
  }

  async login(email, password) {
    return this.makeRequest("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async refresh(refreshToken) {
    return this.makeRequest("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async healthCheck() {
    return this.makeRequest("/health/basic");
  }
}

// Export singleton instance
export const loginServiceClient = new LoginServiceClient();
