# Bižuterie Jablonec - Chess Club Backend

Backend API for the chess club website CMS.

## Tech Stack
- Node.js + Express
- Prisma ORM
- PostgreSQL 
- JWT Authentication

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
ALLOWED_ORIGINS="http://localhost:8000,https://your-frontend.netlify.app"
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-secure-password"
```

## Development

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

## Production (Railway)

1. Connect GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Railway will auto-deploy on push

### Required Railway ENV vars:
- `DATABASE_URL` - PostgreSQL connection string (Railway provides)
- `JWT_SECRET` - Strong secret for JWT
- `ALLOWED_ORIGINS` - Frontend URLs
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
