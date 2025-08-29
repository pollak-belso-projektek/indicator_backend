@echo off
REM Quick Setup Script for Indicator Microservices (Windows)
REM This script helps set up the development environment quickly

echo 🚀 Setting up Indicator Microservices Development Environment...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not available. Please install Docker Compose.
    pause
    exit /b 1
)

echo ✅ Docker and Docker Compose are available

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.docker .env >nul
    echo ⚠️  Please update the .env file with your actual database credentials and secrets
) else (
    echo ✅ .env file already exists
)

REM Install dependencies for all services
echo.
echo 📦 Installing dependencies for all services...
call npm run build

REM Build Docker images
echo.
echo 🐳 Building Docker images...
call npm run build:docker

echo.
echo 🎉 Setup complete!
echo.
echo 📋 Next steps:
echo    1. Update .env file with your database credentials
echo    2. Start development: npm run docker:start:dev
echo    3. Start production: npm run docker:start
echo.
echo 🌐 Service URLs (when running):
echo    - API Gateway: http://localhost:5000
echo    - Login Service: http://localhost:5301
echo    - Main Service: http://localhost:5300
echo.
echo 🔧 Useful commands:
echo    - npm run docker:stop        # Stop all services
echo    - npm run build:docker       # Rebuild Docker images
echo    - docker compose logs -f     # View all service logs
echo.
pause