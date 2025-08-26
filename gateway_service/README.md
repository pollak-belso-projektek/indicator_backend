# API Gateway Service

A centralized API Gateway that routes requests to the appropriate microservices in the Indicator application.

## Features

- **Request Routing**: Routes requests to login service and main service
- **Authentication Middleware**: Validates JWT tokens
- **Rate Limiting**: Protects services from abuse
- **Health Monitoring**: Monitors service health
- **Load Balancing**: Basic load balancing capabilities
- **CORS Handling**: Centralized CORS configuration
- **API Documentation**: Unified Swagger documentation
- **Request/Response Logging**: Comprehensive logging

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway    │
│   (Port 5173)   │───▶│   (Port 5000)   │
└─────────────────┘    └─────────┬───────┘
                                 │
                   ┌─────────────┼─────────────┐
                   ▼             ▼             ▼
         ┌─────────────────┐ ┌─────────────────┐
         │ Login Service   │ │  Main Service   │
         │   (Port 5301)   │ │   (Port 5300)   │
         └─────────────────┘ └─────────────────┘
```

## Routing Rules

- `/api/v1/auth/*` → Login Service (Port 5301)
- `/api/v1/*` → Main Service (Port 5300)
- `/health/*` → Gateway Health + Service Health
- `/api-docs` → Unified API Documentation

## Environment Variables

```
PORT=5000
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:5173,https://yourapp.com
```

## Running the Gateway

```bash
# Development
npm run dev

# Production
npm start
```

## Endpoints

- `GET /` - Gateway information
- `GET /health` - Gateway and services health
- `GET /api-docs` - Unified API documentation
- `POST /api/v1/auth/*` - Authentication (→ Login Service)
- `GET|POST|PUT|DELETE /api/v1/*` - Main API (→ Main Service)
