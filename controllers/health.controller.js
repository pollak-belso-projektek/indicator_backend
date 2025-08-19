import prisma, { testDatabaseConnection } from "../utils/prisma.js";
import express from "express";

const router = express.Router();

/**
 * Basic application health check (no database dependency)
 */
export const basicHealthCheck = async (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "unknown",
    environment: process.env.NODE_ENV || "development",
  });
};

/**
 * Health check endpoint for the application and database
 */
export const healthCheck = async (req, res) => {
  const startTime = Date.now();

  try {
    // Test database connection with a timeout
    const dbTestPromise = testDatabaseConnection();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database health check timeout")), 5000)
    );

    await Promise.race([dbTestPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        status: "connected",
        responseTime: `${responseTime}ms`,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "unknown",
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        status: "disconnected",
        error: error.message,
        responseTime: `${responseTime}ms`,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "unknown",
    });
  }
};

/**
 * Database-specific health check
 */
export const databaseHealth = async (req, res) => {
  const startTime = Date.now();

  try {
    // Test database connection with a simple query and timeout
    const queryPromise = prisma.$queryRaw`SELECT NOW() as current_time, version() as db_version`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 5000)
    );

    await Promise.race([queryPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      status: "healthy",
      database: "connected",
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /api/v1/health/basic:
 *   get:
 *     summary: Basic application health check
 *     description: Returns basic application status without database dependency
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is running
 */
router.get("/basic", basicHealthCheck);

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Check overall application health
 *     description: Returns the health status of the application including database connection, uptime, and memory usage
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is healthy
 *       503:
 *         description: Application is unhealthy
 */
router.get("/", healthCheck);

/**
 * @swagger
 * /api/v1/health/database:
 *   get:
 *     summary: Check database connection health
 *     description: Returns the health status of the database connection specifically
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connection is healthy
 *       503:
 *         description: Database connection is unhealthy
 */
router.get("/database", databaseHealth);

export default router;
