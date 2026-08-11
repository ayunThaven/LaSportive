import { randomUUID } from "node:crypto";
import type { FieldMappingDto, IssueCreateInput, IssueStatus, SettingsDto } from "@la-sportive/contracts";
import { config } from "../config.js";
import { issueRequiresDocument } from "../domain/enrollment.js";
import type {
  AppRepository,
  CampaignRecord,
  DocumentRecord,
  EnrollmentRecord,
  IssueRecord,
  ReminderRecord,
  SourceEnrollment,
} from "../domain/types.js";

const now = new Date();

const mappings: FieldMappingDto[] = [
  { id: "m-prenom", sourceKey: "firstName", label: "Prénom", kind: "LICENCE", required: true, position: 1 },
  { id: "m-nom", sourceKey: "lastName", label: "Nom", kind: "LICENCE", required: true, position: 2 },
  { id: "m-date", sourceKey: "birthDate", label: "Date de naissance", kind: "LICENCE", required: true, position: 3 },
  { id: "m-email", sourceKey: "contactEmail", label: "E-mail de contact", kind: "LICENCE", required: true, position: 4 },
  { id: "m-adresse", sourceKey: "address", label: "Adresse", kind: "LICENCE", required: true, position: 5 },
  { id: "m-photo", sourceKey: "identityPhoto", label: "Photo d’identité", kind: "DOCUMENT", required: true, position: 6 },
  { id: "m-aide", sourceKey: "discountType", label: "Type d’aide", kind: "REDUCTION_TYPE", required: false, position: 7 },
  { id: "m-code", sourceKey: "discountCode", label: "Code de réduction", kind: "REDUCTION_CODE", required: false, position: 8 },
];

const campaign: CampaignRecord = {
  id: "camp-2026",
  title: "Adhésions 2026–2027",
  season: "2026–2027",
  organizationSlug: "la-sportive",
  formSlug: "adhesions-2026-2027",
  active: true,
  archived: false,
  mappings,
};

const archivedCampaign: CampaignRecord = {
  ...campaign,
  id: "camp-2025",
  title: "Adhésions 2025–2026",
  season: "2025–2026",
  formSlug: "adhesions-2025-2026",
  active: false,
  archived: true,
};

function record(input: Partial<EnrollmentRecord> & Pick<EnrollmentRecord, "id" | "firstName" | "lastName">): EnrollmentRecord {
  const sourceData = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: "12/04/2011",
    contactEmail: `${input.firstName.toLowerCase()}@example.org`,
    address: "14 rue des Tilleuls, 69003 Lyon",
    identityPhoto: "Pièce fournie dans HelloAsso",
    discountType: "",
    discountCode: "",
    ...input.sourceData,
  };
  return {
    id: input.id,
    externalItemId: input.externalItemId ?? `item-${input.id}`,
    externalOrderId: input.externalOrderId ?? `order-${input.id}`,
    campaignId: campaign.id,
    firstName: input.firstName,
    lastName: input.lastName,
    contactEmail: sourceData.contactEmail,
    sourceData,
    overrides: input.overrides ?? {},
    helloAssoUrl: `https://admin.helloasso.com/la-sportive/commandes/${input.id}`,
    active: true,
    licenseStatus: input.licenseStatus ?? "A_TRAITER",
    licenseProcessedAt: input.licenseProcessedAt,
    updatedAt: input.updatedAt ?? now,
    mappings,
    issues: input.issues ?? [],
    reminders: input.reminders ?? [],
  };
}

