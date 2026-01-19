-- AlterTable
DO $$
BEGIN
    ALTER TABLE "travel_reports" ADD COLUMN "note" TEXT;
EXCEPTION
    WHEN duplicate_column THEN
        -- Do nothing
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "diagrams" (
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagrams_user_id_fkey') THEN
        ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
