-- CreateTable: univerzální ohlášení přestupu v šachu
CREATE TABLE "member_transfers" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "data" JSONB,
    "pdf" BYTEA,
    "scan" BYTEA,
    "scan_mime" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "member_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "member_transfers_token_key" ON "member_transfers"("token");
