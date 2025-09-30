// Load environment variables
import "dotenv/config";
import express from "express";
import cors from "cors";
import process from "node:process";

// Import utilities and middleware
import { serviceRegistry } from "./utils/serviceRegistry.js";
import { setupSwagger } from "./utils/swagger.js";
import {
  loginServiceProxy,
  mainServiceProxy,
  createCircuitBreakerProxy,
} from "./utils/proxy.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { apiKeyMiddleware } from "./middleware/apiKey.middleware.js";
import { requestLoggingMiddleware } from "./middleware/logging.middleware.js";
import {
  generalRateLimit,
  authRateLimit,
  readOnlyRateLimit,
} from "./middleware/rateLimit.middleware.js";

// Import controllers
import healthRouter from "./controllers/health.controller.js";

// Configuration
const app = express();
const port = process.env.PORT || 5000;

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : [
      "http://localhost:5173",
      "http://172.16.0.100:5174",
      "https://indikator.pollak.info",
      "http://10.0.1.7:5173",
      "http://192.168.1.6:5173",
    ];

const corsConfig = {
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Refresh-Token",
    "X-Request-ID",
    "expires",
    "cache-control",
    "pragma",
    "no-cache",
    "no-store",
    "must-revalidate",
  ],
};

// Register services in the service registry
serviceRegistry.registerService("login_service", {
  url: process.env.LOGIN_SERVICE_URL || "http://localhost:5301",
  healthEndpoint: "/health/basic",
});

serviceRegistry.registerService("main_service", {
  url: process.env.MAIN_SERVICE_URL || "http://localhost:5300",
  healthEndpoint: "/health",
});

// Global middleware
app.use(cors(corsConfig));
app.use(requestLoggingMiddleware);

// Apply API key validation first (before rate limiting to prevent abuse)
// app.use(apiKeyMiddleware);

// Apply rate limiting (before body parsing to protect against large payloads)
app.use(generalRateLimit);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Gateway information
 *     description: Returns basic information about the API Gateway
 *     tags: [Gateway]
 *     responses:
 *       200:
 *         description: Gateway information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: "API Gateway"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 status:
 *                   type: string
 *                   example: "running"
 *                 routes:
 *                   type: object
 *                 services:
 *                   type: object
 */
app.get("/", (req, res) => {
  const servicesHealth = serviceRegistry.getHealthStatus();

  res.json({
    service: "API Gateway",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    routes: {
      health: "/health",
      auth: "/api/v1/auth/*",
      api: "/api/v1/*",
      docs: "/api-docs",
    },
    services: Object.keys(servicesHealth).reduce((acc, serviceName) => {
      acc[serviceName] = {
        status: servicesHealth[serviceName].status,
        url: servicesHealth[serviceName].url,
      };
      return acc;
    }, {}),
    uptime: process.uptime(),
  });
});

// Health check endpoints (public, no authentication required)
app.use("/health", healthRouter);

// Authentication routes (with specific rate limiting)
app.use("/api/v1/auth", authRateLimit);
app.use("/api/v1/auth", loginServiceProxy); // Direct proxy without circuit breaker for testing

// Protected API routes
app.use("/api/v1", readOnlyRateLimit); // Apply read-only rate limit first
app.use("/api/v1", authMiddleware); // Then apply authentication
app.use("/api/v1", createCircuitBreakerProxy("main_service", mainServiceProxy));

// Parse JSON bodies for non-proxied routes (AFTER proxy routes to avoid consuming request streams)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: false }));

// Set up Swagger API documentation
setupSwagger(app);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`❌ [${req.requestId || "unknown"}] Unhandled error:`, error);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      health: "/health",
      auth: "/api/v1/auth/*",
      api: "/api/v1/*",
      docs: "/api-docs",
    },
  });
});

// Start the gateway server
const startServer = async () => {
  try {
    app.listen(port, () => {
      console.log(`🚀 API Gateway running at http://localhost:${port}`);
      console.log(
        `📚 API documentation available at http://localhost:${port}/api-docs`
      );
      console.log(
        `📊 Health endpoints available at http://localhost:${port}/health`
      );
      console.log("");
      console.log("🔗 Service Routing:");
      console.log(
        `   • /api/v1/auth/* → Login Service (${
          process.env.LOGIN_SERVICE_URL || "http://localhost:5301"
        })`
      );
      console.log(
        `   • /api/v1/* → Main Service (${
          process.env.MAIN_SERVICE_URL || "http://localhost:5300"
        })`
      );
      console.log("");
      console.log("🛡️  Security Features:");
      console.log("   • API key authentication required");
      console.log("   • Rate limiting enabled");
      console.log("   • JWT authentication for protected routes");
      console.log("   • CORS configured");
      console.log("   • Request logging enabled");
      console.log("");
      console.log("⚡ Starting service health checks...");
    });
  } catch (error) {
    console.error("❌ Failed to start API Gateway:", error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Start the server
startServer();
