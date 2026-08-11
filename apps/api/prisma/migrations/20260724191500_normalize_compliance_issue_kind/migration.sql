-- Historical issues could be created as DOCUMENT even when their mapped
-- field was a text/identity field. The mapping is the authoritative type.
UPDATE "ComplianceIssue" AS issue
SET "kind" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "Enrollment" AS enrollment
    INNER JOIN "FieldMapping" AS mapping
      ON mapping."campaignId" = enrollment."campaignId"
      AND mapping."sourceKey" = issue."fieldKey"
      AND mapping."kind" = 'DOCUMENT'
    WHERE enrollment."id" = issue."enrollmentId"
  ) THEN 'DOCUMENT'
  ELSE 'FIELD'
END
WHERE issue."kind" IS DISTINCT FROM CASE
  WHEN EXISTS (
    SELECT 1
    FROM "Enrollment" AS enrollment
    INNER JOIN "FieldMapping" AS mapping
      ON mapping."campaignId" = enrollment."campaignId"
      AND mapping."sourceKey" = issue."fieldKey"
      AND mapping."kind" = 'DOCUMENT'
    WHERE enrollment."id" = issue."enrollmentId"
  ) THEN 'DOCUMENT'
  ELSE 'FIELD'
END;
