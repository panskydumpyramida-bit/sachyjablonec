-- AlterTable: Add tournament_id column to blicak_registrations
ALTER TABLE "blicak_registrations" ADD COLUMN "tournament_id" TEXT NOT NULL DEFAULT 'vanocni-2025';

-- CreateIndex
CREATE INDEX "blicak_registrations_tournament_id_idx" ON "blicak_registrations"("tournament_id");
