# KrakenD + Observability Stack

Complete production-ready API Gateway powered by KrakenD with full observability stack (ELK + Grafana + InfluxDB).

## 🚀 Quick Start

### Prerequisites

- Docker Desktop with at least **12GB RAM** allocated
- Docker Compose v2.x
- Ports available: 3000, 5000, 5044, 5300, 5301, 5432, 5601, 5672, 6379, 8080, 8086, 8090, 9200, 15672

### Start the Full Stack

```bash
# Copy environment file
copy .env.krakend .env

# Start all services
docker compose -f docker-compose.krakend.yml up -d

# Watch logs
docker compose -f docker-compose.krakend.yml logs -f
```

### Verify Services

```bash
# Check all services are running
docker compose -f docker-compose.krakend.yml ps

# Test the gateway
curl http://localhost:5000/health
```

## 📊 Service URLs

| Service                 | URL                             | Credentials             |
| ----------------------- | ------------------------------- | ----------------------- |
| **KrakenD Gateway**     | http://localhost:5000           | N/A                     |
| **KrakenD Metrics**     | http://localhost:8090/\_\_stats | N/A                     |
| **Grafana Dashboards**  | http://localhost:3000           | admin / admin           |
| **Kibana Logs**         | http://localhost:5601           | N/A                     |
| **RabbitMQ Management** | http://localhost:15672          | admin / admin           |
| **pgAdmin**             | http://localhost:8080           | admin@admin.com / admin |
| **InfluxDB**            | http://localhost:8086           | admin / adminpassword   |

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│   Port 5173     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   KrakenD API Gateway                   │
│   Port 5000                             │
│   • Rate Limiting                       │
│   • Circuit Breakers                    │
│   • CORS                                │
│   • Logging → Logstash                  │
│   • Metrics → InfluxDB                  │
└────────┬────────────────┬───────────────┘
         │                │
         ▼                ▼
┌──────────────┐   ┌──────────────┐
│ Login Service│   │ Main Service │
│  Port 5301   │   │  Port 5300   │
└──────┬───────┘   └──────┬───────┘
       │                  │
       └──────┬───────────┘
              ▼
    ┌────────────────────┐
    │   PostgreSQL       │
    │   Port 5432        │
    └────────────────────┘
              │
              ▼
    ┌────────────────────┐
    │   Redis Cache      │
    │   Port 6379        │
    └────────────────────┘
              │
              ▼
    ┌────────────────────┐
    │   RabbitMQ         │
    │   Ports 5672/15672 │
    └────────────────────┘

┌─────────────────── Observability ────────────────────┐
│                                                       │
│  ┌──────────────┐     ┌──────────────┐              │
│  │  Logstash    │────▶│ ElasticSearch│──┐           │
│  │  Port 5044   │     │  Port 9200   │  │           │
│  └──────────────┘     └──────────────┘  │           │
│                                          │           │
│                               ┌──────────▼────────┐  │
│                               │     Kibana        │  │
│                               │    Port 5601      │  │
│                               └───────────────────┘  │
│                                                      │
│  ┌──────────────┐     ┌──────────────┐              │
│  │  Telegraf    │────▶│   InfluxDB   │──┐           │
│  │              │     │  Port 8086   │  │           │
│  └──────────────┘     └──────────────┘  │           │
│                                          │           │
│                               ┌──────────▼────────┐  │
│                               │     Grafana       │  │
│                               │    Port 3000      │  │
│                               └───────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## 🔧 Configuration

### KrakenD Configuration

Edit `krakend/krakend.json` to:

- Add/modify API endpoints
- Configure rate limits
- Set up circuit breakers
- Add backend services

**Validate configuration:**

```bash
docker run --rm -v "%cd%\krakend:/etc/krakend" devopsfaith/krakend:latest check -c /etc/krakend/krakend.json
```

### Observability

**Logs (Kibana):**

1. Open http://localhost:5601
2. Create index pattern: `indicator-logs-*`
3. Explore logs with filters and queries

**Metrics (Grafana):**

1. Open http://localhost:3000
2. Login with admin/admin
3. Dashboards are auto-provisioned
4. Create custom dashboards as needed

**RabbitMQ:**

1. Open http://localhost:15672
2. Login with admin/admin
3. View queues, exchanges, and messages

## 📈 Monitoring

### Key Metrics

** KrakenD Gateway:**

- Request rate by endpoint
- Response times (p50, p95, p99)
- Error rates
- Circuit breaker status

**Services:**

- Health check status
- Response times
- Error rates
- CPU and memory usage

**Infrastructure:**

- Database connection pool
- Redis hit/miss rate
- RabbitMQ queue depths
- System resources

