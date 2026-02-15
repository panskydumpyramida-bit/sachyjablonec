-- CreateTable (idempotent: IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'chess-results',
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "chesscz_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "standings" (
    "id" SERIAL NOT NULL,
    "competition_id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "snr" INTEGER,
    "points" DOUBLE PRECISION,
    "wins" INTEGER,
    "draws" INTEGER,
    "losses" INTEGER,
    "games" INTEGER,
    "score" DOUBLE PRECISION,
    "schedule_json" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "standings_competition_id_team_key" ON "standings"("competition_id", "team");

-- AddForeignKey (idempotent check)
-- Add missing columns if tables already existed
ALTER TABLE "standings" ADD COLUMN IF NOT EXISTS "snr" INTEGER;
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'standings_competition_id_fkey'
    ) THEN
        ALTER TABLE "standings" ADD CONSTRAINT "standings_competition_id_fkey" 
            FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed competitions data
INSERT INTO "competitions" ("id", "name", "type", "url", "category", "sort_order", "active")
VALUES 
    ('kp-liberec', 'Krajský přebor', 'chess-results', 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46&SNode=S0', 'teams', 1, true),
    ('ks-vychod', 'Krajská soutěž východ', 'chess-results', 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46&SNode=S1', 'teams', 2, true),
    ('ks-vychod-finale', 'KS východ – nadstavba', 'chess-results', 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46&SNode=S2', 'teams', 3, true),
    ('3255', '1. liga mládeže A', 'chess-results', 'https://s2.chess-results.com/tnr1303510.aspx?lan=5&art=46&SNode=S1', 'youth', 1, true),
    ('ks-st-zaku', 'Krajská soutěž st. žáků', 'chess-results', 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46&SNode=S3', 'youth', 2, true),
    ('3363', 'Krajský přebor mládeže', 'chess-results', 'https://s2.chess-results.com/tnr1303510.aspx?lan=5&art=46&SNode=S0', 'youth', 3, true)
ON CONFLICT ("id") DO NOTHING;
