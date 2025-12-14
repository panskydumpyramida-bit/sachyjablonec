#!/bin/sh
# start.sh - Handles DB migration baselining and startup
# Required because the production DB was previously managed by 'db push' 
# and now we are switching to 'migrate deploy'.

echo "🚀 Starting deployment script..."

# 1. Baseline the migrations that are ALREADY in the database structure
# We use '|| true' to suppress errors if they are already marked applied (e.g. on second run)
echo "📦 Baselining existing migrations..."
npx prisma migrate resolve --applied 20251210194447_init_postgres_with_puzzle_racer || echo "⚠️ Migration 1 resolution skipped (already applied?)"

npx prisma migrate resolve --applied 20251212143558_init_puzzle_modes || echo "⚠️ Migration 3 resolution skipped (already applied?)"

# 2. Deploy any NEW migrations (this should run the puzzle_modes migration)
# 2. Deploy any NEW migrations (this should run the puzzle_modes migration)
echo "🔄 Deploying pending migrations..."
npx prisma migrate deploy || { echo "❌ Migration failed, stopping startup."; exit 1; }

# 3. Start the application
echo "🟢 Starting application..."
exec npm start
