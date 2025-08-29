/**
 * Service discovery and health monitoring utilities
 */

const services = new Map();

// Service health status
const serviceHealth = new Map();

export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthCheckInterval = process.env.HEALTH_CHECK_INTERVAL || 30000;
    this.startHealthChecks();
  }

  // Register a service
  registerService(name, config) {
    this.services.set(name, {
      name,
      url: config.url,
      healthEndpoint: config.healthEndpoint || "/health/basic",
      timeout: config.timeout || 5000,
      retries: config.retries || 3,
      status: "unknown",
    });

    console.log(`✅ Service registered: ${name} at ${config.url}`);
  }

  // Get service configuration
  getService(name) {
    return this.services.get(name);
  }

  // Get all services
  getAllServices() {
    return Array.from(this.services.values());
  }

  // Check service health
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);

      const response = await fetch(`${service.url}${service.healthEndpoint}`, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;
      service.status = isHealthy ? "healthy" : "unhealthy";
      service.lastCheck = new Date();

      if (isHealthy) {
        const healthData = await response.json();
        service.healthData = healthData;
      }

      return isHealthy;
    } catch (error) {
      service.status = "unhealthy";
      service.lastCheck = new Date();
      service.error = error.message;
      console.warn(
        `⚠️  Service ${serviceName} health check failed:`,
        error.message
      );
      return false;
    }
  }

  // Start periodic health checks
  startHealthChecks() {
    setInterval(async () => {
      for (const [serviceName] of this.services) {
        await this.checkServiceHealth(serviceName);
      }
    }, this.healthCheckInterval);

    // Initial health check
    setTimeout(async () => {
      for (const [serviceName] of this.services) {
        await this.checkServiceHealth(serviceName);
      }
    }, 1000);
  }

  // Get health status of all services
  getHealthStatus() {
    const status = {};
    for (const [name, service] of this.services) {
      status[name] = {
        status: service.status,
        url: service.url,
        lastCheck: service.lastCheck,
        error: service.error,
        healthData: service.healthData,
      };
    }
    return status;
  }

  // Check if a service is healthy
  isServiceHealthy(serviceName) {
    const service = this.services.get(serviceName);
    return service && service.status === "healthy";
  }
}

// Create singleton instance
export const serviceRegistry = new ServiceRegistry();
