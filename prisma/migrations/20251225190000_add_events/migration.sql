-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "location" TEXT,
    "category" TEXT NOT NULL DEFAULT 'tournament',
    "age_group" TEXT,
    "event_type" TEXT,
    "time_control" TEXT,
    "registration_deadline" TIMESTAMP(3),
    "presentation_end" TIMESTAMP(3),
    "entry_fee" TEXT,
    "organizer_contact" TEXT,
    "url" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
