CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "MappingKind" AS ENUM ('IDENTITE', 'LICENCE', 'DOCUMENT', 'REDUCTION_TYPE', 'REDUCTION_CODE');
CREATE TYPE "ComplianceIssueStatus" AS ENUM ('NON_CONFORME', 'RELANCE', 'CORRECTION_RECUE', 'CONFORME');
CREATE TYPE "LicenseStatus" AS ENUM ('A_TRAITER', 'TRAITE');
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "helloAssoId" TEXT,
    "title" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "organizationSlug" TEXT NOT NULL,
    "formSlug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldMapping" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "MappingKind" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "sourceData" JSONB NOT NULL,
    "helloAssoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'A_TRAITER',
    "licenseProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldOverride" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FieldOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceIssue" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ComplianceIssueStatus" NOT NULL DEFAULT 'NON_CONFORME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriveDocument" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriveDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "emailSubject" TEXT NOT NULL DEFAULT 'Votre inscription nécessite une correction',
    "emailTemplate" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Campaign_helloAssoId_key" ON "Campaign"("helloAssoId");
CREATE UNIQUE INDEX "Campaign_organizationSlug_formSlug_key" ON "Campaign"("organizationSlug", "formSlug");
CREATE INDEX "FieldMapping_campaignId_position_idx" ON "FieldMapping"("campaignId", "position");
CREATE UNIQUE INDEX "FieldMapping_campaignId_sourceKey_kind_key" ON "FieldMapping"("campaignId", "sourceKey", "kind");
CREATE UNIQUE INDEX "Enrollment_externalItemId_key" ON "Enrollment"("externalItemId");
CREATE INDEX "Enrollment_campaignId_active_idx" ON "Enrollment"("campaignId", "active");
CREATE INDEX "Enrollment_lastName_firstName_idx" ON "Enrollment"("lastName", "firstName");
CREATE UNIQUE INDEX "FieldOverride_enrollmentId_fieldKey_key" ON "FieldOverride"("enrollmentId", "fieldKey");
CREATE INDEX "ComplianceIssue_enrollmentId_status_idx" ON "ComplianceIssue"("enrollmentId", "status");
CREATE INDEX "Reminder_enrollmentId_sentAt_idx" ON "Reminder"("enrollmentId", "sentAt");
CREATE INDEX "SyncRun_campaignId_startedAt_idx" ON "SyncRun"("campaignId", "startedAt");

ALTER TABLE "FieldMapping" ADD CONSTRAINT "FieldMapping_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldOverride" ADD CONSTRAINT "FieldOverride_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceIssue" ADD CONSTRAINT "ComplianceIssue_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriveDocument" ADD CONSTRAINT "DriveDocument_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "ComplianceIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
