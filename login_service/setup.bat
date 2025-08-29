@echo off
REM Setup script for the login service (Windows)
echo 🚀 Setting up Login Service...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the login_service directory.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if .env file exists, if not copy from example
if not exist ".env" (
    echo 📝 Creating .env file from example...
    copy ".env.example" ".env"
    echo ⚠️  Please update the .env file with your actual configuration values.
) else (
    echo ✅ .env file already exists
)

REM Generate Prisma client
echo 🔧 Generating Prisma client...
npx prisma generate

echo.
echo 🎉 Login Service setup complete!
echo.
echo 📋 Next steps:
echo    1. Update the .env file with your actual configuration
echo    2. Ensure your database is running and accessible
echo    3. Start the service with: npm run dev
echo.
echo 🌐 The service will be available at: http://localhost:5301
echo 📚 API documentation will be at: http://localhost:5301/api-docs
