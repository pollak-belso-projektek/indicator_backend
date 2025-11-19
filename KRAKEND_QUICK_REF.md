# KrakenD Stack - Quick Reference

## 🚀 Start/Stop Commands

```powershell
# Start the full stack
.\start-krakend.ps1

# Or manually
docker compose -f docker-compose.krakend.yml up -d

# Stop all services
docker compose -f docker-compose.krakend.yml down

# Stop and remove all data (WARNING: Deletes everything)
docker compose -f docker-compose.krakend.yml down -v

# Restart a specific service
docker compose -f docker-compose.krakend.yml restart krakend

# View logs
docker compose -f docker-compose.krakend.yml logs -f

# View specific service logs
docker compose -f docker-compose.krakend.yml logs -f krakend
```

## 🔍 Health Checks

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

# Rabbit MQ
curl -u admin:admin http://localhost:15672/api/healthchecks/node

# ElasticSearch
curl http://localhost:9200/_cluster/health

# InfluxDB
curl http://localhost:8086/health
```

## 🌐 Service URLs

| Service             | URL                             | Credentials             |
| ------------------- | ------------------------------- | ----------------------- |
| **API Gateway**     | http://localhost:5000           | -                       |
| **KrakenD Metrics** | http://localhost:8090/\_\_stats | -                       |
| **Grafana**         | http://localhost:3000           | admin / admin           |
| **Kibana**          | http://localhost:5601           | -                       |
| **RabbitMQ**        | http://localhost:15672          | admin / admin           |
| **pgAdmin**         | http://localhost:8080           | admin@admin.com / admin |
| **InfluxDB**        | http://localhost:8086           | admin / adminpassword   |

## 📝 Logging Commands

```bash
# View ElasticSearch indices
curl http://localhost:9200/_cat/indices?v

# Search recent logs
curl http://localhost:9200/indicator-logs-*/_search?q=error&size=10

# View Logstash stats
curl http://localhost:9600/_node/stats

# Tail service logs
docker compose -f docker-compose.krakend.yml logs -f main-service
docker compose -f docker-compose.krakend.yml logs -f login-service
```

## 📊 Metrics Commands

```bash
# View InfluxDB buckets
curl "http://localhost:8086/api/v2/buckets" \
  -H "Authorization: Token my-super-secret-auth-token"

# View KrakenD stats
curl http://localhost:8090/__stats

# Check Telegraf status
docker exec indicator-telegraf telegraf --test
```

## 🐰 RabbitMQ Commands

```bash
# List queues
curl -u admin:admin http://localhost:15672/api/queues

# List exchanges
curl -u admin:admin http://localhost:15672/api/exchanges

# View queue details
curl -u admin:admin http://localhost:15672/api/queues/indicator/user.events

# Publish test message (from inside container)
docker exec indicator-rabbitmq rabbitmqadmin publish \
  exchange=indicator.events \
  routing_key=user.test \
  payload="test message"
```

## 🔧 Configuration Validation

```bash
# Validate KrakenD config
docker run --rm -v "%cd%\krakend:/etc/krakend" \
  devopsfaith/krakend:latest check -c /etc/krakend/krakend.json

# Test KrakenD config with dry-run
docker run --rm -v "%cd%\krakend:/etc/krakend" \
  devopsfaith/krakend:latest check -t -c /etc/krakend/krakend.json
```

## 🧪 API Testing

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test\",\"password\":\"test\"}"

# Access protected endpoint
curl http://localhost:5000/api/v1/students \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Test rate limiting (send many requests)
for i in {1..20}; do
  curl http://localhost:5000/api/v1/students
done
```

## 🔄 Database Commands

```bash
# Connect to PostgreSQL
docker exec -it indicator-postgres psql -U postgres -d indicator_db

# Backup database
docker exec indicator-postgres pg_dump -U postgres indicator_db > backup.sql

# Restore database
cat backup.sql | docker exec -i indicator-postgres psql -U postgres -d indicator_db

# View database size
docker exec indicator-postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('indicator_db'));"
```

## 💾 Redis Commands

```bash
# Connect to Redis CLI
docker exec -it indicator-redis redis-cli

# View all keys
docker exec indicator-redis redis-cli KEYS '*'

# Get cache stats
docker exec indicator-redis redis-cli INFO stats

# Clear all cache
docker exec indicator-redis redis-cli FLUSHALL
```

## 🎯 Troubleshooting

```bash
# View container resource usage
docker stats

# Check disk space
docker system df

# Prune unused resources (careful!)
docker system prune

# View specific container logs with timestamps
docker compose -f docker-compose.krakend.yml logs --timestamps krakend | tail -100

# Check if port is in use
netstat -ano | findstr :5000

# Restart all unhealthy containers
docker compose -f docker-compose.krakend.yml ps | grep "unhealthy" | awk '{print $1}' | xargs docker restart
```

## 📦 Updates & Maintenance

```bash
# Pull latest images
docker compose -f docker-compose.krakend.yml pull

# Rebuild specific service
docker compose -f docker-compose.krakend.yml build main-service

# Update and restart
docker compose -f docker-compose.krakend.yml up -d --build

# Clean up old images
docker image prune -a
```

## 🔐 Security

```bash
# Generate new JWT secret (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Generate secure password
Add-Type -AssemblyName System.Web
[System.Web.Security.Membership]::GeneratePassword(32,4)
```

## 📈 Performance Monitoring

```bash
# View container CPU/Memory usage
docker stats --no-stream

# Check service response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5000/api/v1/students

# Where curl-format.txt contains:
# time_namelookup:  %{time_namelookup}
# time_connect:     %{time_connect}
# time_starttransfer: %{time_starttransfer}
# time_total:       %{time_total}
```

## 🎨 Grafana / Kibana Setup

```bash
# Import Grafana dashboard
curl -X POST http://localhost:3000/api/dashboards/db \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d @dashboard.json

# Create Kibana index pattern
curl -X POST http://localhost:5601/api/saved_objects/index-pattern/indicator-logs \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{"attributes":{"title":"indicator-logs-*","timeFieldName":"@timestamp"}}'
```

## 🚨 Emergency Procedures

```bash
# If stack won't start - check logs
docker compose -f docker-compose.krakend.yml logs

# If running out of memory - stop heavy services
docker compose -f docker-compose.krakend.yml stop elasticsearch kibana grafana

# If database is locked - kill connections
docker exec indicator-postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='indicator_db' AND pid <> pg_backend_pid();"

# Rollback to Express gateway
docker compose -f docker-compose.krakend.yml stop krakend
cd gateway_service && npm start
```

## 📚 Useful Commands

```bash
# Copy file from container
docker cp indicator-krakend:/etc/krakend/krakend.json ./krakend-backup.json

# Execute command in running container
docker exec -it indicator-krakend sh

# View environment variables
docker exec indicator-krakend env

# Check container startup logs
docker logs indicator-krakend --tail 50
```

---

## 💡 Tips

- Always use `docker compose -f docker-compose.krakend.yml` (full filename)
- Monitor Grafana dashboards for performance issues
- Check Kibana for error patterns
- RabbitMQ management UI is very helpful for debugging events
- Keep `.env` file secure - never commit to git
- Regularly backup PostgreSQL database

---

**For more details, see:** [`KRAKEND_README.md`](file:///e:/Projects/indicator/indicator_backend/KRAKEND_README.md)
