#!/bin/bash

# Navigate to working directory
mkdir -p /opt/ShareMemories/storage
cd /opt/ShareMemories

# Your GitHub username and repo (lowercase!)
IMAGE_BASE="ghcr.io/shayalvaghasiya/sharememories"

# 1. Pull the newest images from GHCR
docker pull $IMAGE_BASE-backend:latest
docker pull $IMAGE_BASE-frontend:latest

# 2. Stop and remove the old running application containers
docker stop wedding_api wedding_worker wedding_frontend || true
docker rm wedding_api wedding_worker wedding_frontend || true

# 3. Start Backend
docker run -d \
  --name wedding_api \
  --network sharememories_net \
  --restart always \
  -p 8000:8000 \
  -v /opt/ShareMemories/storage:/storage \
  --env-file /opt/ShareMemories/.env \
  -e DATABASE_URL="postgresql://admin:postgres%40admin@wedding_db:5432/wedding_db" \
  -e REDIS_URL="redis://wedding_redis:6379/0" \
  $IMAGE_BASE-backend:latest

# 4. Start Worker (uses the same backend image, but overrides the command!)
docker run -d \
  --name wedding_worker \
  --network sharememories_net \
  --restart always \
  -v /opt/ShareMemories/storage:/storage \
  --env-file /opt/ShareMemories/.env \
  -e DATABASE_URL="postgresql://admin:postgres%40admin@wedding_db:5432/wedding_db" \
  -e REDIS_URL="redis://wedding_redis:6379/0" \
  $IMAGE_BASE-backend:latest \
  celery -A app.worker.celery worker --loglevel=info --concurrency=4

# 5. Start Frontend
docker run -d \
  --name wedding_frontend \
  --network sharememories_net \
  --restart always \
  --env-file /opt/ShareMemories/.env \
  -p 3000:3000 \
  $IMAGE_BASE-frontend:latest

# 6. Clean up old unused images to free up droplet disk space
docker image prune -f
