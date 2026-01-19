-- AlterTable
ALTER TABLE "travel_reports" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "diagrams" (
    "id" SERIAL NOT NULL,
    "fen" TEXT NOT NULL,
    "annotations" JSONB NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
