-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'fa-chess-pawn',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_future" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- Seed initial entries to match current hardcoded about.html
INSERT INTO "timeline_entries" ("year", "event", "icon", "sort_order", "is_future", "updated_at") VALUES
(1991, 'Založení TJ Bižuterie (občanské sdružení)', 'fa-chess-pawn',   10, false, CURRENT_TIMESTAMP),
(2006, 'Přestěhování z věže Sokolovny',              'fa-chess-rook',   20, false, CURRENT_TIMESTAMP),
(2025, 'Postup do 1. ligy mládeže',                  'fa-chess-knight', 30, false, CURRENT_TIMESTAMP),
(2030, 'Cíl: postup do Extraligy ČR',                'fa-chess-king',   40, true,  CURRENT_TIMESTAMP);
