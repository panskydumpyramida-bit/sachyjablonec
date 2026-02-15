-- Add missing snr column to standings table
ALTER TABLE "standings" ADD COLUMN IF NOT EXISTS "snr" INTEGER;

-- Add missing sort_order column to competitions table  
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
