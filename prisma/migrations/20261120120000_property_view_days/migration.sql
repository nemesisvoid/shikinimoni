-- CreateTable
CREATE TABLE "property_view_days" (
    "propertyId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "property_view_days_pkey" PRIMARY KEY ("propertyId","day")
);

-- CreateIndex
CREATE INDEX "property_view_days_day_idx" ON "property_view_days"("day");

-- AddForeignKey
ALTER TABLE "property_view_days" ADD CONSTRAINT "property_view_days_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
