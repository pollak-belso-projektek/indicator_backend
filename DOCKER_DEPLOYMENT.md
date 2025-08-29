# Microservices Docker Deployment Guide

This guide covers building and deploying the Indicator Backend microservices architecture using Docker and containerization.

## Architecture Overview

The application consists of three microservices:

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

### Services

1. **API Gateway** (`gateway_service/`) - Port 5000
   - Central entry point for all requests
   - Request routing and load balancing
   - Authentication middleware
   - Rate limiting and CORS handling

2. **Login Service** (`login_service/`) - Port 5301
   - Dedicated authentication microservice
   - JWT token management
   - User authentication and authorization

3. **Main Service** (root directory) - Port 5300
   - Core business logic
   - Database operations
   - API endpoints for core functionality

## Quick Start

### Option 1: Using Build Script (Recommended)

The build script provides easy commands for all deployment scenarios:

```bash
# Install dependencies for all services
npm run build

# Build all Docker images
npm run build:docker

# Start all services in production mode
npm run docker:start

# Start all services in development mode (with hot reload)
npm run docker:start:dev

# Stop all services
npm run docker:stop
```

### Option 2: Using Docker Compose Directly

```bash
# Production deployment
docker compose up -d

# Development deployment with hot reload
docker compose -f docker-compose.dev.yml up -d

# Stop services
docker compose down
```

### Option 3: Manual Service Startup

```bash
# Terminal 1 - Login Service
cd login_service && npm run dev

# Terminal 2 - Gateway Service  
cd gateway_service && npm run dev

# Terminal 3 - Main Service
npm run dev
```

## Build Script Commands

The `build.js` script provides comprehensive build and deployment commands:

```bash
# Build commands
node build.js build          # Install dependencies for all services
node build.js docker         # Build all Docker images
node build.js production     # Build and push to registry

# Service management
node build.js start          # Start in production mode
node build.js start development  # Start in development mode
node build.js stop           # Stop all services

# Help
node build.js help           # Show all available commands
```

### Examples

```bash
# Build specific version for production
node build.js production v1.2.0

# Start services in development mode
node build.js start development

# Build Docker images with custom tag
node build.js docker beta
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/indicator_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Service URLs (for inter-service communication)
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300

# CORS Configuration
CORS_ORIGINS=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Environment
NODE_ENV=production
```

### Service-Specific Configuration

Each service can have its own `.env` file:

- `login_service/.env` - Login service specific config
- `gateway_service/.env` - Gateway service specific config
- `.env` - Main service and shared config

## Docker Images

### Manual Docker Build

Build individual services:

```bash
# Main Service
docker build -t indicator-main:latest .

# Login Service
docker build -t indicator-login:latest ./login_service

# Gateway Service
docker build -t indicator-gateway:latest ./gateway_service
```

### Registry Images

Images are automatically built and pushed to GitHub Container Registry:

- `ghcr.io/12szf2/indicator_backend-main-service:latest`
- `ghcr.io/12szf2/indicator_backend-login-service:latest`
- `ghcr.io/12szf2/indicator_backend-gateway-service:latest`

## GitHub Actions CI/CD

The repository includes automated building and deployment:

### Workflow Features

- **Multi-platform builds**: linux/amd64, linux/arm64
- **Parallel builds**: All three services build simultaneously
- **Layer caching**: Optimized build times with GitHub Actions cache
- **Automatic tagging**: Based on branch, PR, and commit SHA
- **Security**: Uses GitHub Container Registry with proper authentication

### Workflow Triggers

