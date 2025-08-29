#!/usr/bin/env node

/**
 * Build Script for Indicator Microservices
 * 
 * This script provides various build and deployment options for the microservices architecture
 * 
 * Usage:
 *   npm run build              # Build all services locally
 *   npm run build:docker       # Build all Docker images
 *   npm run build:prod         # Build for production deployment
 *   node build.js --help       # Show all options
 */

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  services: [
    {
      name: "main-service",
      path: __dirname,
      dockerfile: "Dockerfile",
      image: "indicator-main",
      port: 5300
    },
    {
      name: "login-service", 
      path: path.join(__dirname, "login_service"),
      dockerfile: "Dockerfile",
      image: "indicator-login",
      port: 5301
    },
    {
      name: "gateway-service",
      path: path.join(__dirname, "gateway_service"), 
      dockerfile: "Dockerfile",
      image: "indicator-gateway",
      port: 5000
    }
  ],
  registry: "ghcr.io",
  namespace: "12szf2/indicator_backend"
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logService(serviceName, message, color = colors.cyan) {
  log(`[${serviceName}] ${message}`, color);
}

// Utility function to run commands
function runCommand(command, cwd = __dirname, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      cwd,
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

// Check if service directory exists and has package.json
function validateService(service) {
  const packageJsonPath = path.join(service.path, 'package.json');
  const dockerfilePath = path.join(service.path, service.dockerfile);
  
  if (!existsSync(service.path)) {
    throw new Error(`Service directory not found: ${service.path}`);
  }
  
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json not found for ${service.name}: ${packageJsonPath}`);
  }
  
  if (!existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile not found for ${service.name}: ${dockerfilePath}`);
  }
  
  return true;
}

// Install dependencies for a service
async function installDependencies(service) {
  logService(service.name, "Installing dependencies...", colors.yellow);
  
  try {
    await runCommand("npm ci --only=production", service.path);
    logService(service.name, "Dependencies installed successfully", colors.green);
  } catch (error) {
    logService(service.name, `Failed to install dependencies: ${error.message}`, colors.red);
    throw error;
  }
}

// Build Docker image for a service
async function buildDockerImage(service, tag = "latest") {
  const imageName = `${service.image}:${tag}`;
  logService(service.name, `Building Docker image: ${imageName}`, colors.blue);
  
  try {
    await runCommand(`docker build -t ${imageName} -f ${service.dockerfile} .`, service.path);
    logService(service.name, `Docker image built successfully: ${imageName}`, colors.green);
    return imageName;
  } catch (error) {
    logService(service.name, `Failed to build Docker image: ${error.message}`, colors.red);
    throw error;
  }
}

// Tag and push image to registry
async function pushDockerImage(service, tag = "latest") {
  const localImage = `${service.image}:${tag}`;
  const remoteImage = `${config.registry}/${config.namespace}-${service.name}:${tag}`;
  
  logService(service.name, `Tagging image: ${localImage} -> ${remoteImage}`, colors.magenta);
  
  try {
    await runCommand(`docker tag ${localImage} ${remoteImage}`);
    logService(service.name, `Pushing image: ${remoteImage}`, colors.magenta);
    await runCommand(`docker push ${remoteImage}`);
    logService(service.name, `Image pushed successfully: ${remoteImage}`, colors.green);
  } catch (error) {
    logService(service.name, `Failed to push image: ${error.message}`, colors.red);
    throw error;
  }
}

// Build all services
async function buildAll() {
  log("🏗️  Building all microservices...", colors.blue);
  
  for (const service of config.services) {
    try {
      validateService(service);
      await installDependencies(service);
    } catch (error) {
      log(`❌ Build failed for ${service.name}: ${error.message}`, colors.red);
      process.exit(1);
    }
  }
  
  log("✅ All services built successfully!", colors.green);
}

// Build all Docker images
async function buildDockerAll(tag = "latest") {
  log("🐳 Building all Docker images...", colors.blue);
  
  for (const service of config.services) {
    try {
      validateService(service);
      await buildDockerImage(service, tag);
    } catch (error) {
      log(`❌ Docker build failed for ${service.name}: ${error.message}`, colors.red);
      process.exit(1);
    }
  }
  
  log("✅ All Docker images built successfully!", colors.green);
}

// Build and push all images to registry
async function buildProduction(tag = "latest") {
  log("🚀 Building for production...", colors.blue);
  
  // First build all images
  await buildDockerAll(tag);
  
  // Then push to registry
  for (const service of config.services) {
    try {
      await pushDockerImage(service, tag);
    } catch (error) {
      log(`❌ Push failed for ${service.name}: ${error.message}`, colors.red);
      process.exit(1);
    }
  }
  
  log("✅ All images pushed to production registry!", colors.green);
}

// Start services with Docker Compose
async function startServices(mode = "production") {
  const composeFile = mode === "development" ? "docker-compose.dev.yml" : "docker-compose.yml";
  log(`🚀 Starting services in ${mode} mode...`, colors.blue);
  
  try {
    await runCommand(`docker compose -f ${composeFile} up -d`);
    log("✅ All services started successfully!", colors.green);
    log("\n📋 Service URLs:", colors.cyan);
    log("   🌐 API Gateway: http://localhost:5000", colors.cyan);
    log("   🔐 Login Service: http://localhost:5301", colors.cyan);
    log("   ⚙️  Main Service: http://localhost:5300", colors.cyan);
  } catch (error) {
    log(`❌ Failed to start services: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Stop services
async function stopServices() {
  log("🛑 Stopping all services...", colors.yellow);
  
  try {
    await runCommand("docker compose -f docker-compose.yml down");
    await runCommand("docker compose -f docker-compose.dev.yml down");
    log("✅ All services stopped!", colors.green);
  } catch (error) {
    log(`❌ Failed to stop services: ${error.message}`, colors.red);
  }
}

// Show help
function showHelp() {
  log("🔧 Indicator Microservices Build Tool", colors.blue);
  log("\nUsage:", colors.cyan);
  log("  node build.js [command] [options]", colors.cyan);
  log("\nCommands:", colors.cyan);
  log("  build                Build all services (install dependencies)", colors.cyan);
  log("  docker               Build all Docker images", colors.cyan);
  log("  production [tag]     Build and push to production registry", colors.cyan);
  log("  start [mode]         Start services (mode: production|development)", colors.cyan);
  log("  stop                 Stop all services", colors.cyan);
  log("  help                 Show this help message", colors.cyan);
  log("\nExamples:", colors.cyan);
  log("  node build.js build", colors.cyan);
  log("  node build.js docker", colors.cyan);
  log("  node build.js production v1.0.0", colors.cyan);
  log("  node build.js start development", colors.cyan);
  log("  node build.js stop", colors.cyan);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  try {
    switch (command) {
      case 'build':
        await buildAll();
        break;
      case 'docker':
        await buildDockerAll(args[1] || 'latest');
        break;
      case 'production':
        await buildProduction(args[1] || 'latest');
        break;
      case 'start':
        await startServices(args[1] || 'production');
        break;
      case 'stop':
        await stopServices();
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        log(`❌ Unknown command: ${command}`, colors.red);
        log("Use 'node build.js help' for usage information", colors.cyan);
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log("\n🛑 Build process interrupted", colors.yellow);
  process.exit(0);
});

process.on('SIGTERM', () => {
  log("\n🛑 Build process terminated", colors.yellow);
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}