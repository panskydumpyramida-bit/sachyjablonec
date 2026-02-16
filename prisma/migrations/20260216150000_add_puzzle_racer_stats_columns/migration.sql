-- Add missing stats columns to puzzle_race_results
ALTER TABLE "puzzle_race_results" ADD COLUMN IF NOT EXISTS "correct_count" INTEGER DEFAULT 0;
ALTER TABLE "puzzle_race_results" ADD COLUMN IF NOT EXISTS "wrong_count" INTEGER DEFAULT 0;
ALTER TABLE "puzzle_race_results" ADD COLUMN IF NOT EXISTS "max_streak" INTEGER DEFAULT 0;
ALTER TABLE "puzzle_race_results" ADD COLUMN IF NOT EXISTS "puzzle_count" INTEGER DEFAULT 0;
