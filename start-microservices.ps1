# Microservices Startup Script for Windows
# Usage: .\start-microservices.ps1

Write-Host "🚀 Starting Indicator Microservices..." -ForegroundColor Green
Write-Host ""

# Function to start a service in a new PowerShell window
function Start-Service {
    param(
        [string]$Name,
        [string]$Path,
        [int]$Port,
        [string]$Color
    )
    
    Write-Host "[$Name] Starting on port $Port..." -ForegroundColor $Color
    
    $command = "cd '$Path'; npm start; Read-Host 'Press Enter to close this window'"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
}

# Start Login Service
Start-Service -Name "Login Service" -Path "$PSScriptRoot\login_service" -Port 5301 -Color "Cyan"
Start-Sleep -Seconds 3

# Start API Gateway
Start-Service -Name "API Gateway" -Path "$PSScriptRoot\gateway_service" -Port 5000 -Color "Magenta"
Start-Sleep -Seconds 3

# Start Main Service
Start-Service -Name "Main Service" -Path "$PSScriptRoot" -Port 5300 -Color "Yellow"

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Service URLs:" -ForegroundColor Yellow
Write-Host "   • API Gateway: http://localhost:5000" -ForegroundColor White
Write-Host "   • Login Service: http://localhost:5301" -ForegroundColor White
Write-Host "   • Main Service: http://localhost:5300" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   • Gateway Docs: http://localhost:5000/api-docs" -ForegroundColor White
Write-Host "   • Login Docs: http://localhost:5301/api-docs" -ForegroundColor White
Write-Host ""
Write-Host "💡 To stop all services, close the individual PowerShell windows." -ForegroundColor Blue
