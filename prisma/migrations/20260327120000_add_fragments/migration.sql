-- CreateTable
CREATE TABLE "fragments" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "start_fen" TEXT NOT NULL,
    "from_move" INTEGER NOT NULL,
    "to_move" INTEGER NOT NULL,
    "source_game_id" INTEGER,
    "white" TEXT,
    "black" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fragments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
