# 🐳 Docker & Microservices Build System

## Overview

This repository now includes a comprehensive Docker and build system for the microservices architecture. The system supports development, testing, and production deployments with automated CI/CD pipelines.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway    │    │ Login Service   │
│   (Port 5173)   │────▶│   (Port 5000)   │────▶│   (Port 5301)   │
└─────────────────┘    └─────────┬───────┘    └─────────────────┘
                                 │                       │
                                 ▼                       │
                       ┌─────────────────┐               │
                       │  Main Service   │               │
                       │   (Port 5300)   │               │
                       └─────────┬───────┘               │
                                 │                       │
                                 └───────────────────────┘
                                      PostgreSQL Database
```

## Quick Start

### 🚀 One-Command Setup

```bash
# Linux/macOS
./setup.sh

# Windows
setup.bat
```

This will:
- Install all dependencies
- Build all Docker images
- Create environment file template
- Set up the complete development environment

### 🐳 Docker Commands

```bash
# Development (with hot reload)
npm run docker:start:dev

# Production
npm run docker:start

# Stop all services
npm run docker:stop

# View logs
docker compose logs -f
```

### 📦 Build Commands

```bash
# Install dependencies for all services
npm run build

# Build all Docker images
npm run build:docker

# Build and push to registry (production)
npm run build:prod
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Install dependencies for all services |
| `npm run build:docker` | Build all Docker images |
| `npm run build:prod` | Build and push to production registry |
| `npm run docker:start` | Start production stack |
| `npm run docker:start:dev` | Start development stack with hot reload |
| `npm run docker:stop` | Stop all services |

## Manual Build Script

The `build.js` script provides fine-grained control:

```bash
# Show help
node build.js help

# Build specific version
node build.js production v1.2.0

# Start in development mode
node build.js start development

# Build Docker images with custom tag
node build.js docker beta
```

## Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.docker`):

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/indicator_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Service URLs
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300

# CORS
CORS_ORIGINS=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Environment
NODE_ENV=production
```

## CI/CD Pipeline

The GitHub Actions workflow automatically:
- Builds all three microservices in parallel
- Supports multi-platform builds (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry
- Uses layer caching for optimized builds
- Triggers on push to main and pull requests

### Registry Images

Production images are available at:
- `ghcr.io/12szf2/indicator_backend-main-service:latest`
- `ghcr.io/12szf2/indicator_backend-login-service:latest`
- `ghcr.io/12szf2/indicator_backend-gateway-service:latest`

## Development Workflow

### Local Development

```bash
# Start all services with hot reload
npm run docker:start:dev

# Or start individual services manually
npm run dev:login    # Login service
npm run dev:gateway  # Gateway service  
npm run dev:main     # Main service
```

### Service URLs

When running locally:
- 🌐 **API Gateway**: http://localhost:5000
- 🔐 **Login Service**: http://localhost:5301
- ⚙️ **Main Service**: http://localhost:5300

### Health Checks

All services provide health endpoints:

```bash
# Gateway health
curl http://localhost:5000/health/basic

# Login service health
curl http://localhost:5301/health/basic

# Main service health
curl http://localhost:5300/health
```

## Production Deployment

### Using Docker Compose

```bash
# Production deployment
docker compose up -d

# With custom environment
docker compose --env-file .env.prod up -d
```

### Using Pre-built Images

```yaml
services:
  gateway:
    image: ghcr.io/12szf2/indicator_backend-gateway-service:latest
    # ... configuration
  
  login-service:
    image: ghcr.io/12szf2/indicator_backend-login-service:latest
    # ... configuration
    
  main-service:
    image: ghcr.io/12szf2/indicator_backend-main-service:latest
    # ... configuration
```

## File Structure

```
├── docker-compose.yml         # Production deployment
├── docker-compose.dev.yml     # Development with hot reload
├── build.js                   # Build automation script
├── setup.sh                   # Quick setup (Linux/macOS)
├── setup.bat                  # Quick setup (Windows)
├── .env.docker               # Environment template
├── .dockerignore             # Docker build optimization
├── DOCKER_DEPLOYMENT.md      # Comprehensive deployment guide
│
├── .github/workflows/
│   └── Build and containerize.yaml  # CI/CD pipeline
│
├── gateway_service/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
│
├── login_service/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
│
└── Dockerfile                # Main service
```

## Optimization Features

- **Multi-stage builds**: Reduced image sizes
- **Layer caching**: Faster builds with GitHub Actions cache
- **.dockerignore**: Optimized build contexts
- **Alpine images**: Lightweight base images
- **Health checks**: Automatic service monitoring
- **Parallel builds**: All services build simultaneously

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5000, 5300, 5301 are available
2. **Environment variables**: Check `.env` file configuration
3. **Docker daemon**: Ensure Docker is running

### Debug Commands

```bash
# Check running containers
docker ps

# View all service logs
docker compose logs -f

# Check specific service
docker compose logs gateway

# Restart service
docker compose restart login-service

# Validate configuration
docker compose config
```

### Service Communication

Test inter-service communication:

```bash
# Through gateway
curl http://localhost:5000/api/v1/auth/health

# Direct service access
curl http://localhost:5301/health
curl http://localhost:5300/health
```

## Migration from Monolith

To migrate from the previous monolithic setup:

1. **Update frontend**: Change API base URL to gateway (port 5000)
2. **Environment**: Split configuration per service
3. **Authentication**: Use JWT tokens from login service
4. **Database**: Ensure all services can access the database

## Performance & Security

### Performance Optimizations
- Connection pooling for database
- Layer caching in builds
- Optimized Docker images
- Health check monitoring

### Security Features
- JWT secret management
- Network isolation between services
- HTTPS support in production
- Environment variable protection

## Documentation

- 📚 **[Complete Deployment Guide](DOCKER_DEPLOYMENT.md)** - Comprehensive setup and deployment instructions
- 🏗️ **[Microservices Guide](MICROSERVICES_DEPLOYMENT.md)** - Architecture and service details
- 🔧 **[Implementation Details](MICROSERVICE_IMPLEMENTATION.md)** - Technical implementation guide

---

**Need Help?** Check the troubleshooting section or review service logs with `docker compose logs -f`