# Indicator Backend - Microservices Architecture

A Node.js backend application that has been refactored into a microservices architecture for better scalability and maintainability.

## Quick Start

### 🚀 Start All Microservices (Recommended)

```bash
# Start all services (Login + Gateway + Main Service)
npm run start:all:script

# Or using concurrently
npm run start:all
npm run start:all:dev

# Start just microservices (Login + Gateway only)
npm run microservices
npm run microservices:dev
```

### 🖱️ One-Click Start (Windows)

Double-click `start-microservices.bat` or run:

```powershell
.\start-microservices.ps1
```

## Services Overview

| Service           | Port | Purpose                         | URL                   |
| ----------------- | ---- | ------------------------------- | --------------------- |
| **API Gateway**   | 5000 | Routes requests to services     | http://localhost:5000 |
| **Login Service** | 5301 | Authentication & JWT management | http://localhost:5301 |
| **Main Service**  | 5300 | Core business logic             | http://localhost:5300 |

## API Usage

All requests should go through the **API Gateway** (port 5000):

```bash
# Authentication
POST http://localhost:5000/api/v1/auth/login
POST http://localhost:5000/api/v1/auth/refresh

# All other API endpoints
GET http://localhost:5000/api/v1/your-endpoints
```

## Available Commands

````bash
# All services (recommended for full development)
npm run start:all:script       # All services with enhanced startup script
npm run start:all              # All services with concurrently
npm run start:all:dev          # All services in development mode

# Microservices only (recommended for frontend development)
npm run microservices          # Login + Gateway (production mode)
npm run microservices:dev      # Login + Gateway (development mode)

# Individual services
npm run start:login            # Login service only
npm run start:gateway          # Gateway only
npm run start:main             # Main service only
```## Documentation

- **API Gateway Docs**: http://localhost:5000/api-docs
- **Login Service Docs**: http://localhost:5301/api-docs
- **Health Checks**: http://localhost:5000/health

## Architecture

````

Frontend Application
↓
API Gateway (5000)
↓ ↓
Login Service Main Service
(5301) (5300)
↓ ↓
Database Database

````

## Environment Setup

1. **Install dependencies**:

   ```bash
   npm install
   cd login_service && npm install
   cd ../gateway_service && npm install
````

2. **Configure environment variables**:

   - Copy `.env.example` to `.env` in each service directory
   - Update database connections and JWT secrets

3. **Database setup**:

   ```bash
   # Run Prisma migrations
   npx prisma migrate dev
   ```

4. **Start services**:
   ```bash
   npm run microservices
   ```

## Development

- Use `npm run microservices:dev` for hot reloading during development
- Each service runs independently and can be started/stopped individually
- The API Gateway automatically routes requests to the appropriate service

## Troubleshooting

If you encounter issues:

1. **Port conflicts**: Check if ports 5000, 5301, or 5300 are in use
2. **Database connection**: Verify your DATABASE_URL in `.env` files
3. **Service health**: Check http://localhost:5000/health for service status

For more detailed information, see [MICROSERVICES.md](./MICROSERVICES.md).
