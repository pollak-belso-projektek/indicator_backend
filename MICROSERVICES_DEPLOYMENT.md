# Indicator Microservices Architecture Deployment Guide

## Overview

The Indicator application has been successfully transformed from a monolithic architecture to a microservices architecture with an API Gateway pattern.

## New Architecture

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

## Services

### 1. API Gateway (Port 5000)

- **Purpose**: Central entry point for all client requests
- **Features**: Request routing, authentication, rate limiting, health monitoring
- **Routes**:
  - `/api/v1/auth/*` → Login Service
  - `/api/v1/*` → Main Service
  - `/health` → Gateway health + service monitoring
  - `/api-docs` → Unified API documentation

### 2. Login Service (Port 5301)

- **Purpose**: Dedicated authentication microservice
- **Features**: User login, JWT token management, password verification
- **Database**: Shares the same PostgreSQL database (users table only)

### 3. Main Service (Port 5300)

- **Purpose**: Core business logic and data operations
- **Features**: All existing API endpoints except authentication
- **Database**: Full PostgreSQL database access

## Quick Start

### Option 1: Manual Setup

1. **Start all services individually:**

```bash
# Terminal 1 - Login Service
cd login_service
npm run dev

# Terminal 2 - Main Service
cd .. # back to main backend
npm run dev

# Terminal 3 - API Gateway
cd gateway_service
npm run dev
```

2. **Update your frontend to use the gateway:**

```javascript
// Change API base URL from:
const API_BASE = "http://localhost:5300";

// To:
const API_BASE = "http://localhost:5000";
```

### Option 2: Docker Compose

```bash
cd gateway_service
docker-compose up -d
```

This starts all three services with proper networking.

## Service Endpoints

### API Gateway (http://localhost:5000)

- `GET /` - Gateway information
- `GET /health` - Complete health check
- `GET /api-docs` - Unified documentation
- `POST /api/v1/auth/login` - Login (→ Login Service)
- `POST /api/v1/auth/refresh` - Refresh token (→ Login Service)
- `GET|POST|PUT|DELETE /api/v1/*` - All other API calls (→ Main Service)

### Login Service (http://localhost:5301)

- `GET /health` - Service health
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api-docs` - Login service documentation

### Main Service (http://localhost:5300)

- `GET /health` - Service health
- `GET /api/v1/*` - All business logic endpoints
- `GET /api-docs` - Main service documentation

## Environment Configuration

### Gateway Service (.env)

```env
PORT=5000
LOGIN_SERVICE_URL=http://localhost:5301
MAIN_SERVICE_URL=http://localhost:5300
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:5173
```

### Login Service (.env)

```env
PORT=5301
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

### Main Service (.env)

```env
PORT=5300
DATABASE_URL=postgresql://...
LOGIN_SERVICE_URL=http://localhost:5301
JWT_SECRET=your_jwt_secret
```

## Migration from Monolith

### What Changed:

1. **Client Integration**: Frontend now calls gateway (port 5000) instead of main service (port 5300)
2. **Authentication**: Moved to dedicated login service
3. **Request Flow**: All requests go through gateway for routing
4. **Health Monitoring**: Centralized health checks via gateway

### What Stayed the Same:

1. **Database Schema**: No changes required
2. **API Contracts**: All endpoints maintain same request/response format
3. **Authentication Tokens**: Same JWT format and validation
4. **Business Logic**: Unchanged in main service

## Benefits

### Scalability

- **Independent Scaling**: Each service can be scaled separately
- **Resource Optimization**: Scale only what needs more resources
- **Load Distribution**: Gateway can distribute load across multiple instances

### Reliability

- **Service Isolation**: Failure in one service doesn't affect others
- **Circuit Breaker**: Gateway stops routing to unhealthy services
- **Graceful Degradation**: System can continue operating with reduced functionality

### Development

- **Team Independence**: Teams can develop services independently
- **Technology Flexibility**: Each service can use different technologies
- **Faster Deployments**: Deploy individual services without affecting others

### Security

- **Centralized Authentication**: Single point for auth validation
- **Rate Limiting**: Protection against abuse at gateway level
- **Request Logging**: Centralized logging for all requests

## Monitoring and Health Checks

### Gateway Health Dashboard

Visit `http://localhost:5000/health` to see:

- Gateway status
- All registered services status
- Response times
- Service availability

### Individual Service Health

- Login Service: `http://localhost:5301/health`
- Main Service: `http://localhost:5300/health`

### Automated Health Checks

The gateway automatically monitors service health every 30 seconds and routes traffic only to healthy services.

## Production Deployment

### Recommended Setup:

1. **Load Balancer** → Multiple Gateway Instances
2. **Gateway Instances** → Multiple Service Instances
3. **Database Cluster** with read replicas
4. **Redis Cache** for session management
5. **Message Queue** for inter-service communication

### Scaling Strategy:

- **Gateway**: 2-3 instances behind load balancer
- **Login Service**: 2-3 instances (stateless)
- **Main Service**: 3-5 instances based on load
- **Database**: Master-slave setup with read replicas

## Troubleshooting

### Common Issues:

1. **Services not communicating:**

   - Check service URLs in environment variables
   - Verify all services are running
   - Check network connectivity

2. **Authentication errors:**

   - Ensure JWT_SECRET is same across all services
   - Check token format and expiration
   - Verify login service is healthy

3. **Gateway routing issues:**
   - Check service registration in gateway
   - Verify health checks are passing
   - Check request paths and routing rules

### Debug Commands:

```bash
# Check all services are running
curl http://localhost:5000/health

# Check individual service health
curl http://localhost:5301/health/basic
curl http://localhost:5300/health/basic

# Test authentication flow
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Next Steps

### Potential Enhancements:

1. **Service Mesh**: Implement Istio or Linkerd for advanced traffic management
2. **Message Queues**: Add RabbitMQ or Apache Kafka for async communication
3. **Caching Layer**: Redis for distributed caching
4. **Monitoring**: Prometheus + Grafana for metrics
5. **Logging**: ELK stack for centralized logging
6. **Security**: OAuth 2.0, API versioning, request validation

### Additional Microservices:

Consider extracting these domains into separate services:

- **Notification Service**: Email/SMS notifications
- **File Service**: File upload/download handling
- **Analytics Service**: Data analytics and reporting
- **User Management Service**: User profiles and preferences

## Support

For issues with the microservices architecture:

1. Check service health endpoints
2. Review gateway logs for routing issues
3. Verify environment configuration
4. Test inter-service communication
