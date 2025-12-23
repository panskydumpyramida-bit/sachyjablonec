-- Add Google OAuth support columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "real_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "use_real_name" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "club" TEXT;

-- Make password_hash optional for OAuth users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