### Logs

**Available log fields:**

- `request_id` - Trace requests across services
- `service` - Which service generated the log
- `endpoint` - API endpoint called
- `status_code` - HTTP status
- `response_time_ms` - Response time
- `user_id` - Authenticated user
- `error_message` - Error details

## 🚦 Health Checks

Check individual service health:

```bash
# KrakenD
curl http://localhost:8090/__health

# Login Service
curl http://localhost:5301/health/basic

# Main Service
curl http://localhost:5300/health

# PostgreSQL
docker exec indicator-postgres pg_isready

# Redis
docker exec indicator-redis redis-cli ping

# RabbitMQ
curl -u admin:admin http://localhost:15672/api/healthchecks/node

# ElasticSearch
curl http://localhost:9200/_cluster/health
```

## 🔄 Migration from Express Gateway

The KrakenD gateway is a **drop-in replacement** for the Express gateway:

**Same:**

- ✅ Port 5000 (no frontend changes needed)
- ✅ All API endpoints remain the same
- ✅ JWT authentication (validated by backend services)
- ✅ CORS configuration
- ✅ Rate limiting

**New/Improved:**

- ⚡ Better performance (Go-based)
- 🛡️ Built-in circuit breakers
- 📊 Automatic metrics collection
- 📝 Structured logging to ELK
- 🔍 Centralized observability

## 🧪 Testing

### Load Testing

```bash
# Install k6 (if not already)
choco install k6  # Windows

# Run load test
k6 run tests/load/krakend.js
```

### API Testing

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Get data (with JWT)
curl http://localhost:5000/api/v1/students \
  -H "Authorization: Bearer <your_jwt_token>"
```

## 🛑 Stopping Services

```bash
# Stop all services
docker compose -f docker-compose.krakend.yml down

# Stop and remove volumes (WARNING: Deletes all data)
docker compose -f docker-compose.krakend.yml down -v
```

## 📦 Production Deployment

### Security Checklist

- [ ] Change all default passwords in `.env` file
- [ ] Use strong JWT secrets (minimum 32 characters)
- [ ] Enable TLS/SSL for public endpoints
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Review and adjust rate limits
- [ ] Enable authentication for admin UIs (Kibana, Grafana)
- [ ] Set up log retention policies
- [ ] Configure backup strategy for PostgreSQL

### Resource Requirements

**Minimum (Development):**

- 12GB RAM
- 4 CPU cores
- 20GB disk space

**Recommended (Production):**

- 16GB+ RAM
- 8+ CPU cores
- 50GB+ SSD storage
- Separate volumes for database and logs

## 🐛 Troubleshooting

### Services won't start

```bash
# Check Docker resources
docker system df

# View specific service logs
docker compose -f docker-compose.krakend.yml logs <service-name>

# Restart a specific service
docker compose -f docker-compose.krakend.yml restart <service-name>
```

### KrakenD configuration errors

```bash
# Validate configuration
docker run --rm -v "%cd%\krakend:/etc/krakend" devopsfaith/krakend:latest check -c /etc/krakend/krakend.json

# Check KrakenD logs
docker compose -f docker-compose.krakend.yml logs krakend
```

### Logs not appearing in Kibana

1. Check Logstash is running: `docker ps | findstr logstash`
2. Check ElasticSearch health: `curl http://localhost:9200/_cluster/health`
3. Verify index exists: `curl http://localhost:9200/_cat/indices`
4. Check Logstash logs: `docker compose -f docker-compose.krakend.yml logs logstash`

### Metrics not showing in Grafana

1. Check InfluxDB is running: `curl http://localhost:8086/health`
2. Verify Telegraf is collecting: `docker compose -f docker-compose.krakend.yml logs telegraf`
3. Check Grafana datasource configuration
4. Verify data in InfluxDB: `curl "http://localhost:8086/api/v2/query?org=indicator"`

## 📚 Additional Resources

- [KrakenD Documentation](https://www.krakend.io/docs/overview/introduction/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Kibana Guide](https://www.elastic.co/guide/en/kibana/current/index.html)
- [RabbitMQ Tutorial](https://www.rabbitmq.com/getstarted.html)

## 🤝 Next Steps

1. ✅ Start the stack and verify all services
2. ✅ Configure Grafana dashboards
3. ✅ Set up Kibana index patterns
4. ✅ Test API endpoints through KrakenD
5. ⏭️ Split Main Service into microservices (Phase 2)
6. ⏭️ Add custom metrics and alerts
7. ⏭️ Consider Keycloak migration (Phase 3)
8. ⏭️ Consider TypeScript migration (Phase 4)
