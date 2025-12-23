-- Add Google OAuth support columns to users table
-- Using DO block for safer idempotent migration

DO $$
BEGIN
    -- Add google_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_id') THEN
        ALTER TABLE "users" ADD COLUMN "google_id" TEXT UNIQUE;
    END IF;
    
    -- Add real_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'real_name') THEN
        ALTER TABLE "users" ADD COLUMN "real_name" TEXT;
    END IF;
    
    -- Add use_real_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'use_real_name') THEN
        ALTER TABLE "users" ADD COLUMN "use_real_name" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Add club column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'club') THEN
        ALTER TABLE "users" ADD COLUMN "club" TEXT;
    END IF;
END $$;

-- Make password_hash optional for OAuth users (only if it's currently NOT NULL)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'password_hash' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
    END IF;
END $$;
