-- This HelloAsso field contains a parent's phone number, not a document.
UPDATE "FieldMapping"
SET "kind" = 'IDENTITE'
WHERE "sourceKey" = '8112134'
  AND "label" = 'NOM - Prénom / téléphone père'
  AND "kind" = 'DOCUMENT';

-- Align existing anomalies with the corrected mapping.
UPDATE "ComplianceIssue" AS issue
SET "kind" = 'FIELD'
FROM "Enrollment" AS enrollment,
     "FieldMapping" AS mapping
WHERE issue."enrollmentId" = enrollment."id"
  AND mapping."campaignId" = enrollment."campaignId"
  AND mapping."sourceKey" = issue."fieldKey"
  AND mapping."sourceKey" = '8112134'
  AND mapping."kind" = 'IDENTITE'
  AND issue."kind" IS DISTINCT FROM 'FIELD';
