#!/bin/bash

# Quick Setup Script for Indicator Microservices
# This script helps set up the development environment quickly

set -e

echo "🚀 Setting up Indicator Microservices Development Environment..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env
    echo "⚠️  Please update the .env file with your actual database credentials and secrets"
else
    echo "✅ .env file already exists"
fi

# Install dependencies for all services
echo ""
echo "📦 Installing dependencies for all services..."
npm run build

# Build Docker images
echo ""
echo "🐳 Building Docker images..."
npm run build:docker

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update .env file with your database credentials"
echo "   2. Start development: npm run docker:start:dev"
echo "   3. Start production: npm run docker:start"
echo ""
echo "🌐 Service URLs (when running):"
echo "   - API Gateway: http://localhost:5000"
echo "   - Login Service: http://localhost:5301"
echo "   - Main Service: http://localhost:5300"
echo ""
echo "🔧 Useful commands:"
echo "   - npm run docker:stop        # Stop all services"
echo "   - npm run build:docker       # Rebuild Docker images"
echo "   - docker compose logs -f     # View all service logs"