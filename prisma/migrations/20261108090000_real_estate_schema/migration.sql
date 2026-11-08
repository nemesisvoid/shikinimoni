-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'LAND', 'INDUSTRIAL', 'AGRICULTURAL', 'MIXED_USE');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL_LAND', 'COMMERCIAL_LAND', 'FARMLAND', 'APARTMENT', 'BUNGALOW', 'DUPLEX', 'SEMI_DETACHED_DUPLEX', 'TERRACE', 'DETACHED_HOUSE', 'PENTHOUSE', 'MAISONETTE', 'STUDIO', 'OFFICE', 'SHOP', 'WAREHOUSE', 'HOTEL', 'EVENT_CENTRE', 'FILLING_STATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'LEASE', 'SHORT_LET');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'SOLD', 'RENTED', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "PricePeriod" AS ENUM ('TOTAL', 'PER_YEAR', 'PER_MONTH', 'PER_WEEK', 'PER_NIGHT');

-- CreateEnum
CREATE TYPE "SizeUnit" AS ENUM ('SQM', 'SQFT', 'PLOT', 'ACRE', 'HECTARE');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'FLOOR_PLAN', 'VIRTUAL_TOUR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TITLE_DOCUMENT', 'SURVEY_PLAN', 'DEED', 'BUILDING_APPROVAL', 'RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('GENERAL', 'VIEWING_REQUEST', 'OFFER');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PUBLISH', 'UNPUBLISH', 'STATUS_CHANGE');

-- DropTable
DROP TABLE "notes";

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "refNumber" SERIAL NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "description" TEXT NOT NULL,
    "category" "PropertyCategory" NOT NULL,
    "type" "PropertyType" NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(15,2),
    "currency" CHAR(3) NOT NULL,
    "pricePeriod" "PricePeriod" NOT NULL DEFAULT 'TOTAL',
    "isNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "serviceCharge" DECIMAL(15,2),
    "landSize" DECIMAL(12,4),
    "landSizeUnit" "SizeUnit",
    "landAreaSqm" DECIMAL(14,2),
    "floorAreaSqm" DECIMAL(12,2),
    "bedrooms" SMALLINT,
    "bathrooms" SMALLINT,
    "toilets" SMALLINT,
    "parkingSpaces" SMALLINT,
    "floors" SMALLINT,
    "yearBuilt" SMALLINT,
    "furnishing" "Furnishing",
    "titleType" VARCHAR(120),
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "neighborhood" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(120) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "postalCode" VARCHAR(20),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "showExactAddress" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_media" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "storageKey" VARCHAR(512),
    "url" TEXT NOT NULL,
    "altText" VARCHAR(200),
    "caption" VARCHAR(300),
    "mimeType" VARCHAR(100),
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" UUID,

    CONSTRAINT "property_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_documents" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(100),
    "sizeBytes" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" UUID,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "group" VARCHAR(60),
    "icon" VARCHAR(60),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "propertyId" UUID NOT NULL,
    "amenityId" INTEGER NOT NULL,

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","propertyId")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "type" "InquiryType" NOT NULL DEFAULT 'GENERAL',
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30),
    "message" TEXT NOT NULL,
    "preferredViewingAt" TIMESTAMPTZ(3),
    "adminNotes" TEXT,
    "respondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "propertyId" UUID,
    "userId" UUID,
    "assignedToId" UUID,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "changes" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_refNumber_key" ON "properties"("refNumber");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_status_deletedAt_publishedAt_idx" ON "properties"("status", "deletedAt", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "properties_listingType_category_type_idx" ON "properties"("listingType", "category", "type");

-- CreateIndex
CREATE INDEX "properties_country_state_city_idx" ON "properties"("country", "state", "city");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_landAreaSqm_idx" ON "properties"("landAreaSqm");

-- CreateIndex
CREATE INDEX "properties_bedrooms_idx" ON "properties"("bedrooms");

-- CreateIndex
CREATE INDEX "properties_isFeatured_publishedAt_idx" ON "properties"("isFeatured", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "properties_createdById_idx" ON "properties"("createdById");

-- CreateIndex
CREATE INDEX "properties_updatedById_idx" ON "properties"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "property_media_storageKey_key" ON "property_media"("storageKey");

-- CreateIndex
CREATE INDEX "property_media_propertyId_sortOrder_idx" ON "property_media"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "property_media_uploadedById_idx" ON "property_media"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "property_documents_storageKey_key" ON "property_documents"("storageKey");

-- CreateIndex
CREATE INDEX "property_documents_propertyId_idx" ON "property_documents"("propertyId");

-- CreateIndex
CREATE INDEX "property_documents_uploadedById_idx" ON "property_documents"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_name_key" ON "amenities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_slug_key" ON "amenities"("slug");

-- CreateIndex
CREATE INDEX "property_amenities_amenityId_idx" ON "property_amenities"("amenityId");

-- CreateIndex
CREATE INDEX "favorites_propertyId_idx" ON "favorites"("propertyId");

-- CreateIndex
CREATE INDEX "inquiries_status_createdAt_idx" ON "inquiries"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "inquiries_propertyId_idx" ON "inquiries"("propertyId");

-- CreateIndex
CREATE INDEX "inquiries_userId_idx" ON "inquiries"("userId");

-- CreateIndex
CREATE INDEX "inquiries_assignedToId_idx" ON "inquiries"("assignedToId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data integrity checks (hand-written; Prisma does not model CHECK constraints but keeps them)
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_price_check"          CHECK ("price" IS NULL OR "price" >= 0),
  ADD CONSTRAINT "properties_service_charge_check" CHECK ("serviceCharge" IS NULL OR "serviceCharge" >= 0),
  ADD CONSTRAINT "properties_currency_check"       CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "properties_country_check"        CHECK ("country" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "properties_land_size_check"      CHECK (("landSize" IS NULL) = ("landSizeUnit" IS NULL) AND ("landSize" IS NULL OR "landSize" > 0)),
  ADD CONSTRAINT "properties_areas_check"          CHECK (("landAreaSqm" IS NULL OR "landAreaSqm" > 0) AND ("floorAreaSqm" IS NULL OR "floorAreaSqm" > 0)),
  ADD CONSTRAINT "properties_counts_check"         CHECK (
    COALESCE("bedrooms", 0) >= 0 AND COALESCE("bathrooms", 0) >= 0 AND COALESCE("toilets", 0) >= 0
    AND COALESCE("parkingSpaces", 0) >= 0 AND COALESCE("floors", 0) >= 0 AND "viewCount" >= 0),
  ADD CONSTRAINT "properties_coordinates_check"    CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "properties_published_at_check"   CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "property_media"
  ADD CONSTRAINT "property_media_dimensions_check" CHECK (
    COALESCE("sizeBytes", 0) >= 0 AND COALESCE("width", 0) >= 0 AND COALESCE("height", 0) >= 0);
