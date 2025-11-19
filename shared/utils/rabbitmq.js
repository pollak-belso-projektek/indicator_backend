/**
 * RabbitMQ Client for Event-Driven Communication
 *
 * This utility provides easy publishing and consuming of events
 * between microservices using RabbitMQ.
 */

import amqp from "amqplib";
import process from "node:process";
import logger from "./logger.js";

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connecting = false;
    this.connected = false;
    this.rabbitmqUrl =
      process.env.RABBITMQ_URL || "amqp://admin:admin@rabbitmq:5672/indicator";
    this.serviceName = process.env.SERVICE_NAME || "unknown-service";
    this.exchange = "indicator.events";
    this.dlx = "indicator.dlx";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    if (this.connecting || this.connected) return;

    this.connecting = true;

    try {
      logger.info("Connecting to RabbitMQ...", { url: this.rabbitmqUrl });

      // Create connection
      this.connection = await amqp.connect(this.rabbitmqUrl);

      // Create channel
      this.channel = await this.connection.createChannel();

      // Assert exchange
      await this.channel.assertExchange(this.exchange, "topic", {
        durable: true,
      });

      // Assert DLX
      await this.channel.assertExchange(this.dlx, "fanout", {
        durable: true,
      });

      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;

      logger.info("✅ Connected to RabbitMQ");

      // Handle connection close
      this.connection.on("close", (err) => {
        this.connected = false;
        logger.warn("RabbitMQ connection closed", { error: err?.message });
        this.reconnect();
      });

      // Handle connection error
      this.connection.on("error", (err) => {
        this.connected = false;
        logger.error("RabbitMQ connection error", err);
      });
    } catch (error) {
      this.connected = false;
      this.connecting = false;
      logger.error("Failed to connect to RabbitMQ", error);
      this.reconnect();
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached. Giving up on RabbitMQ.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.info(
      `Reconnecting to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => this.connect(), delay);
  }

  /**
   * Publish an event to the exchange
   *
   * @param {string} routingKey - Event routing key (e.g., 'user.created', 'data.updated')
   * @param {object} data - Event data
   * @param {object} options - Additional options
   */
  async publish(routingKey, data, options = {}) {
    if (!this.connected) {
      logger.warn("RabbitMQ not connected. Event will be lost.", {
        routingKey,
        data,
      });
      return false;
    }

    try {
      const message = {
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        routingKey,
        data,
        ...options,
      };

      const sent = this.channel.publish(
        this.exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: "application/json",
          ...options,
        }
      );

      if (sent) {
        logger.logEvent(routingKey, data);
        return true;
      } else {
        logger.warn("Failed to publish event (channel buffer full)", {
          routingKey,
          data,
        });
        return false;
      }
    } catch (error) {
      logger.error("Error publishing event to RabbitMQ", error, {
        routingKey,
        data,
      });
      return false;
    }
  }

  /**
   * Publish a user event
   */
  async publishUserEvent(eventType, userData) {
    return this.publish(`user.${eventType}`, userData);
  }

  /**
   * Publish a data event
   */
  async publishDataEvent(eventType, data) {
    return this.publish(`data.${eventType}`, data);
  }

  /**
   * Consume messages from a queue
   *
   * @param {string} queueName - Name of the queue
   * @param {function} handler - Message handler function
   * @param {object} options - Queue options
   */
  async consume(queueName, handler, options = {}) {
    if (!this.connected) {
      logger.warn("RabbitMQ not connected. Cannot consume from queue.", {
        queueName,
      });
      return;
    }

    try {
      // Assert queue
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": this.dlx,
        },
        ...options,
      });

      // Consume messages
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          logger.debug("Received message from queue", {
            queue: queueName,
            routingKey: msg.fields.routingKey,
            data: content,
          });

          // Call handler
          await handler(content, msg);

          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          logger.error("Error processing message", error, {
            queue: queueName,
            message: msg.content.toString(),
          });

          // Reject and requeue or send to DLX
          this.channel.nack(msg, false, false);
        }
      });

      logger.info("Started consuming from queue", { queueName });
    } catch (error) {
      logger.error("Error setting up consumer", error, { queueName });
    }
  }

  /**
   * Bind a queue to routing keys
   */
  async bindQueue(queueName, routingKeys = []) {
    if (!this.connected) {
      logger.warn("RabbitMQ not connected. Cannot bind queue.", { queueName });
      return;
    }

    try {
      // Assert queue
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": this.dlx,
        },
      });

      // Bind to routing keys
      for (const routingKey of routingKeys) {
        await this.channel.bindQueue(queueName, this.exchange, routingKey);
        logger.debug("Bound queue to routing key", { queueName, routingKey });
      }

      logger.info("Queue bindings created", { queueName, routingKeys });
    } catch (error) {
      logger.error("Error binding queue", error, { queueName, routingKeys });
    }
  }

  /**
   * Close the connection
   */
  async close() {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.connected = false;
    logger.info("RabbitMQ connection closed");
  }
}

// Export singleton instance
const rabbitmq = new RabbitMQClient();

// Auto-connect (with some delay to let RabbitMQ start)
setTimeout(() => {
  rabbitmq.connect().catch((err) => {
    logger.error("Failed to auto-connect to RabbitMQ", err);
  });
}, 5000);

export default rabbitmq;
export { RabbitMQClient };
