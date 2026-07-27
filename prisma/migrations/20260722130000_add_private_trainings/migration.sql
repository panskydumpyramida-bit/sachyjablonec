CREATE TABLE "private_trainings" (
    "id" SERIAL NOT NULL,
    "training_date" TIMESTAMP(3) NOT NULL,
    "trainer" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "hourly_rate" INTEGER NOT NULL DEFAULT 100,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "private_trainings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "private_training_attendances" (
    "id" SERIAL NOT NULL,
    "training_id" INTEGER NOT NULL,
    "player_name" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    CONSTRAINT "private_training_attendances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "private_trainings_training_date_idx" ON "private_trainings"("training_date");
CREATE INDEX "private_trainings_trainer_idx" ON "private_trainings"("trainer");
CREATE INDEX "private_training_attendances_training_id_idx" ON "private_training_attendances"("training_id");
ALTER TABLE "private_training_attendances" ADD CONSTRAINT "private_training_attendances_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "private_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
