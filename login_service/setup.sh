#!/bin/bash

# Setup script for the login service
echo "🚀 Setting up Login Service..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the login_service directory."
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

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Check database connection (optional)
echo "🔍 Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;"; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Database connection failed. Please check your DATABASE_URL in .env"
fi

echo ""
echo "🎉 Login Service setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update the .env file with your actual configuration"
echo "   2. Ensure your database is running and accessible"
echo "   3. Start the service with: npm run dev"
echo ""
echo "🌐 The service will be available at: http://localhost:5301"
echo "📚 API documentation will be at: http://localhost:5301/api-docs"
