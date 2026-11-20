-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "ListingStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'SEND_BACK';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "agentId" UUID,
ADD COLUMN     "pendingChanges" JSONB,
ADD COLUMN     "reviewNote" VARCHAR(1000),
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "submittedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "property_media" ADD COLUMN     "pendingReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "property_documents" ADD COLUMN     "pendingReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "showAgentsOnListings" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agents" (
    "userId" UUID NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" VARCHAR(40),
    "photoUrl" TEXT,
    "photoKey" VARCHAR(512),
    "showOnListings" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "agent_invites" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" UUID,

    CONSTRAINT "agent_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_invites_tokenHash_key" ON "agent_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "agent_invites_email_idx" ON "agent_invites"("email");

-- CreateIndex
CREATE INDEX "properties_agentId_idx" ON "properties"("agentId");

-- CreateIndex
CREATE INDEX "properties_submittedAt_idx" ON "properties"("submittedAt");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_invites" ADD CONSTRAINT "agent_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

