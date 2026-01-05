#!/bin/sh
# start.sh - Handles DB migration baselining and startup
# Required because the production DB was previously managed by 'db push' 
# and now we are switching to 'migrate deploy'.

echo "🚀 Starting deployment script..."

# 1. Baseline the migrations that are ALREADY in the database structure
# We use '|| true' to suppress errors if they are already marked applied (e.g. on second run)
echo "📦 Baselining existing migrations..."




# 2. Deploy any NEW migrations (this should run the puzzle_modes migration)
echo "🔄 Deploying pending migrations..."
npx prisma migrate deploy || { echo "❌ Migration failed, stopping startup."; exit 1; }

# 2.5 LEGACY (removed): One-time fix for competition URLs (already applied)
# echo "🔧 Fixing competition URLs..."
# node scripts/fix_competition.mjs || echo "⚠️ Competition fix failed, but continuing..."

# 3. Sync existing games-json to Game table (for isCommented flag)
echo "👾 Syncing games from Articles..."
# npm run sync-games || echo "⚠️ Game sync failed, but continuing..."
echo "⚠️ Game sync skipped for speed (data should be in DB)."

# 4. Sync event data (2026 tournaments)
echo "📅 Syncing events..."
node scripts/sync-production-events.js || echo "⚠️ Event sync failed, but continuing..."

# 5. Start the application
echo "🟢 Starting application..."
exec npm start