export class DemoRepository implements AppRepository {
  private campaigns = [campaign, archivedCampaign];
  private emailSubject = "Votre inscription nécessite une correction";
  private emailTemplate = "Bonjour {{prenom}},\n\nNous avons vérifié votre inscription. Merci de répondre à ce message avec les corrections suivantes :\n\n{{anomalies}}\n\nBien sportivement,\nLa Sportive";
  private syncRuns: SettingsDto["syncRuns"] = [
    { id: "sync-1", status: "SUCCESS", imported: 42, updated: 3, startedAt: new Date(now.getTime() - 12 * 60_000).toISOString(), finishedAt: new Date(now.getTime() - 11 * 60_000).toISOString() },
  ];
  private helloAssoRefreshToken?: string;
  private enrollments: EnrollmentRecord[] = [
    record({ id: "emma", firstName: "Emma", lastName: "Bernard", licenseStatus: "TRAITE", licenseProcessedAt: new Date(now.getTime() - 86_400_000) }),
    record({
      id: "lucas",
      firstName: "Lucas",
      lastName: "Petit",
      issues: [{ id: "issue-photo", fieldKey: "identityPhoto", fieldLabel: "Photo d’identité", kind: "DOCUMENT", reason: "La photo est trop sombre et le visage n’est pas identifiable.", status: "RELANCE", updatedAt: new Date(now.getTime() - 3_600_000), documents: [] }],
      reminders: [{ id: "reminder-1", recipient: "lucas@example.org", subject: "Votre inscription nécessite une correction", status: "SENT", sentAt: new Date(now.getTime() - 3_600_000) }],
    }),
    record({
      id: "ines",
      firstName: "Inès",
      lastName: "Robert",
      sourceData: { discountType: "Pass’Sport", discountCode: "PS-8742-LOIRE" },
      issues: [{ id: "issue-address", fieldKey: "address", fieldLabel: "Adresse", kind: "FIELD", reason: "Le code postal est incomplet.", status: "CORRECTION_RECUE", updatedAt: new Date(now.getTime() - 900_000), documents: [] }],
      overrides: { address: "8 avenue Jean-Jaurès, 69007 Lyon" },
    }),
    record({ id: "hugo", firstName: "Hugo", lastName: "Morel", sourceData: { discountType: "Pass’Région", discountCode: "RA-A2F9-381" } }),
    record({ id: "lea", firstName: "Léa", lastName: "Garcia", sourceData: { birthDate: "", address: "3 impasse des Sports, 69100 Villeurbanne" } }),
  ];

  async listEnrollments() {
    const active = this.campaigns.find((item) => item.active);
    return this.enrollments.filter((item) => item.active && item.campaignId === active?.id);
  }

  async getEnrollment(id: string) {
    return this.enrollments.find((item) => item.id === id);
  }

  async saveOverride(enrollmentId: string, fieldKey: string, value: string) {
    const enrollment = this.requiredEnrollment(enrollmentId);
    enrollment.overrides[fieldKey] = value;
    enrollment.complianceValidatedAt = undefined;
    enrollment.licenseStatus = "A_TRAITER";
    enrollment.licenseProcessedAt = undefined;
    enrollment.updatedAt = new Date();
  }

  async createIssue(enrollmentId: string, input: IssueCreateInput): Promise<IssueRecord> {
    const enrollment = this.requiredEnrollment(enrollmentId);
    const issue: IssueRecord = { id: randomUUID(), ...input, status: "NON_CONFORME", updatedAt: new Date(), documents: [] };
    enrollment.issues.push(issue);
    enrollment.complianceValidatedAt = undefined;
    enrollment.licenseStatus = "A_TRAITER";
    enrollment.licenseProcessedAt = undefined;
    return issue;
  }

  async setIssueStatus(issueId: string, status: IssueStatus) {
    const issue = this.enrollments.flatMap((item) => item.issues).find((item) => item.id === issueId);
    if (!issue) throw new Error("Anomalie introuvable");
    issue.status = status;
    issue.updatedAt = new Date();
  }

  async addDocument(issueId: string, document: Omit<DocumentRecord, "id" | "createdAt"> & { driveFileId: string }) {
    const enrollment = this.enrollments.find((item) => item.issues.some((issue) => issue.id === issueId));
    const issue = enrollment?.issues.find((item) => item.id === issueId);
    if (!enrollment || !issue) throw new Error("Anomalie introuvable");
    if (!issueRequiresDocument(enrollment, issue)) throw new Error("Un dépôt de correction est réservé aux anomalies de document.");
    issue.documents.push({ id: document.driveFileId, name: document.name, mimeType: document.mimeType, driveUrl: document.driveUrl, createdAt: new Date() });
    issue.status = "CORRECTION_RECUE";
    issue.updatedAt = new Date();
  }

  async validateDocumentCorrection(issueId: string, documentId: string) {
    const enrollment = this.enrollments.find((item) => item.issues.some((issue) => issue.id === issueId));
    const issue = enrollment?.issues.find((item) => item.id === issueId);
    const document = issue?.documents.find((item) => item.id === documentId);
    if (!enrollment || !issue || !document) throw new Error("Correction introuvable");
    if (!issueRequiresDocument(enrollment, issue)) throw new Error("Cette anomalie ne concerne pas un document.");
    enrollment.overrides[issue.fieldKey] = document.driveUrl;
    enrollment.complianceValidatedAt = undefined;
    enrollment.licenseStatus = "A_TRAITER";
    enrollment.licenseProcessedAt = undefined;
    enrollment.updatedAt = new Date();
    issue.status = "CONFORME";
    issue.updatedAt = new Date();
  }

  async addReminder(enrollmentId: string, reminder: Omit<ReminderRecord, "id" | "sentAt"> & { body: string }) {
    const enrollment = this.requiredEnrollment(enrollmentId);
    enrollment.reminders.unshift({ id: randomUUID(), recipient: reminder.recipient, subject: reminder.subject, status: reminder.status, error: reminder.error, sentAt: new Date() });
    enrollment.issues.filter((issue) => issue.status === "NON_CONFORME").forEach((issue) => { issue.status = "RELANCE"; });
  }

