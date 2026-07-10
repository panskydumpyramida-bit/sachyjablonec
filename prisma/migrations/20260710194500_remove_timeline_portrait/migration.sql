UPDATE "timeline_entries"
SET
    "image_url" = NULL,
    "image_alt" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "year" = 2025
  AND "event" = 'Nová generace vedení';
