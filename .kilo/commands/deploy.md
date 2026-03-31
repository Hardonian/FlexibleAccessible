---
description: "Deploy AROS to production"
---

# Deploy AROS

Deploy AROS web app and workers to production.

## Web App (Vercel)

```bash
vercel --prod
```

## Workers (Docker)

```bash
docker build -f docker/Dockerfile.worker -t aros-worker .
docker push <registry>/aros-worker
```

## Environment

Set all variables from `.env.example` in your deployment platform.
