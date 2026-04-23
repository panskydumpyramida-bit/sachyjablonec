#!/bin/sh
set -e

# Railway deployment startup:
# 1. Apply pending DB migrations (blocking — server must start with correct schema)
# 2. Start Node server (background-triggers run AFTER server is healthy)
# 3. Sync events seed in background AFTER server listens, so /health is ready
#    quickly and Railway marks the deploy healthy without waiting for seeding

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "🟢 Starting application..."
(
    sleep 10
    echo "[startup] Running post-boot event sync in background..."
    node scripts/sync-production-events.js 2>&1 | sed 's/^/[sync-events] /' || echo "[sync-events] failed (non-fatal)"
) &

exec node src/server.js
