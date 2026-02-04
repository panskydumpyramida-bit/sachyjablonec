#!/bin/bash

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling from git..."
git pull

# 2. Install dependencies (just in case)
echo "📦 Installing dependencies..."
npm install

# 3. Migrate Database
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# 4. Import Specific Data (PICF 2026)
# This is safe to run multiple times as it checks for existence
echo "♟️ Importing Prague Chess Festival 2026..."
node scripts/import_picf_2026.js

# 5. Restart Application
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart all
else
    echo "⚠️ PM2 not found, attempting npm restart..."
    npm restart
fi

echo "✅ Deployment complete!"
