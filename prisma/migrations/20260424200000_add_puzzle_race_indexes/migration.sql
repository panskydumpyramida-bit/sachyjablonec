-- Indexy pro weekly queries (Hall of Fame, Best This Week, Leaderboard period=week)
-- Bez nich běží sequential scan na celé tabulce.
CREATE INDEX IF NOT EXISTS "puzzle_race_results_created_at_idx"
    ON "puzzle_race_results"("created_at");

CREATE INDEX IF NOT EXISTS "puzzle_race_results_mode_created_at_idx"
    ON "puzzle_race_results"("mode", "created_at");

CREATE INDEX IF NOT EXISTS "puzzle_race_results_user_id_mode_created_at_idx"
    ON "puzzle_race_results"("user_id", "mode", "created_at");
