-- Add last_login field to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP(3);
