import type { FieldMappingDto, IssueCreateInput, IssueStatus, SettingsDto } from "@la-sportive/contracts";

export type DocumentRecord = {
  id: string;
  name: string;
  mimeType: string;
  driveUrl: string;
  createdAt: Date;
};

export type IssueRecord = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  kind: "FIELD" | "DOCUMENT";
  reason: string;
  status: IssueStatus;
  updatedAt: Date;
  documents: DocumentRecord[];
};

export type ReminderRecord = {
  id: string;
  recipient: string;
  subject: string;
  status: "SENT" | "FAILED";
  error?: string;
  sentAt: Date;
};

export type EnrollmentRecord = {
  id: string;
  externalItemId: string;
  externalOrderId: string;
  campaignId: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  sourceData: Record<string, string>;
  overrides: Record<string, string>;
  helloAssoUrl?: string;
  active: boolean;
  complianceValidatedAt?: Date;
  licenseStatus: "A_TRAITER" | "TRAITE";
  licenseProcessedAt?: Date;
  updatedAt: Date;
  mappings: FieldMappingDto[];
  issues: IssueRecord[];
  reminders: ReminderRecord[];
};

export type SourceEnrollment = {
  externalItemId: string;
  externalOrderId: string;
  campaignId: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  sourceData: Record<string, string>;
  helloAssoUrl?: string;
  active: boolean;
};

export type CampaignRecord = {
  id: string;
  title: string;
  season: string;
  organizationSlug: string;
  formSlug: string;
  active: boolean;
  archived: boolean;
  mappings: FieldMappingDto[];
};

export interface AppRepository {
  listEnrollments(): Promise<EnrollmentRecord[]>;
  getEnrollment(id: string): Promise<EnrollmentRecord | undefined>;
  saveOverride(enrollmentId: string, fieldKey: string, value: string): Promise<void>;
  createIssue(enrollmentId: string, input: IssueCreateInput): Promise<IssueRecord>;
  setIssueStatus(issueId: string, status: IssueStatus): Promise<void>;
  addDocument(issueId: string, document: Omit<DocumentRecord, "id" | "createdAt"> & { driveFileId: string }): Promise<void>;
  validateDocumentCorrection(issueId: string, documentId: string): Promise<void>;
  addReminder(enrollmentId: string, reminder: Omit<ReminderRecord, "id" | "sentAt"> & { body: string }): Promise<void>;
  setLicenseStatus(enrollmentId: string, status: "A_TRAITER" | "TRAITE"): Promise<void>;
  setComplianceValidated(enrollmentId: string): Promise<void>;
  getSettings(): Promise<SettingsDto>;
  updateSettings(input: { activeCampaignId?: string; emailSubject: string; emailTemplate: string; mappings?: FieldMappingDto[] }): Promise<void>;
  activateHelloAssoCampaign(input: { helloAssoId?: string; title: string; formSlug: string; season: string; organizationSlug: string }): Promise<void>;
  getActiveCampaign(): Promise<CampaignRecord | undefined>;
  createSyncRun(campaignId: string): Promise<string>;
  finishSyncRun(id: string, result: { status: "SUCCESS" | "FAILED"; imported: number; updated: number; error?: string }): Promise<void>;
  upsertSourceEnrollment(input: SourceEnrollment): Promise<"imported" | "updated">;
  deactivateMissingEnrollments(campaignId: string, externalItemIds: string[]): Promise<number>;
  getHelloAssoRefreshToken(): Promise<string | undefined>;
  saveHelloAssoRefreshToken(refreshToken: string): Promise<void>;
  clearHelloAssoRefreshToken(): Promise<void>;
  getGoogleDriveConnection(): Promise<{ refreshToken?: string; folderId?: string; folderName?: string }>;
  saveGoogleDriveConnection(input: { refreshToken: string; folderId?: string; folderName?: string }): Promise<void>;
  setGoogleDriveFolder(input: { folderId: string; folderName: string }): Promise<void>;
  clearGoogleDriveConnection(): Promise<void>;
}
