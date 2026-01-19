-- AlterTable
DO $$
BEGIN
    ALTER TABLE "diagrams" ADD COLUMN "solution" JSONB;
EXCEPTION
    WHEN duplicate_column THEN
        -- Do nothing
END $$;
