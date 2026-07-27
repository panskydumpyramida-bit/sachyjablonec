-- CreateTable: odběratelé upozornění na nový los
CREATE TABLE "push_subscribers" (
    "id" SERIAL NOT NULL,
    "camp_code" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "push_subscribers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscribers_endpoint_key" ON "push_subscribers"("endpoint");
CREATE INDEX "push_subscribers_camp_code_idx" ON "push_subscribers"("camp_code");
