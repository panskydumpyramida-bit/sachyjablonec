-- AlterTable
ALTER TABLE "blicak_registrations" ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "puzzle_race_results_created_at_idx" ON "puzzle_race_results"("created_at");

-- CreateIndex
CREATE INDEX "puzzle_race_results_mode_created_at_idx" ON "puzzle_race_results"("mode", "created_at");

-- CreateIndex
CREATE INDEX "puzzle_race_results_user_id_mode_created_at_idx" ON "puzzle_race_results"("user_id", "mode", "created_at");

