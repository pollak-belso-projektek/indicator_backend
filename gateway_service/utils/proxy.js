import { createProxyMiddleware } from "http-proxy-middleware";
import { serviceRegistry } from "../utils/serviceRegistry.js";

/**
 * Create proxy middleware for routing requests to services
 */

// Login service proxy
export const loginServiceProxy = createProxyMiddleware({
  target: process.env.LOGIN_SERVICE_URL || "http://localhost:5301",
  changeOrigin: true,
  pathRewrite: {
    // Remove /api/v1/auth prefix when forwarding to login service
    "^/api/v1/auth": "/api/v1/auth",
  },
  onError: (err, req, res) => {
    console.error("❌ Login service proxy error:", err.message);
    res.status(503).json({
      error: "Service Unavailable",
      message: "Login service is currently unavailable",
      service: "login_service",
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add request ID to forwarded request
    if (req.requestId) {
      proxyReq.setHeader("X-Request-ID", req.requestId);
    }
    // Add original IP
    proxyReq.setHeader("X-Forwarded-For", req.ip);
    proxyReq.setHeader("X-Forwarded-Proto", req.protocol);
    proxyReq.setHeader("X-Forwarded-Host", req.get("host"));
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log successful proxy
    console.log(
      `🔄 Proxied to login service: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`
    );
  },
  logLevel: process.env.NODE_ENV === "development" ? "debug" : "warn",
});

// Main service proxy
export const mainServiceProxy = createProxyMiddleware({
  target: process.env.MAIN_SERVICE_URL || "http://localhost:5300",
  changeOrigin: true,
  pathRewrite: {
    // Keep the full path when forwarding to main service
    "^/api/v1": "/api/v1",
  },
  onError: (err, req, res) => {
    console.error("❌ Main service proxy error:", err.message);
    res.status(503).json({
      error: "Service Unavailable",
      message: "Main service is currently unavailable",
      service: "main_service",
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add request ID to forwarded request
    if (req.requestId) {
      proxyReq.setHeader("X-Request-ID", req.requestId);
    }
    // Add original IP
    proxyReq.setHeader("X-Forwarded-For", req.ip);
    proxyReq.setHeader("X-Forwarded-Proto", req.protocol);
    proxyReq.setHeader("X-Forwarded-Host", req.get("host"));
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log successful proxy
    console.log(
      `🔄 Proxied to main service: ${req.method} ${req.originalUrl} → ${proxyRes.statusCode}`
    );
  },
  logLevel: process.env.NODE_ENV === "development" ? "debug" : "warn",
});

// Circuit breaker pattern for service availability
export function createCircuitBreakerProxy(serviceName, proxyMiddleware) {
  return (req, res, next) => {
    // Check if service is healthy
    if (!serviceRegistry.isServiceHealthy(serviceName)) {
      console.warn(`⚠️  Circuit breaker: ${serviceName} is unhealthy`);
      return res.status(503).json({
        error: "Service Unavailable",
        message: `${serviceName} is currently unavailable`,
        service: serviceName,
      });
    }

    // Service is healthy, proceed with proxy
    proxyMiddleware(req, res, next);
  };
}
