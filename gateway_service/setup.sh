#!/bin/bash

# Setup script for the API Gateway
echo "🚀 Setting up API Gateway..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the gateway_service directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists, if not copy from example
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual configuration values."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 API Gateway setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update the .env file with your actual configuration"
echo "   2. Ensure login and main services are running"
echo "   3. Start the gateway with: npm run dev"
echo ""
echo "🌐 The gateway will be available at: http://localhost:5000"
echo "📚 API documentation will be at: http://localhost:5000/api-docs"
echo ""
echo "🔗 Service routing:"
echo "   • /api/v1/auth/* → Login Service (Port 5301)"
echo "   • /api/v1/* → Main Service (Port 5300)"
