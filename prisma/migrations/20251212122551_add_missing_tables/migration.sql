-- CreateTable
CREATE TABLE "games_recorded" (
    "id" SERIAL NOT NULL,
    "white" TEXT NOT NULL,
    "black" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT,
    "pgn_text" TEXT NOT NULL,
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_recorded_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_racer_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "puzzle_theme" TEXT NOT NULL DEFAULT 'mix',
    "time_limit_seconds" INTEGER NOT NULL DEFAULT 180,
    "lives_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_lives" INTEGER NOT NULL DEFAULT 3,
    "puzzles_per_difficulty" INTEGER NOT NULL DEFAULT 6,
    "penalty_enabled" BOOLEAN NOT NULL DEFAULT false,
    "penalty_seconds" INTEGER NOT NULL DEFAULT 5,
    "skip_on_mistake" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_racer_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "games_recorded" ADD CONSTRAINT "games_recorded_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
