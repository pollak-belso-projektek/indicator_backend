import prisma, { testDatabaseConnection } from "../utils/prisma.js";
import { loginServiceClient } from "../utils/loginServiceClient.js";
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

    // Test login service health
    let loginServiceStatus = "healthy";
    let loginServiceError = null;
    try {
      await loginServiceClient.healthCheck();
    } catch (error) {
      loginServiceStatus = "unhealthy";
      loginServiceError = error.message;
    }

    const responseTime = Date.now() - startTime;

    const isHealthy = loginServiceStatus === "healthy";
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      database: {
        status: "connected",
        responseTime: `${responseTime}ms`,
      },
      loginService: {
        status: loginServiceStatus,
        error: loginServiceError,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "unknown",
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("Health check failed:", error.message);

    // Test login service health even if database is down
    let loginServiceStatus = "healthy";
    let loginServiceError = null;
    try {
      await loginServiceClient.healthCheck();
    } catch (loginError) {
      loginServiceStatus = "unhealthy";
      loginServiceError = loginError.message;
    }

    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        status: "disconnected",
        error: error.message,
        responseTime: `${responseTime}ms`,
      },
      loginService: {
        status: loginServiceStatus,
        error: loginServiceError,
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
 * Login service health check
 */
export const loginServiceHealth = async (req, res) => {
  const startTime = Date.now();

  try {
    await loginServiceClient.healthCheck();
    const responseTime = Date.now() - startTime;

    res.status(200).json({
      status: "healthy",
      service: "login_service",
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("Login service health check failed:", error.message);

    res.status(503).json({
      status: "unhealthy",
      service: "login_service",
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

/**
 * @swagger
 * /api/v1/health/login-service:
 *   get:
 *     summary: Check login service health
 *     description: Returns the health status of the login service connection
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Login service is healthy
 *       503:
 *         description: Login service is unhealthy
 */
router.get("/login-service", loginServiceHealth);

export default router;
