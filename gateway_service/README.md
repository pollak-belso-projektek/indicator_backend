# API Gateway Service

A centralized API Gateway that routes requests to the appropriate microservices in the Indicator application.

## Features

- **API Key Authentication**: Secure access control for frontend applications
- **Request Routing**: Routes requests to login service and main service
- **JWT Authentication**: Validates JWT tokens for user sessions
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
API_KEYS=your_secure_api_key_here,another_key_for_staging
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:5173,https://yourapp.com
```

## API Key Setup

### 1. Generate an API Key

```bash
npm run generate-api-key
```

This will generate a secure API key and show you how to configure it.

### 2. Configure Environment

Add the generated API key to your `.env` file:

```
API_KEYS=your_generated_api_key_here
```

### 3. Frontend Integration

Include the API key in your frontend requests:

```javascript
// Option 1: Using X-API-Key header
fetch("http://localhost:5000/api/v1/data", {
  headers: {
    "X-API-Key": "your_api_key_here",
    "Content-Type": "application/json",
  },
});

// Option 2: Using Authorization header
fetch("http://localhost:5000/api/v1/data", {
  headers: {
    Authorization: "Bearer your_api_key_here",
    "Content-Type": "application/json",
  },
});
```

### 4. Test API Key

```bash
npm run test-api-key
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