  async setLicenseStatus(enrollmentId: string, status: "A_TRAITER" | "TRAITE") {
    const enrollment = this.requiredEnrollment(enrollmentId);
    enrollment.licenseStatus = status;
    enrollment.licenseProcessedAt = status === "TRAITE" ? new Date() : undefined;
  }

  async setComplianceValidated(enrollmentId: string) {
    this.requiredEnrollment(enrollmentId).complianceValidatedAt = new Date();
  }

  async getSettings(): Promise<SettingsDto> {
    return {
      campaigns: this.campaigns,
      activeCampaignId: this.campaigns.find((item) => item.active)?.id,
      emailSubject: this.emailSubject,
      emailTemplate: this.emailTemplate,
      integrations: {
        helloAsso: Boolean(config.HELLOASSO_CLIENT_ID && config.HELLOASSO_CLIENT_SECRET) || config.DEMO_MODE,
        smtp: Boolean(config.SMTP_HOST) || config.DEMO_MODE,
        googleDrive: Boolean(config.GOOGLE_SERVICE_ACCOUNT_BASE64 && config.GOOGLE_DRIVE_FOLDER_ID) || config.DEMO_MODE,
      },
      syncRuns: this.syncRuns,
    };
  }

  async updateSettings(input: { activeCampaignId?: string; emailSubject: string; emailTemplate: string; mappings?: FieldMappingDto[] }) {
    this.emailSubject = input.emailSubject;
    this.emailTemplate = input.emailTemplate;
    if (input.activeCampaignId) {
      this.campaigns.forEach((item) => { item.active = item.id === input.activeCampaignId; item.archived = !item.active; });
    }
    const active = this.campaigns.find((item) => item.active);
    if (active && input.mappings) active.mappings = input.mappings;
  }

  async activateHelloAssoCampaign(input: { helloAssoId?: string; title: string; formSlug: string; season: string; organizationSlug: string }) {
    let selected = this.campaigns.find((campaign) => campaign.organizationSlug === input.organizationSlug && campaign.formSlug === input.formSlug);
    if (!selected) {
      selected = { id: randomUUID(), ...input, active: false, archived: false, mappings: [] };
      this.campaigns.push(selected);
    }
    selected.title = input.title;
    this.campaigns.forEach((campaign) => { campaign.active = campaign.id === selected!.id; campaign.archived = !campaign.active; });
  }

  async getActiveCampaign() {
    return this.campaigns.find((item) => item.active);
  }

  async createSyncRun() {
    const id = randomUUID();
    this.syncRuns.unshift({ id, status: "RUNNING", imported: 0, updated: 0, startedAt: new Date().toISOString() });
    return id;
  }

  async finishSyncRun(id: string, result: { status: "SUCCESS" | "FAILED"; imported: number; updated: number; error?: string }) {
    const run = this.syncRuns.find((item) => item.id === id);
    if (run) Object.assign(run, result, { finishedAt: new Date().toISOString() });
  }

  async upsertSourceEnrollment(input: SourceEnrollment) {
    const existing = this.enrollments.find((item) => item.externalItemId === input.externalItemId);
    if (existing) {
      const changed = JSON.stringify(existing.sourceData) !== JSON.stringify(input.sourceData);
      Object.assign(existing, input, { complianceValidatedAt: changed ? undefined : existing.complianceValidatedAt, updatedAt: new Date() });
      return "updated" as const;
    }
    this.enrollments.push(record({ id: randomUUID(), ...input }));
    return "imported" as const;
  }

  async deactivateMissingEnrollments(campaignId: string, externalItemIds: string[]) {
    let count = 0;
    for (const enrollment of this.enrollments) {
      if (enrollment.campaignId === campaignId && enrollment.active && !externalItemIds.includes(enrollment.externalItemId)) {
        enrollment.active = false;
        count += 1;
      }
    }
    return count;
  }

  async getHelloAssoRefreshToken() { return this.helloAssoRefreshToken; }
  async saveHelloAssoRefreshToken(refreshToken: string) { this.helloAssoRefreshToken = refreshToken; }
  async clearHelloAssoRefreshToken() { this.helloAssoRefreshToken = undefined; }

  async getGoogleDriveConnection() { return {}; }
  async saveGoogleDriveConnection() {}
  async setGoogleDriveFolder() {}
  async clearGoogleDriveConnection() {}

  private requiredEnrollment(id: string) {
    const enrollment = this.enrollments.find((item) => item.id === id);
    if (!enrollment) throw new Error("Adhérent introuvable");
    return enrollment;
  }
}
