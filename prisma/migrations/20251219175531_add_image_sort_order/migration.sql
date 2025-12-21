-- AlterTable
ALTER TABLE "images" ADD COLUMN     "news_id" INTEGER,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE SET NULL ON UPDATE CASCADE;
