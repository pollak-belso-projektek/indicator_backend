/**
 * Structured Logger for Logstash Integration
 *
 * This logger sends JSON-formatted logs to Logstash for centralized logging.
 * It includes request ID tracking, performance timing, and error serialization.
 */

import net from "node:net";
import process from "node:process";

class Logger {
  constructor() {
    this.serviceName = process.env.SERVICE_NAME || "unknown-service";
    this.logstashHost = process.env.LOGSTASH_HOST || "logstash";
    this.logstashPort = parseInt(process.env.LOGSTASH_PORT || "5044", 10);
    this.environment = process.env.NODE_ENV || "development";
    this.socket = null;
    this.connecting = false;
    this.connected = false;
    this.messageQueue = [];

    // Only connect to Logstash in production/staging
    if (this.environment !== "development") {
      this.connect();
    }
  }

  connect() {
    if (this.connecting || this.connected) return;

    this.connecting = true;
    this.socket = new net.Socket();

    this.socket.connect(this.logstashPort, this.logstashHost, () => {
      this.connected = true;
      this.connecting = false;
      console.log(
        `✅ Connected to Logstash at ${this.logstashHost}:${this.logstashPort}`
      );

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.sendToLogstash(message);
      }
    });

    this.socket.on("error", (err) => {
      this.connected = false;
      this.connecting = false;
      console.error("❌ Logstash connection error:", err.message);

      // Retry connection after 5 seconds
      setTimeout(() => this.connect(), 5000);
    });

    this.socket.on("close", () => {
      this.connected = false;
      this.connecting = false;
      console.warn(
        "⚠️  Logstash connection closed. Logs will only go to console."
      );
    });
  }

  sendToLogstash(logEntry) {
    if (!this.socket || !this.connected) {
      // Queue message if not connected
      if (this.messageQueue.length < 1000) {
        // Limit queue size
        this.messageQueue.push(logEntry);
      }
      return;
    }

    try {
      const logString = JSON.stringify(logEntry) + "\n";
      this.socket.write(logString);
    } catch (error) {
      console.error("Error sending to Logstash:", error.message);
    }
  }

  createLogEntry(level, message, meta = {}) {
    const logEntry = {
      "@timestamp": new Date().toISOString(),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      environment: this.environment,
      message,
      ...meta,
    };

    // Also log to console for development
    if (this.environment === "development") {
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      console.log(JSON.stringify(logEntry));
    }

    // Send to Logstash
    this.sendToLogstash(logEntry);

    return logEntry;
  }

  /**
   * Log an info message
   */
  info(message, meta = {}) {
    return this.createLogEntry("info", message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message, meta = {}) {
    return this.createLogEntry("warn", message, meta);
  }

  /**
   * Log an error message
   */
  error(message, error = null, meta = {}) {
    const errorMeta = error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
          },
          ...meta,
        }
      : meta;

    return this.createLogEntry("error", message, errorMeta);
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message, meta = {}) {
    if (this.environment === "development") {
      return this.createLogEntry("debug", message, meta);
    }
  }

  /**
   * Log an HTTP request
   */
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      path: req.path || req.url,
      endpoint: `${req.method} ${req.path || req.url}`,
      requestId: req.requestId || req.headers["x-request-id"],
      userId: req.user?.id || req.user?.userId,
      statusCode: res.statusCode,
      status_code: res.statusCode,
      responseTime: responseTime,
      response_time_ms: responseTime,
      ip:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    return this.createLogEntry(
      level,
      `${req.method} ${req.path || req.url} - ${res.statusCode}`,
      logData
    );
  }

  /**
   * Log a database query
   */
  logQuery(query, duration, params = {}) {
    return this.info("Database query executed", {
      query,
      duration_ms: duration,
      ...params,
    });
  }

  /**
   * Log a cache operation
   */
  logCache(operation, key, hit = null, meta = {}) {
    return this.debug(`Cache ${operation}`, {
      cacheOperation: operation,
      cacheKey: key,
      cacheHit: hit,
      ...meta,
    });
  }

  /**
   * Log an event (for RabbitMQ events)
   */
  logEvent(eventType, eventData = {}) {
    return this.info(`Event: ${eventType}`, {
      eventType,
      eventData,
    });
  }

  /**
   * Close the Logstash connection
   */
  close() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;
export { Logger };
