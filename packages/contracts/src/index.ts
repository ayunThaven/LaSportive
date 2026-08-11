import { z } from "zod";

export const complianceStatuses = [
  "INCOMPLET",
  "ANOMALIE",
  "VERIF_CERTIFICAT",
  "A_VALIDER",
  "VALIDE",
] as const;
export type ComplianceStatus = (typeof complianceStatuses)[number];

export const issueStatuses = [
  "NON_CONFORME",
  "RELANCE",
  "CORRECTION_RECUE",
  "CONFORME",
] as const;
export type IssueStatus = (typeof issueStatuses)[number];

export const mappingKinds = ["IDENTITE", "LICENCE", "DOCUMENT", "REDUCTION_TYPE", "REDUCTION_CODE"] as const;
export type MappingKind = (typeof mappingKinds)[number];

export type EffectiveField = {
  key: string;
  label: string;
  value: string;
  sourceValue: string;
  overridden: boolean;
  required: boolean;
  kind: MappingKind;
  position: number;
  reductionDevice?: string;
};

export type ComplianceIssueDto = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  kind: "FIELD" | "DOCUMENT";
  reason: string;
  status: IssueStatus;
  updatedAt: string;
  documents: DriveDocumentDto[];
};

export type DriveDocumentDto = {
  id: string;
  name: string;
  mimeType: string;
  driveUrl: string;
  createdAt: string;
};

export type ReminderDto = {
  id: string;
  recipient: string;
  subject: string;
  status: "SENT" | "FAILED";
  error?: string;
  sentAt: string;
};

export type EnrollmentSummary = {
  id: string;
  externalItemId: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  complianceStatus: ComplianceStatus;
  licenseStatus: "A_TRAITER" | "TRAITE";
  licenseProcessedAt?: string;
  licenseReady: boolean;
  discountType?: string;
  discountCode?: string;
  reductions: { device: string; code: string }[];
  updatedAt: string;
};

export type EnrollmentDetail = EnrollmentSummary & {
  helloAssoUrl?: string;
  fields: EffectiveField[];
  issues: ComplianceIssueDto[];
  reminders: ReminderDto[];
};

export type FieldMappingDto = {
  id: string;
  sourceKey: string;
  label: string;
  kind: MappingKind;
  required: boolean;
  position: number;
  reductionDevice?: string;
};

export type CampaignDto = {
  id: string;
  title: string;
  season: string;
  organizationSlug: string;
  formSlug: string;
  active: boolean;
  archived: boolean;
  mappings: FieldMappingDto[];
};

export type HelloAssoCampaignDto = {
  id: string;
  title: string;
  formSlug: string;
  state: string;
  startDate?: string;
  endDate?: string;
};

export type HelloAssoFieldDto = {
  key: string;
  label: string;
};

export type SyncRunDto = {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  imported: number;
  updated: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

export type SettingsDto = {
  campaigns: CampaignDto[];
  activeCampaignId?: string;
  emailSubject: string;
  emailTemplate: string;
  integrations: {
    helloAsso: boolean;
    smtp: boolean;
    googleDrive: boolean;
  };
  googleDrive?: { connected: boolean; folderId?: string; folderName?: string };
  syncRuns: SyncRunDto[];
};

export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(8).max(200),
});

export const issueCreateSchema = z.object({
  fieldKey: z.string().min(1).max(200),
  fieldLabel: z.string().min(1).max(200),
  kind: z.enum(["FIELD", "DOCUMENT"]),
  reason: z.string().min(3).max(1000),
});

export const issueStatusSchema = z.object({ status: z.enum(issueStatuses) });

export const overrideSchema = z.object({
  fieldKey: z.string().min(1).max(200),
  value: z.string().max(2000),
});

export const mappingSchema = z.object({
  id: z.string().optional(),
  sourceKey: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  kind: z.enum(mappingKinds),
  required: z.boolean().default(false),
  position: z.number().int().min(0),
  reductionDevice: z.string().min(1).max(100).optional(),
});

export const settingsUpdateSchema = z.object({
  activeCampaignId: z.string().optional(),
  emailSubject: z.string().min(1).max(200),
  emailTemplate: z.string().min(1).max(5000),
  mappings: z.array(mappingSchema).optional(),
});

export const helloAssoCampaignSelectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  formSlug: z.string().min(1).max(200),
  season: z.string().max(50).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
