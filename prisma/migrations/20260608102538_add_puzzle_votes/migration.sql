-- AlterTable: rysy pro učení + agregát hlasů
ALTER TABLE "puzzle_candidates" ADD COLUMN "forcing_len" INTEGER;
ALTER TABLE "puzzle_candidates" ADD COLUMN "cp_gap" INTEGER;
ALTER TABLE "puzzle_candidates" ADD COLUMN "rating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "puzzle_candidates" ADD COLUMN "vote_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "puzzle_votes" (
    "id" SERIAL NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "value" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "puzzle_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "puzzle_votes_candidate_id_user_id_key" ON "puzzle_votes"("candidate_id", "user_id");
CREATE INDEX "puzzle_votes_candidate_id_idx" ON "puzzle_votes"("candidate_id");
ALTER TABLE "puzzle_votes" ADD CONSTRAINT "puzzle_votes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "puzzle_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
