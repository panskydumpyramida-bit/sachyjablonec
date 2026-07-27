-- CreateTable
CREATE TABLE "tracked_players" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "sscr_id" TEXT,
    "club" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_players_active_idx" ON "tracked_players"("active");
