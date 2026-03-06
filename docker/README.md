# Docker build and runtime guide

This repository uses a single `docker/docker-compose.yml` for local runtime.

## Recommended commands

Build only API and Web:

```bash
docker compose -f docker/docker-compose.yml build api web
```

Build and start only API and Web:

```bash
docker compose -f docker/docker-compose.yml up -d --build api web
```

Incremental rebuild of one service:

```bash
docker compose -f docker/docker-compose.yml build api
docker compose -f docker/docker-compose.yml up -d api
```

```bash
docker compose -f docker/docker-compose.yml build web
docker compose -f docker/docker-compose.yml up -d web
```

Start full stack:

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Quick validation metrics

Check image sizes:

```bash
docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | rg '^docker-(api|web)\s'
```

Check running service status:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check API status endpoint:

```bash
curl -sS http://localhost:4000/status
```
