# Login Service

A dedicated authentication microservice for the Indicator application.

## Features

- User authentication (login)
- Token refresh
- JWT token generation and validation
- Health check endpoints
- API documentation with Swagger

## Environment Variables

```
PORT=5301
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Endpoints

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /health` - Health check
- `GET /api-docs` - API documentation

## Running the Service

```bash
# Development
npm run dev

# Production
npm start
```

## Port

Default port: 5301 (to avoid conflicts with main backend on 5300)
