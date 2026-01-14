-- Add new fields to travel_reports
ALTER TABLE "travel_reports" ADD COLUMN IF NOT EXISTS "license_plate" TEXT;
ALTER TABLE "travel_reports" ADD COLUMN IF NOT EXISTS "passengers" TEXT;
