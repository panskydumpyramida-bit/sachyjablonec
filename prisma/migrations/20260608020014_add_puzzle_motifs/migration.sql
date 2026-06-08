-- AlterTable
ALTER TABLE "puzzle_candidates" ADD COLUMN "motifs" TEXT;

-- Reset: stará triviální data byla bez motivů, přeskenovat s novou logikou
DELETE FROM "puzzle_candidates";
UPDATE "games" SET "puzzle_scanned_at" = NULL;
