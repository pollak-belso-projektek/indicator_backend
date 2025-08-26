import express from "express";
import { serviceRegistry } from "../utils/serviceRegistry.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Gateway and service health monitoring
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Complete health check
 *     description: Returns the health status of the gateway and all registered services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are healthy
 *       503:
 *         description: One or more services are unhealthy
 */
router.get("/", async (req, res) => {
  try {
    const gatewayHealth = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: "1.0.0",
    };

    const servicesHealth = serviceRegistry.getHealthStatus();

    // Determine overall health
    const allServicesHealthy = Object.values(servicesHealth).every(
      (service) => service.status === "healthy"
    );
    const overallStatus = allServicesHealthy ? "healthy" : "degraded";
    const statusCode = allServicesHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      gateway: gatewayHealth,
      services: servicesHealth,
      summary: {
        total: Object.keys(servicesHealth).length,
        healthy: Object.values(servicesHealth).filter(
          (s) => s.status === "healthy"
        ).length,
        unhealthy: Object.values(servicesHealth).filter(
          (s) => s.status === "unhealthy"
        ).length,
      },
    });
  } catch (error) {
    console.error("Gateway health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      gateway: {
        status: "unhealthy",
      },
    });
  }
});

/**
 * @swagger
 * /health/basic:
 *   get:
 *     summary: Basic gateway health
 *     description: Returns basic gateway health without checking services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Gateway is running
 */
router.get("/basic", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "api_gateway",
    version: "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Services health check
 *     description: Returns health status of all registered services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Services health information
 */
router.get("/services", (req, res) => {
  const servicesHealth = serviceRegistry.getHealthStatus();

  res.status(200).json({
    timestamp: new Date().toISOString(),
    services: servicesHealth,
    summary: {
      total: Object.keys(servicesHealth).length,
      healthy: Object.values(servicesHealth).filter(
        (s) => s.status === "healthy"
      ).length,
      unhealthy: Object.values(servicesHealth).filter(
        (s) => s.status === "unhealthy"
      ).length,
    },
  });
});

/**
 * @swagger
 * /health/services/{serviceName}:
 *   get:
 *     summary: Individual service health
 *     description: Returns health status of a specific service
 *     tags: [Health]
 *     parameters:
 *       - in: path
 *         name: serviceName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the service to check
 *     responses:
 *       200:
 *         description: Service health information
 *       404:
 *         description: Service not found
 */
router.get("/services/:serviceName", async (req, res) => {
  const { serviceName } = req.params;
  const service = serviceRegistry.getService(serviceName);

  if (!service) {
    return res.status(404).json({
      error: "Service not found",
      service: serviceName,
    });
  }

  // Perform fresh health check
  const isHealthy = await serviceRegistry.checkServiceHealth(serviceName);
  const healthStatus = serviceRegistry.getHealthStatus()[serviceName];

  res.status(isHealthy ? 200 : 503).json({
    timestamp: new Date().toISOString(),
    service: serviceName,
    ...healthStatus,
  });
});

export default router;
