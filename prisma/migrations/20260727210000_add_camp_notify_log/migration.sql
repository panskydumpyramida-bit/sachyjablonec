-- CreateTable: co už bylo kam ohlášeno (pojistka proti dvojímu odeslání)
CREATE TABLE "camp_notify_log" (
    "id" SERIAL NOT NULL,
    "camp_code" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "camp_notify_log_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "camp_notify_log_camp_code_channel_key_key" ON "camp_notify_log"("camp_code", "channel", "key");
CREATE INDEX "camp_notify_log_camp_code_channel_sent_at_idx" ON "camp_notify_log"("camp_code", "channel", "sent_at");
