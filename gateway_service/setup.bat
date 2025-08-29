@echo off
REM Setup script for the API Gateway (Windows)
echo 🚀 Setting up API Gateway...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the gateway_service directory.
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

echo.
echo 🎉 API Gateway setup complete!
echo.
echo 📋 Next steps:
echo    1. Update the .env file with your actual configuration
echo    2. Ensure login and main services are running
echo    3. Start the gateway with: npm run dev
echo.
echo 🌐 The gateway will be available at: http://localhost:5000
echo 📚 API documentation will be at: http://localhost:5000/api-docs
echo.
echo 🔗 Service routing:
echo    • /api/v1/auth/* → Login Service (Port 5301)
echo    • /api/v1/* → Main Service (Port 5300)
