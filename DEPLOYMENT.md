# Deployment Checklist

> [!IMPORTANT]
> **Database Structure Changes**: This deployment includes 3 critical database migrations (`Image` model: sortOrder, category, default visibility). These MUST be applied to the production database for the gallery to work.

## 1. Deploy Code
- [x] Code Changes Pushed to Repository
- [ ] Verify Railway Auto-Deploy (Check Railway Dashboard)

## 2. Apply Database Migrations (CRITICAL)
Since you are using Railway, the safest way is to use their CLI or your local setup pointed to their connection string.

**Option A: Using Railway CLI (Recommended)**
Open your terminal and run:
```bash
railway run npx prisma migrate deploy
```

**Option B: Local Machine with Env Var**
1. Get the **Production** Database URL from Railway Dashboard.
2. Run this command locally (replace YOUR_PROD_URL):
```bash
DATABASE_URL="postgres://..." npx prisma migrate deploy
```

## 3. Verify Deployment
After deployment and migration:
1. **Gallery**: Visit `/gallery`. Check if images load.
2. **Admin**: Log in to `/admin.html`. Go to **Galerie** tab.
    - [ ] Check if `Sort Order`, `Kategorie`, and `Skryté` columns appear.
    - [ ] Try to hide/unhide an image.
3. **Game Viewer**:
    - [ ] Visit Article `/article.html?id=54` on Mobile (or resize browser).
    - [ ] Verify Chess Board height and Notation visibility.
    - [ ] Verify 'Pouze komentované' filter checkbox behavior.

> [!WARNING]
> If you skip Step 2, the Admin Panel Gallery tab will crash or fail to load images because it expects columns `sortOrder` and `category` which won't exist yet properly.

## 4. Configuration Reference
**Production Database URL** (For future migrations):
```bash
postgresql://postgres:OtipCqePUylBIvIqGxGBNJNpeDYDMHfc@ballast.proxy.rlwy.net:53432/railway
```
*Keep this safe. It allows direct access to the production database.*
