-- AlterTable
ALTER TABLE "games" ADD COLUMN     "black_player" TEXT,
ADD COLUMN     "news_id" INTEGER,
ADD COLUMN     "white_player" TEXT,
ALTER COLUMN "report_id" DROP NOT NULL,
ALTER COLUMN "team" DROP NOT NULL,
ALTER COLUMN "position_order" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "games_chess_com_id_idx" ON "games"("chess_com_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;
