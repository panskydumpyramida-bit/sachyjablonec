-- CreateTable: mapa hráčů soustředění na startovní čísla v chess-results
CREATE TABLE "camp_players" (
    "id" SERIAL NOT NULL,
    "camp_code" TEXT NOT NULL,
    "tnr" TEXT NOT NULL,
    "tournament_code" TEXT NOT NULL,
    "start_no" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "camp_players_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "camp_players_camp_code_tnr_start_no_key" ON "camp_players"("camp_code", "tnr", "start_no");
CREATE INDEX "camp_players_camp_code_active_idx" ON "camp_players"("camp_code", "active");

-- CreateTable: cache dashboardu
CREATE TABLE "camp_snapshots" (
    "id" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "camp_snapshots_pkey" PRIMARY KEY ("id")
);
