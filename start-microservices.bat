@echo off
echo 🚀 Starting Indicator Microservices...
echo.

echo Installing dependencies if needed...
call npm install

echo.
echo Starting microservices...
call npm run microservices

pause
