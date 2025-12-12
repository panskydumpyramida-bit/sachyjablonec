-- AlterTable
ALTER TABLE "puzzle_racer_settings" ADD COLUMN     "fixed_puzzle_set" JSONB,
ADD COLUMN     "randomize_puzzles" BOOLEAN NOT NULL DEFAULT true;
