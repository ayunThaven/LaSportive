DROP INDEX "FieldMapping_campaignId_sourceKey_kind_key";
CREATE UNIQUE INDEX "FieldMapping_campaignId_sourceKey_kind_reductionDevice_key"
ON "FieldMapping"("campaignId", "sourceKey", "kind", "reductionDevice");
