import express from "express";
import prisma, { executeWithRetry } from "../utils/prisma.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Health check endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Complete health check
 *     description: Returns the overall health status of the login service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   example: "2023-01-01T00:00:00.000Z"
 *                 service:
 *                   type: string
 *                   example: "login_service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "connected"
 *       503:
 *         description: Service is unhealthy
 */
router.get("/", async (req, res) => {
  try {
    // Test database connection
    await executeWithRetry(async (prismaInstance) => {
      await prismaInstance.$queryRaw`SELECT 1 as test`;
    });

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "login_service",
      version: "1.0.0",
      database: {
        status: "connected",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "login_service",
      version: "1.0.0",
      database: {
        status: "disconnected",
        error: error.message,
      },
    });
  }
});

/**
 * @swagger
 * /health/basic:
 *   get:
 *     summary: Basic health check
 *     description: Returns basic service health without database check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Basic service is running
 */
router.get("/basic", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "login_service",
    version: "1.0.0",
  });
});

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database health check
 *     description: Returns database connection status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database is connected
 *       503:
 *         description: Database is disconnected
 */
router.get("/database", async (req, res) => {
  try {
    await executeWithRetry(async (prismaInstance) => {
      await prismaInstance.$queryRaw`SELECT 1 as test`;
    });

    res.status(200).json({
      status: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({
      status: "disconnected",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

export default router;
