-- CreateTable: online žádosti o registraci člena ŠSČR
CREATE TABLE "member_registrations" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "data" JSONB,
    "pdf" BYTEA,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    CONSTRAINT "member_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "member_registrations_token_key" ON "member_registrations"("token");
