-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "contactEmail" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "whatsapp" VARCHAR(40) NOT NULL,
    "officeAddress" VARCHAR(300) NOT NULL,
    "openingHours" JSONB NOT NULL,
    "replyTime" VARCHAR(60) NOT NULL,
    "alertEmails" VARCHAR(1000),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- Only ever one row: the app reads and writes id 1.
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_single_row" CHECK ("id" = 1);
