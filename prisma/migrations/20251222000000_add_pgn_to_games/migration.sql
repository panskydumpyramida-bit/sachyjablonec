-- AddPgn to games table
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "pgn" TEXT;
