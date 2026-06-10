-- CreateTable: vyřešení Hádanky dne (streak + "dnes vyřešili")
CREATE TABLE "puzzle_solves" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT,
    "candidate_id" INTEGER NOT NULL,
    "date_key" TEXT NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "puzzle_solves_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "puzzle_solves_user_id_date_key_key" ON "puzzle_solves"("user_id", "date_key");
CREATE INDEX "puzzle_solves_date_key_idx" ON "puzzle_solves"("date_key");
