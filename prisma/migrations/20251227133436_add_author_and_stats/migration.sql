DO $$
BEGIN
    ALTER TYPE "Role" ADD VALUE 'MEMBER';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "comments_author_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "comments_news_id_idx";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'chat';

-- AlterTable
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "author_name" TEXT,
ADD COLUMN IF NOT EXISTS "co_author_id" INTEGER,
ADD COLUMN IF NOT EXISTS "co_author_name" TEXT,
ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "chess_games" (
    "id" SERIAL NOT NULL,
    "event" TEXT,
    "site" TEXT,
    "date" TIMESTAMP(3),
    "round" TEXT,
    "white_player" TEXT NOT NULL,
    "black_player" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "eco" TEXT,
    "white_elo" INTEGER,
    "black_elo" INTEGER,
    "ply_count" INTEGER,
    "moves" TEXT NOT NULL,

    CONSTRAINT "chess_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chess_moves" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "ply_num" INTEGER NOT NULL,
    "san" TEXT NOT NULL,

    CONSTRAINT "chess_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_games_white_player_idx" ON "chess_games"("white_player");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_games_black_player_idx" ON "chess_games"("black_player");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_games_eco_idx" ON "chess_games"("eco");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_games_date_idx" ON "chess_games"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_moves_san_ply_num_idx" ON "chess_moves"("san", "ply_num");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chess_moves_game_id_idx" ON "chess_moves"("game_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'news_co_author_id_fkey'
    ) THEN
        ALTER TABLE "news" ADD CONSTRAINT "news_co_author_id_fkey" FOREIGN KEY ("co_author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