- **Push to main**: Builds and pushes all images with `latest` tag
- **Pull Requests**: Builds images for testing (doesn't push)
- **Manual dispatch**: Can be triggered manually from GitHub Actions UI

## Production Deployment

### Using Pre-built Images

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  gateway:
    image: ghcr.io/12szf2/indicator_backend-gateway-service:latest
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      # ... other env vars

  login-service:
    image: ghcr.io/12szf2/indicator_backend-login-service:latest
    ports:
      - "5301:5301"
    environment:
      - NODE_ENV=production
      # ... other env vars

  main-service:
    image: ghcr.io/12szf2/indicator_backend-main-service:latest
    ports:
      - "5300:5300"
    environment:
      - NODE_ENV=production
      # ... other env vars
```

### Kubernetes Deployment

Example Kubernetes manifests:

```yaml
# gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gateway-service
  template:
    metadata:
      labels:
        app: gateway-service
    spec:
      containers:
      - name: gateway
        image: ghcr.io/12szf2/indicator_backend-gateway-service:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        # ... other env vars
```

### Health Checks

All services include health check endpoints:

```bash
# Gateway Service
curl http://localhost:5000/health/basic

# Login Service  
curl http://localhost:5301/health/basic

# Main Service
curl http://localhost:5300/health
```

## Development Workflow

### Local Development with Hot Reload

```bash
# Start all services with hot reload
npm run docker:start:dev

# Or start individual services
npm run dev:gateway
npm run dev:login  
npm run dev:main
```

### Testing Service Communication

```bash
# Test gateway routing
curl http://localhost:5000/api/v1/auth/health

# Test direct service access
curl http://localhost:5301/health
curl http://localhost:5300/health
```

## Monitoring and Logging

### Service URLs

When running, access services at:

- 🌐 **API Gateway**: http://localhost:5000
- 🔐 **Login Service**: http://localhost:5301  
- ⚙️ **Main Service**: http://localhost:5300

### Health Monitoring

All services provide health endpoints for monitoring:

```bash
# Comprehensive health check through gateway
curl http://localhost:5000/health

# Individual service health
curl http://localhost:5301/health/basic
curl http://localhost:5300/health
```

### Logs

View logs for all services:

```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f gateway
docker compose logs -f login-service
docker compose logs -f main-service
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5000, 5300, 5301 are available
2. **Database connection**: Verify DATABASE_URL is correct and database is accessible
3. **JWT secrets**: Ensure JWT_SECRET matches across all services
4. **Service communication**: Check network connectivity between services

### Debug Commands

```bash
# Check running containers
docker ps

# Check service health
docker compose exec gateway curl http://localhost:5000/health/basic

# View service logs
docker compose logs gateway

# Restart specific service
docker compose restart login-service
```

### Environment Issues

```bash
# Validate environment variables
docker compose config

# Check service environment
docker compose exec gateway printenv
```

## Migration from Monolith

If migrating from a monolithic deployment:

1. **Update frontend**: Change API base URL to gateway (port 5000)
2. **Environment variables**: Split configuration per service
3. **Database**: Ensure all services can access database
4. **Authentication**: Update to use JWT tokens from login service

## Performance Optimization

### Docker Optimizations

- **Multi-stage builds**: Reduce image size
- **Layer caching**: Optimize build order
- **.dockerignore**: Exclude unnecessary files
- **Alpine images**: Use lightweight base images

### Service Optimizations

- **Connection pooling**: Configure database connection pools
- **Caching**: Implement Redis for session/cache storage
- **Load balancing**: Use multiple instances behind load balancer
- **Resource limits**: Set appropriate CPU and memory limits

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **JWT Secrets**: Use strong, unique secrets for each environment
3. **Network Security**: Use internal networks for service communication
4. **HTTPS**: Enable TLS in production
5. **Database Security**: Use secure connection strings and proper authentication

## Support

For issues or questions:

1. Check service logs: `docker compose logs [service-name]`
2. Verify health endpoints: `curl http://localhost:[port]/health`
3. Review environment configuration
4. Check GitHub Issues for known problems

---

**Note**: This deployment guide assumes you have Docker and Docker Compose V2 installed. For production deployments, consider using orchestration tools like Kubernetes or Docker Swarm for better scalability and management.