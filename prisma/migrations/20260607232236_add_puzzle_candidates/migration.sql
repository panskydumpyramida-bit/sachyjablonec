-- AlterTable
ALTER TABLE "games" ADD COLUMN "puzzle_scanned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "puzzle_candidates" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "news_id" INTEGER,
    "fen" TEXT NOT NULL,
    "best_move_lan" TEXT NOT NULL,
    "best_san" TEXT NOT NULL,
    "to_move" TEXT NOT NULL,
    "uniq_margin" DOUBLE PRECISION NOT NULL,
    "mate_in" INTEGER,
    "best_cp" INTEGER,
    "played_best" BOOLEAN NOT NULL DEFAULT false,
    "ply" INTEGER NOT NULL,
    "move_no" INTEGER NOT NULL,
    "white_player" TEXT NOT NULL,
    "black_player" TEXT NOT NULL,
    "news_title" TEXT,
    "game_date" TIMESTAMP(3),
    "score" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "used_in_news_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "puzzle_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_candidates_game_id_ply_key" ON "puzzle_candidates"("game_id", "ply");

-- CreateIndex
CREATE INDEX "puzzle_candidates_score_idx" ON "puzzle_candidates"("score");

-- AddForeignKey
ALTER TABLE "puzzle_candidates" ADD CONSTRAINT "puzzle_candidates_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
