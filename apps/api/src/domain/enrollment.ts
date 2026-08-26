import type { ComplianceStatus, EffectiveField, EnrollmentDetail, EnrollmentSummary } from "@la-sportive/contracts";
import type { EnrollmentRecord, IssueRecord } from "./types.js";

function displayReductionDevice(value: string): string {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (key === "PASSPORT") return "Pass’Sport";
  if (key === "CARTEJEUNE") return "Carte Jeune";
  if (key === "PASSREGION") return "Pass’Région";
  return value;
}

function isMedicalCertificate(field: EffectiveField): boolean {
  return `${field.key} ${field.label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").includes("certificat medical");
}

export function effectiveFields(record: EnrollmentRecord): EffectiveField[] {
  return record.mappings
    .map((mapping) => {
      const sourceValue = record.sourceData[mapping.sourceKey] ?? "";
      const override = record.overrides[mapping.sourceKey];
      return {
        key: mapping.sourceKey,
        label: mapping.label,
        value: override ?? sourceValue,
        sourceValue,
        overridden: override !== undefined,
        required: mapping.required,
        kind: mapping.kind,
        position: mapping.position,
        reductionDevice: mapping.reductionDevice,
      };
    })
    .sort((a, b) => a.position - b.position);
}

/** A correction is a document only when the submitted value points to the supported document providers. */
export function issueRequiresDocument(record: Pick<EnrollmentRecord, "sourceData" | "overrides">, issue: Pick<IssueRecord, "fieldKey">): boolean {
  const value = record.overrides[issue.fieldKey] ?? record.sourceData[issue.fieldKey] ?? "";
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.startsWith("docs.helloasso.") || hostname === "drive.google.com" || hostname.endsWith(".drive.google.com");
  } catch {
    return false;
  }
}

export function complianceStatus(record: EnrollmentRecord): ComplianceStatus {
  const open = record.issues.filter((issue) => issue.status !== "CONFORME");
  const complianceFields = effectiveFields(record).filter((field) => field.kind === "IDENTITE" || field.kind === "DOCUMENT");
  if (open.length > 0) return "ANOMALIE";
  if (record.complianceValidatedAt) return "VALIDE";
  if (complianceFields.some((field) => !isMedicalCertificate(field) && !field.value.trim())) return "INCOMPLET";
  if (!record.complianceValidatedAt && complianceFields.some((field) => isMedicalCertificate(field) && field.value.trim())) return "VERIF_CERTIFICAT";
  return "A_VALIDER";
}

export function licenseReady(record: EnrollmentRecord): boolean {
  return complianceStatus(record) === "VALIDE";
}

export function toSummary(record: EnrollmentRecord): EnrollmentSummary {
  const fields = effectiveFields(record);
  const firstName = fields.find((field) => field.key === "firstName")?.value || record.firstName;
  const lastName = fields.find((field) => field.key === "lastName")?.value || record.lastName;
  const contactEmail = fields.find((field) => field.key === "contactEmail" || field.label.toLocaleLowerCase("fr").includes("mail de contact"))?.value || record.contactEmail;
  const reductions = fields
    .filter((field) => field.kind === "REDUCTION_CODE" && field.reductionDevice && field.value.trim())
    .map((field) => ({ device: displayReductionDevice(field.reductionDevice!), code: field.value }))
    // Legacy settings could associate a device with the HelloAsso discount
    // type as well as with the actual form code. The type (CARTEJEUNE, etc.)
    // is a label, never an adhérent's code.
    .filter((reduction) => displayReductionDevice(reduction.code) !== reduction.device);
  const reductionType = reductions[0]?.device || (fields.find((field) => field.kind === "REDUCTION_TYPE")?.value ? displayReductionDevice(fields.find((field) => field.kind === "REDUCTION_TYPE")!.value) : undefined);
  const reductionCode = reductions[0]?.code || fields.find((field) => field.kind === "REDUCTION_CODE")?.value || undefined;
  return {
    id: record.id,
    externalItemId: record.externalItemId,
    firstName,
    lastName,
    contactEmail,
    complianceStatus: complianceStatus(record),
    licenseStatus: record.licenseStatus,
    licenseProcessedAt: record.licenseProcessedAt?.toISOString(),
    licenseReady: licenseReady(record),
    discountType: reductionType,
    discountCode: reductionCode,
    reductions,
    paymentAmount: record.sourceData.paymentAmount || undefined,
    paymentMethod: record.sourceData.paymentMethod || undefined,
    paymentStatus: record.sourceData.paymentStatus || undefined,
    paymentDate: record.sourceData.paymentDate || undefined,
    paymentReference: record.sourceData.paymentReference || undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toDetail(record: EnrollmentRecord): EnrollmentDetail {
  return {
    ...toSummary(record),
    helloAssoUrl: record.helloAssoUrl,
    fields: effectiveFields(record),
    issues: record.issues.map((issue) => ({
      ...issue,
      kind: issueRequiresDocument(record, issue) ? "DOCUMENT" : "FIELD",
      updatedAt: issue.updatedAt.toISOString(),
      documents: issue.documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() })),
    })),
    reminders: record.reminders.map((reminder) => ({ ...reminder, sentAt: reminder.sentAt.toISOString() })),
  };
}
