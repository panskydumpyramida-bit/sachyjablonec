-- AlterTable
ALTER TABLE "blicak_registrations" ADD COLUMN     "note" TEXT;

-- Pozn: CREATE INDEX statements pro puzzle_race_results byly odstraněny —
-- indexy už existují z migrace 20260424200000_add_puzzle_race_indexes a Prisma
-- je sem omylem přidala při `prisma migrate dev` (shadow DB diff je nepochytil
-- kvůli `IF NOT EXISTS` v původní migraci). Duplicate CREATE INDEX způsobil
-- selhání deploye s "relation already exists".
