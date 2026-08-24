import type { FieldMappingDto, IssueCreateInput, IssueStatus, MappingKind, SettingsDto } from "@la-sportive/contracts";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config.js";
import { issueRequiresDocument } from "../domain/enrollment.js";
import type { AppRepository, CampaignRecord, EnrollmentRecord, SourceEnrollment } from "../domain/types.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });

const enrollmentInclude = {
  campaign: { include: { mappings: { orderBy: { position: "asc" as const } } } },
  overrides: true,
  issues: { include: { documents: true }, orderBy: { updatedAt: "desc" as const } },
  reminders: { orderBy: { sentAt: "desc" as const } },
};

type RawEnrollment = NonNullable<Awaited<ReturnType<typeof prisma.enrollment.findFirst<{ include: typeof enrollmentInclude }>>>>;

function mappingDto(mapping: { id: string; sourceKey: string; label: string; kind: string; required: boolean; position: number; reductionDevice?: string | null }): FieldMappingDto {
  return { ...mapping, reductionDevice: mapping.reductionDevice ?? undefined, kind: mapping.kind as MappingKind };
}

function enrollmentRecord(row: RawEnrollment): EnrollmentRecord {
  return {
    id: row.id,
    externalItemId: row.externalItemId,
    externalOrderId: row.externalOrderId,
    campaignId: row.campaignId,
    firstName: row.firstName,
    lastName: row.lastName,
    contactEmail: row.contactEmail,
    sourceData: row.sourceData as Record<string, string>,
    overrides: Object.fromEntries(row.overrides.map((item) => [item.fieldKey, item.value])),
    helloAssoUrl: row.helloAssoUrl ?? undefined,
    active: row.active,
    complianceValidatedAt: row.complianceValidatedAt ?? undefined,
    licenseStatus: row.licenseStatus,
    licenseProcessedAt: row.licenseProcessedAt ?? undefined,
    updatedAt: row.updatedAt,
    mappings: row.campaign.mappings.map(mappingDto),
    issues: row.issues.map((issue) => ({
      id: issue.id,
      fieldKey: issue.fieldKey,
      fieldLabel: issue.fieldLabel,
      kind: issue.kind as "FIELD" | "DOCUMENT",
      reason: issue.reason,
      status: issue.status,
      updatedAt: issue.updatedAt,
      documents: issue.documents.map((document) => ({ id: document.id, name: document.name, mimeType: document.mimeType, driveUrl: document.driveUrl, createdAt: document.createdAt })),
    })),
    reminders: row.reminders.map((reminder) => ({ id: reminder.id, recipient: reminder.recipient, subject: reminder.subject, status: reminder.status as "SENT" | "FAILED", error: reminder.error ?? undefined, sentAt: reminder.sentAt })),
  };
}

export class PrismaRepository implements AppRepository {
  async listEnrollments() {
    const rows = await prisma.enrollment.findMany({ where: { active: true, campaign: { active: true } }, include: enrollmentInclude, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
    return rows.filter((row) => Boolean(row.firstName.trim() || row.lastName.trim())).map(enrollmentRecord);
  }

  async getEnrollment(id: string) {
    const row = await prisma.enrollment.findUnique({ where: { id }, include: enrollmentInclude });
    return row ? enrollmentRecord(row) : undefined;
  }

  async saveOverride(enrollmentId: string, fieldKey: string, value: string) {
    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { campaign: { include: { mappings: true } } } });
    if (!enrollment) throw new Error("Adhérent introuvable");
    await prisma.$transaction([
      prisma.fieldOverride.upsert({ where: { enrollmentId_fieldKey: { enrollmentId, fieldKey } }, create: { enrollmentId, fieldKey, value }, update: { value } }),
      prisma.enrollment.update({ where: { id: enrollmentId }, data: { complianceValidatedAt: null, licenseStatus: "A_TRAITER", licenseProcessedAt: null } }),
    ]);
  }

