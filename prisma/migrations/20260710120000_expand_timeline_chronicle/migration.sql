-- Add richer editorial fields for the public club chronicle.
ALTER TABLE "timeline_entries" ADD COLUMN "year_label" TEXT;
ALTER TABLE "timeline_entries" ADD COLUMN "description" TEXT;
ALTER TABLE "timeline_entries" ADD COLUMN "category" TEXT;
ALTER TABLE "timeline_entries" ADD COLUMN "image_url" TEXT;
ALTER TABLE "timeline_entries" ADD COLUMN "image_alt" TEXT;

-- Bring the existing milestones into the extended chronology.
UPDATE "timeline_entries"
SET
    "sort_order" = 60,
    "description" = 'Samostatná TJ Bižuterie získává podobu občanského sdružení a navazuje na dlouhou oddílovou tradici.',
    "category" = 'Klub'
WHERE "year" = 1991;

UPDATE "timeline_entries"
SET
    "sort_order" = 70,
    "description" = 'Oddíl opouští legendární věž Sokolovny a stěhuje své zázemí do nových prostor.',
    "category" = 'Klub'
WHERE "year" = 2006;

UPDATE "timeline_entries"
SET
    "event" = 'Nová generace vedení',
    "sort_order" = 80,
    "description" = 'Předsedou oddílu se stává Antonín Duda. Ve stejné sezoně mládež postupuje do 1. ligy.',
    "category" = 'Současnost',
    "icon" = 'fa-chess-knight',
    "image_url" = '/images/management_antonin.webp',
    "image_alt" = 'Antonín Duda, předseda šachového oddílu TJ Bižuterie Jablonec'
WHERE "year" = 2025;

UPDATE "timeline_entries"
SET
    "sort_order" = 90,
    "description" = 'Směr, ke kterému chceme klub společně dovést.',
    "category" = 'Budoucnost'
WHERE "year" = 2030;

INSERT INTO "timeline_entries"
    ("year", "event", "description", "category", "icon", "image_url", "image_alt", "sort_order", "is_future", "updated_at")
SELECT
    1948,
    'První velká šachová stopa',
    'Jablonec hostí I. sjezd SŽS. Dochovaná obálka turnajového materiálu připomíná, že zdejší šachová tradice sahá hluboko před vznik oddílu Bižuterie.',
    'Jablonecký šach',
    'fa-chess-rook',
    '/images/timeline/archive-1948.webp',
    'Archivní obálka I. sjezdu SŽS v Jablonci nad Nisou z roku 1948',
    10,
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "timeline_entries" WHERE "year" = 1948);

INSERT INTO "timeline_entries"
    ("year", "event", "description", "category", "icon", "image_url", "image_alt", "sort_order", "is_future", "updated_at")
SELECT
    1955,
    'Finále dorostu ČSR v Jablonci',
    'Od 20. do 28. srpna se v Jablonci hraje celostátní finále dorostu. Město už tehdy patří k výrazným šachovým místům regionu.',
    'Jablonecký šach',
    'fa-chess-pawn',
    '/images/timeline/archive-1955.webp',
    'Archivní obálka finále dorostu ČSR v Jablonci z roku 1955',
    20,
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "timeline_entries" WHERE "year" = 1955);

INSERT INTO "timeline_entries"
    ("year", "year_label", "event", "description", "category", "icon", "sort_order", "is_future", "updated_at")
SELECT
    1970,
    '70. léta',
    'Začátky oddílu TJ Bižuterie',
    'Dochované klubové materiály potvrzují činnost šachového oddílu Bižuterie nejpozději od 70. let.',
    'TJ Bižuterie',
    'fa-chess-bishop',
    30,
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "timeline_entries" WHERE "year" = 1970);

INSERT INTO "timeline_entries"
    ("year", "event", "description", "category", "icon", "image_url", "image_alt", "sort_order", "is_future", "updated_at")
SELECT
    1980,
    'Čestmír Drobník předsedou',
    'Začíná dlouhá éra vedení spojená s klubovým životem, turnaji a systematickou prací s mládeží.',
    'Vedení klubu',
    'fa-chess-king',
    '/images/timeline/archive-1980.webp',
    'Klubová fotokronika TJ Bižuterie s Čestmírem Drobníkem při tréninku mládeže',
    40,
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "timeline_entries" WHERE "year" = 1980);

INSERT INTO "timeline_entries"
    ("year", "event", "description", "category", "icon", "image_url", "image_alt", "sort_order", "is_future", "updated_at")
SELECT
    1988,
    'Šachové veloutkání',
    'Jablonečtí organizují mimořádné utkání s Libercem na 100 šachovnicích. Padesát dvojic hrálo dvakrát po třiceti minutách.',
    'Velká utkání',
    'fa-people-group',
    '/images/timeline/archive-1988.webp',
    'Novinový článek Šachové veloutkání s datem 27. října 1988',
    50,
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "timeline_entries" WHERE "year" = 1988);
