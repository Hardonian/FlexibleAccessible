# AccessibleMadeFlexible Operations Runbook

## Daily Operations

### Health Check
```bash
npm run health
docker ps
```

### Monitoring
- Dashboard: /dashboard
- Metrics: /api/v1/metrics

## Common Issues

### Scan Timeout
1. Increase timeout in scan config
2. Check worker queue size
3. Scale workers: `docker-compose up -d --scale worker=3`

### Database Drift
```bash
npm run db:generate
npm run db:push
```

### Redis Backlog
```bash
redis-cli LLEN bull:default
# If > 1000, scale workers
```

## Maintenance

### Backup
```bash
docker exec aros-db pg_dump -U postgres aros > backup.sql
```

### Update
```bash
git pull
npm install
npm run db:push
docker compose restart
```

## Metrics Tracked
- Scan throughput
- Queue depth
- Error rates by scanner
- Remediation success rate