  async createIssue(enrollmentId: string, input: IssueCreateInput) {
    const issue = await prisma.complianceIssue.create({ data: { enrollmentId, ...input }, include: { documents: true } });
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { complianceValidatedAt: null, licenseStatus: "A_TRAITER", licenseProcessedAt: null } });
    return { ...issue, kind: issue.kind as "FIELD" | "DOCUMENT", documents: [], status: issue.status };
  }

  async setIssueStatus(issueId: string, status: IssueStatus) {
    await prisma.complianceIssue.update({ where: { id: issueId }, data: { status } });
  }

  async addDocument(issueId: string, document: { driveFileId: string; driveUrl: string; name: string; mimeType: string }) {
    await prisma.$transaction(async (tx) => {
      const issue = await tx.complianceIssue.findUnique({ where: { id: issueId }, include: { enrollment: { include: { campaign: { include: { mappings: true } } } } } });
      if (!issue) throw new Error("Anomalie introuvable");
      if (!issueRequiresDocument({ mappings: issue.enrollment.campaign.mappings.map(mappingDto) }, issue)) throw new Error("Un dépôt de correction est réservé aux anomalies de document.");
      await tx.driveDocument.create({ data: { issueId, ...document } });
      await tx.complianceIssue.update({ where: { id: issueId }, data: { status: "CORRECTION_RECUE" } });
    });
  }

  async validateDocumentCorrection(issueId: string, documentId: string) {
    await prisma.$transaction(async (tx) => {
      const issue = await tx.complianceIssue.findUnique({ where: { id: issueId }, include: { documents: { where: { id: documentId } }, enrollment: { include: { campaign: { include: { mappings: true } } } } } });
      const document = issue?.documents[0];
      if (!issue || !document) throw new Error("Correction introuvable");
      if (!issueRequiresDocument({ mappings: issue.enrollment.campaign.mappings.map(mappingDto) }, issue)) throw new Error("Cette anomalie ne concerne pas un document.");
      await tx.fieldOverride.upsert({
        where: { enrollmentId_fieldKey: { enrollmentId: issue.enrollmentId, fieldKey: issue.fieldKey } },
        create: { enrollmentId: issue.enrollmentId, fieldKey: issue.fieldKey, value: document.driveUrl },
        update: { value: document.driveUrl },
      });
      await tx.enrollment.update({ where: { id: issue.enrollmentId }, data: { complianceValidatedAt: null, licenseStatus: "A_TRAITER", licenseProcessedAt: null } });
      await tx.complianceIssue.update({ where: { id: issueId }, data: { status: "CONFORME" } });
    });
  }

  async addReminder(enrollmentId: string, reminder: { recipient: string; subject: string; body: string; status: "SENT" | "FAILED"; error?: string }) {
    await prisma.$transaction([
      prisma.reminder.create({ data: { enrollmentId, ...reminder } }),
      prisma.complianceIssue.updateMany({ where: { enrollmentId, status: "NON_CONFORME" }, data: { status: "RELANCE" } }),
    ]);
  }

  async setLicenseStatus(enrollmentId: string, status: "A_TRAITER" | "TRAITE") {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { licenseStatus: status, licenseProcessedAt: status === "TRAITE" ? new Date() : null } });
  }

  async setComplianceValidated(enrollmentId: string) {
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { complianceValidatedAt: new Date() } });
  }

  async getSettings(): Promise<SettingsDto> {
    const [campaigns, setting, syncRuns] = await Promise.all([
      prisma.campaign.findMany({ include: { mappings: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } }),
      prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "Bonjour {{prenom}},\n\nMerci de corriger :\n{{anomalies}}\n\nBien sportivement,\nLa Sportive" }, update: {} }),
      prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    ]);
    return {
      campaigns: campaigns.map((item) => ({ ...item, mappings: item.mappings.map(mappingDto) })),
      activeCampaignId: campaigns.find((item) => item.active)?.id,
      emailSubject: setting.emailSubject,
      emailTemplate: setting.emailTemplate,
      integrations: {
        helloAsso: Boolean(config.HELLOASSO_CLIENT_ID && config.HELLOASSO_CLIENT_SECRET),
        smtp: Boolean(config.SMTP_HOST),
        googleDrive: Boolean(setting.googleDriveRefreshToken && setting.googleDriveFolderId),
      },
      googleDrive: { connected: Boolean(setting.googleDriveRefreshToken), folderId: setting.googleDriveFolderId ?? undefined, folderName: setting.googleDriveFolderName ?? undefined },
      syncRuns: syncRuns.map((run) => ({ ...run, error: run.error ?? undefined, startedAt: run.startedAt.toISOString(), finishedAt: run.finishedAt?.toISOString() })),
    };
  }

  async updateSettings(input: { activeCampaignId?: string; emailSubject: string; emailTemplate: string; mappings?: FieldMappingDto[] }) {
    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { id: "singleton" }, create: { emailSubject: input.emailSubject, emailTemplate: input.emailTemplate }, update: { emailSubject: input.emailSubject, emailTemplate: input.emailTemplate } });
      const campaignId = input.activeCampaignId ?? (await tx.campaign.findFirst({ where: { active: true } }))?.id;
      if (input.activeCampaignId) {
        await tx.campaign.updateMany({ data: { active: false, archived: true } });
        await tx.campaign.update({ where: { id: input.activeCampaignId }, data: { active: true, archived: false } });
      }
      if (campaignId && input.mappings) {
        await tx.fieldMapping.deleteMany({ where: { campaignId } });
        const mappings = [...new Map(input.mappings.map(({ id: _id, ...mapping }) => [`${mapping.sourceKey}:${mapping.kind}:${mapping.reductionDevice ?? ""}`, mapping])).values()];
        await tx.fieldMapping.createMany({ data: mappings.map((mapping) => ({ ...mapping, campaignId })) });
      }
    });
  }

  async activateHelloAssoCampaign(input: { helloAssoId?: string; title: string; formSlug: string; season: string; organizationSlug: string }) {
    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.upsert({
        where: { organizationSlug_formSlug: { organizationSlug: input.organizationSlug, formSlug: input.formSlug } },
        create: { ...input, active: true, archived: false },
        update: { helloAssoId: input.helloAssoId, title: input.title, season: input.season, active: true, archived: false },
      });
      await tx.campaign.updateMany({ where: { id: { not: campaign.id } }, data: { active: false, archived: true } });
    });
  }

  async getActiveCampaign(): Promise<CampaignRecord | undefined> {
    const row = await prisma.campaign.findFirst({ where: { active: true }, include: { mappings: { orderBy: { position: "asc" } } } });
    return row ? { ...row, mappings: row.mappings.map(mappingDto) } : undefined;
  }

  async createSyncRun(campaignId: string) {
    return (await prisma.syncRun.create({ data: { campaignId } })).id;
  }

  async finishSyncRun(id: string, result: { status: "SUCCESS" | "FAILED"; imported: number; updated: number; error?: string }) {
    await prisma.syncRun.update({ where: { id }, data: { ...result, finishedAt: new Date() } });
  }

  async upsertSourceEnrollment(input: SourceEnrollment) {
    const existing = await prisma.enrollment.findUnique({ where: { externalItemId: input.externalItemId } });
    await prisma.enrollment.upsert({
      where: { externalItemId: input.externalItemId },
      create: input,
      update: { ...input, complianceValidatedAt: existing?.complianceValidatedAt, licenseStatus: existing && JSON.stringify(existing.sourceData) !== JSON.stringify(input.sourceData) ? "A_TRAITER" : existing?.licenseStatus, licenseProcessedAt: existing && JSON.stringify(existing.sourceData) !== JSON.stringify(input.sourceData) ? null : existing?.licenseProcessedAt },
    });
    return existing ? "updated" : "imported";
  }

  async deactivateMissingEnrollments(campaignId: string, externalItemIds: string[]) {
    const result = await prisma.enrollment.updateMany({
      where: { campaignId, active: true, externalItemId: { notIn: externalItemIds } },
      data: { active: false },
    });
    return result.count;
  }

  async getHelloAssoRefreshToken() {
    const setting = await prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "" }, update: {} });
    return setting.helloAssoRefreshToken ?? undefined;
  }

  async saveHelloAssoRefreshToken(refreshToken: string) {
    await prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "", helloAssoRefreshToken: refreshToken }, update: { helloAssoRefreshToken: refreshToken } });
  }

  async clearHelloAssoRefreshToken() {
    await prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "" }, update: { helloAssoRefreshToken: null } });
  }

  async getGoogleDriveConnection() {
    const setting = await prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "" }, update: {} });
    return { refreshToken: setting.googleDriveRefreshToken ?? undefined, folderId: setting.googleDriveFolderId ?? undefined, folderName: setting.googleDriveFolderName ?? undefined };
  }

  async saveGoogleDriveConnection(input: { refreshToken: string; folderId?: string; folderName?: string }) {
    await prisma.appSetting.upsert({ where: { id: "singleton" }, create: { emailTemplate: "", googleDriveRefreshToken: input.refreshToken, googleDriveFolderId: input.folderId, googleDriveFolderName: input.folderName }, update: { googleDriveRefreshToken: input.refreshToken, googleDriveFolderId: input.folderId, googleDriveFolderName: input.folderName } });
  }

  async setGoogleDriveFolder(input: { folderId: string; folderName: string }) {
    await prisma.appSetting.update({ where: { id: "singleton" }, data: { googleDriveFolderId: input.folderId, googleDriveFolderName: input.folderName } });
  }

  async clearGoogleDriveConnection() {
    await prisma.appSetting.update({ where: { id: "singleton" }, data: { googleDriveRefreshToken: null, googleDriveFolderId: null, googleDriveFolderName: null } });
  }
}
