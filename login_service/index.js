// Load environment variables
import "dotenv/config";
import express from "express";
import cors from "cors";
import process from "node:process";

// Import utilities
import { initializeDatabase } from "./utils/prisma.js";
import { setupSwagger } from "./utils/swagger.js";

// Import controllers
import authRouter from "./controllers/auth.controller.js";
import healthRouter from "./controllers/health.controller.js";

// Configuration
const app = express();
const port = process.env.PORT || 5301;

const corsConfig = {
  origin: [
    "http://localhost:5173",
    "http://172.16.0.100:5174",
    "http://10.0.1.10:5173",
    "https://indikator.pollak.info",
    "http://localhost:5300", // Allow main backend to call this service
    "http://192.168.1.6:5173",
  ],
  credentials: true,
};

// Apply CORS
app.use(cors(corsConfig));

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: false }));

// Health check endpoints (public, no authentication required)
app.use("/health", healthRouter);

// Authentication routes
app.use("/api/v1/auth", authRouter);

// Set up Swagger API documentation
setupSwagger(app);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Service information
 *     description: Returns basic information about the login service
 *     responses:
 *       200:
 *         description: Service information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: "Login Service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 status:
 *                   type: string
 *                   example: "running"
 */
app.get("/", (req, res) => {
  res.json({
    service: "Login Service",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      auth: "/api/v1/auth",
      docs: "/api-docs",
    },
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Allow degraded start based on environment variable
    const allowDegradedStart = process.env.ALLOW_DEGRADED_START === "true";

    // Test database connection with retry logic
    const dbResult = await initializeDatabase({ allowDegradedStart });

    if (dbResult.degraded) {
      console.warn(
        "⚠️  Login service starting in degraded mode - some features may be unavailable"
      );
    }

    app.listen(port, () => {
      const status = dbResult.degraded ? "🟡" : "🚀";
      const mode = dbResult.degraded ? " (DEGRADED MODE)" : "";
      console.log(
        `${status} Login Service running at http://localhost:${port}${mode}`
      );
      console.log(
        `📚 API documentation available at http://localhost:${port}/api-docs`
      );

      if (dbResult.degraded) {
        console.log(
          "🔧 Database connection will be retried automatically on each request"
        );
        console.log(`📊 Health endpoints available:`);
        console.log(`   • Basic health: http://localhost:${port}/health/basic`);
        console.log(
          `   • Database health: http://localhost:${port}/health/database`
        );
        console.log(`   • Full health: http://localhost:${port}/health`);
      }
    });
  } catch (error) {
    console.error(
      "❌ Failed to start login service due to database connection issues:",
      error.message
    );
    console.error(
      "💡 Tip: Set ALLOW_DEGRADED_START=true to start service without database"
    );
    process.exit(1);
  }
};

// Start the server
startServer();
