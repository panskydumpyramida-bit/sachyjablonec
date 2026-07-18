CREATE TABLE "puzzle_camp_sessions" (
    "id" SERIAL NOT NULL,
    "camp_code" TEXT NOT NULL DEFAULT 'pardubice-2026',
    "camp_name" TEXT NOT NULL DEFAULT 'Pardubice 2026',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 240,
    "puzzle_count" INTEGER NOT NULL DEFAULT 40,
    "puzzle_theme" TEXT NOT NULL DEFAULT 'mix',
    "lives_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_lives" INTEGER NOT NULL DEFAULT 5,
    "penalty_enabled" BOOLEAN NOT NULL DEFAULT true,
    "penalty_seconds" INTEGER NOT NULL DEFAULT 3,
    "skip_on_mistake" BOOLEAN NOT NULL DEFAULT true,
    "puzzles" JSONB NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_camp_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "puzzle_camp_attempts" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "max_streak" INTEGER NOT NULL DEFAULT 0,
    "puzzle_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_camp_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "puzzle_camp_puzzle_results" (
    "id" SERIAL NOT NULL,
    "attempt_id" INTEGER NOT NULL,
    "puzzle_index" INTEGER NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "rating" INTEGER,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "wrong_attempts" INTEGER NOT NULL DEFAULT 0,
    "response_ms" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_camp_puzzle_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "puzzle_camp_sessions_camp_code_starts_at_idx" ON "puzzle_camp_sessions"("camp_code", "starts_at");
CREATE INDEX "puzzle_camp_sessions_status_starts_at_idx" ON "puzzle_camp_sessions"("status", "starts_at");
CREATE UNIQUE INDEX "puzzle_camp_attempts_session_id_user_id_key" ON "puzzle_camp_attempts"("session_id", "user_id");
CREATE INDEX "puzzle_camp_attempts_session_id_score_idx" ON "puzzle_camp_attempts"("session_id", "score");
CREATE INDEX "puzzle_camp_attempts_user_id_joined_at_idx" ON "puzzle_camp_attempts"("user_id", "joined_at");
CREATE UNIQUE INDEX "puzzle_camp_puzzle_results_attempt_id_puzzle_index_key" ON "puzzle_camp_puzzle_results"("attempt_id", "puzzle_index");
CREATE INDEX "puzzle_camp_puzzle_results_attempt_id_puzzle_index_idx" ON "puzzle_camp_puzzle_results"("attempt_id", "puzzle_index");

ALTER TABLE "puzzle_camp_sessions" ADD CONSTRAINT "puzzle_camp_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "puzzle_camp_attempts" ADD CONSTRAINT "puzzle_camp_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "puzzle_camp_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "puzzle_camp_attempts" ADD CONSTRAINT "puzzle_camp_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "puzzle_camp_puzzle_results" ADD CONSTRAINT "puzzle_camp_puzzle_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "puzzle_camp_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
