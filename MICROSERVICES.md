# Microservices Startup Guide

This project now supports a microservices architecture with the following services:

## Services

1. **Login Service** (Port 5301) - Handles authentication
2. **API Gateway** (Port 5000) - Routes requests to appropriate services
3. **Main Service** (Port 5300) - Core business logic (optional)

## Quick Start Commands

### Option 1: NPM Scripts (Recommended)

```bash
# Start only the microservices (Login + Gateway)
npm run microservices

# Start microservices in development mode
npm run microservices:dev

# Start all services including main backend
npm run start:all

# Start all services in development mode
npm run start:all:dev
```

### Option 2: Individual Services

```bash
# Start individual services
npm run start:login    # Login service on port 5301
npm run start:gateway  # Gateway service on port 5000
npm run start:main     # Main service on port 5300

# Development mode
npm run dev:login
npm run dev:gateway
npm run dev:main
```

### Option 3: PowerShell Script (Windows)

```powershell
# Run the PowerShell script (opens each service in separate windows)
.\start-microservices.ps1
```

## Service URLs

- **API Gateway**: http://localhost:5000

  - Authentication: `POST /api/v1/auth/login`
  - All API routes: `GET|POST|PUT|DELETE /api/v1/*`
  - Documentation: http://localhost:5000/api-docs
  - Health: http://localhost:5000/health

- **Login Service**: http://localhost:5301 (direct access)

  - Authentication: `POST /api/v1/auth/login`
  - Documentation: http://localhost:5301/api-docs
  - Health: http://localhost:5301/health/basic

- **Main Service**: http://localhost:5300 (when running)
  - All business logic endpoints
  - Health: http://localhost:5300/health/basic

## Architecture Flow

```
Frontend → API Gateway (5000) → Login Service (5301)
                              → Main Service (5300)
```

All authentication requests (`/api/v1/auth/*`) are automatically routed to the Login Service.
All other API requests (`/api/v1/*`) are routed to the Main Service.

## Development Tips

1. **For frontend development**: Use only the microservices: `npm run microservices:dev`
2. **For full backend development**: Use all services: `npm run start:all:dev`
3. **For testing**: Start services individually to isolate issues

## Environment Variables

Make sure you have the following in your `.env` files:

```env
# Gateway Service
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300

# Login Service
DATABASE_URL=your_database_url
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Main Service
DATABASE_URL=your_database_url
LOGIN_SERVICE_URL=http://localhost:5301
```
