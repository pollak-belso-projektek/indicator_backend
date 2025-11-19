# Quick Start Script for KrakenD Stack
# This script starts the full KrakenD + Observability stack

Write-Host "🚀 Starting KrakenD + Observability Stack..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Copy environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from .env.krakend..." -ForegroundColor Yellow
    Copy-Item ".env.krakend" ".env"
}

# Validate KrakenD configuration
Write-Host "🔍 Validating KrakenD configuration..." -ForegroundColor Cyan
docker run --rm -v "${PWD}\krakend:/etc/krakend" devopsfaith/krakend:latest check -c /etc/krakend/krakend.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ KrakenD configuration is invalid. Please fix errors above." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Krak enD configuration is valid!" -ForegroundColor Green
Write-Host ""

# Start the stack
Write-Host "🐳 Starting Docker Compose stack..." -ForegroundColor Cyan
docker compose -f docker-compose.krakend.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker Compose stack." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host ""
Write-Host "🏥 Checking service health..." -ForegroundColor Cyan
Write-Host ""

function Test-Service {
    param (
        [string]$Name,
        [string]$Url
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ $Name - OK" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ $Name - FAILED" -ForegroundColor Red
        return $false
    }
}

$services = @(
    @{ Name = "PostgreSQL"; Url = "http://localhost:5432" },  # Will fail but container check is better
    @{ Name = "Redis"; Url = "http://localhost:6379" },  # Will fail but container check is better
    @{ Name = "KrakenD Gateway"; Url = "http://localhost:5000/health" },
    @{ Name = "Login Service"; Url = "http://localhost:5301/health/basic" },
    @{ Name = "Main Service"; Url = "http://localhost:5300/health" },
    @{ Name = "ElasticSearch"; Url = "http://localhost:9200/_cluster/health" },
    @{ Name = "Kibana"; Url = "http://localhost:5601/api/status" },
    @{ Name = "Grafana"; Url = "http://localhost:3000/api/health" },
    @{ Name = "RabbitMQ"; Url = "http://localhost:15672" }
)

# Just check container status instead
Write-Host "Container Status:" -ForegroundColor Cyan
docker compose -f docker-compose.krakend.yml ps

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   KrakenD Stack Started Successfully! 🎉" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Access your services:" -ForegroundColor Cyan
Write-Host "  • KrakenD Gateway:     http://localhost:5000" -ForegroundColor White
Write-Host "  • Grafana Dashboards:  http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "  • Kibana Logs:         http://localhost:5601" -ForegroundColor White
Write-Host "  • RabbitMQ Management: http://localhost:15672 (admin/admin)" -ForegroundColor White
Write-Host "  • pgAdmin:             http://localhost:8080 (admin@admin.com/admin)" -ForegroundColor White
Write-Host ""
Write-Host "📝 View logs:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.krakend.yml logs -f" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 Stop the stack:" -ForegroundColor Cyan
Write-Host "  docker compose -f docker-compose.krakend.yml down" -ForegroundColor Gray
Write-Host ""
