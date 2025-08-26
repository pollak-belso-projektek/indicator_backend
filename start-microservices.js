#!/usr/bin/env node

/**
 * Microservices Startup Script
 *
 * This script helps you start the microservices architecture components
 * Usage: npm run microservices
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting Indicator Microservices...\n");

const services = [
  {
    name: "Login Service",
    port: 5301,
    path: path.join(__dirname, "login_service"),
    command: "npm",
    args: ["start"],
    color: "\x1b[36m", // Cyan
  },
  {
    name: "Main Service",
    port: 5300,
    path: __dirname, // Main service is in the root directory
    command: "npm",
    args: ["start"],
    color: "\x1b[33m", // Yellow
  },
  {
    name: "API Gateway",
    port: 5000,
    path: path.join(__dirname, "gateway_service"),
    command: "npm",
    args: ["start"],
    color: "\x1b[35m", // Magenta
  },
];

// Start each service
services.forEach((service, index) => {
  setTimeout(() => {
    console.log(
      `${service.color}[${service.name}] Starting on port ${service.port}...\x1b[0m`
    );

    const child = spawn(service.command, service.args, {
      cwd: service.path,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (error) => {
      console.error(
        `${service.color}[${service.name}] Error: ${error.message}\x1b[0m`
      );
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(
          `${service.color}[${service.name}] Exited with code ${code}\x1b[0m`
        );
      }
    });
  }, index * 2000); // Stagger startup by 2 seconds
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down all services...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down all services...");
  process.exit(0);
});
