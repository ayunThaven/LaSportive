import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import {
  type AuthorizationRowDto,
  issueCreateSchema,
  issueStatusSchema,
  helloAssoCampaignSelectionSchema,
  loginSchema,
  overrideSchema,
  settingsUpdateSchema,
} from "@la-sportive/contracts";
import { config } from "./config.js";
import { complianceStatus, issueRequiresDocument, licenseReady, toDetail, toSummary } from "./domain/enrollment.js";
import type { AppRepository } from "./domain/types.js";
import { DriveStorage } from "./integrations/drive.js";
import { HelloAssoClient } from "./integrations/helloasso.js";
import { Mailer } from "./integrations/mailer.js";
import { SyncService } from "./services/sync.js";
import { hashPassword, verifyPassword } from "./security/password.js";

type Params = { id: string; issueId: string };

function fillTemplate(template: string, data: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (_match, key: string) => data[key] ?? "");
}

export async function registerRoutes(app: FastifyInstance, repository: AppRepository) {
  const mailer = new Mailer();
  const drive = new DriveStorage(repository);
  const sync = new SyncService(repository);
  const authUsername = config.DEMO_MODE ? config.DEMO_USERNAME : config.APP_USERNAME;
  const passwordHash = config.DEMO_MODE
    ? await hashPassword(config.DEMO_PASSWORD)
    : config.APP_PASSWORD_HASH ?? await hashPassword(config.APP_PASSWORD);

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Session expirée. Veuillez vous reconnecter." });
    }
  };

  const reminderPreview = async (enrollmentId: string) => {
    const enrollment = await repository.getEnrollment(enrollmentId);
    if (!enrollment) throw new Error("Adhérent introuvable.");
    const effective = toSummary(enrollment);
    if (!effective.contactEmail) throw new Error("L’e-mail de contact est manquant.");
    const openIssues = enrollment.issues.filter((issue) => issue.status !== "CONFORME");
    if (openIssues.length === 0) throw new Error("Aucune anomalie ouverte à relancer.");
    const settings = await repository.getSettings();
    return {
      enrollment,
      recipient: effective.contactEmail,
      subject: settings.emailSubject,
      body: fillTemplate(settings.emailTemplate, {
        prenom: effective.firstName,
        nom: effective.lastName,
        anomalies: openIssues.map((issue) => `• ${issue.fieldLabel} : ${issue.reason}`).join("\n"),
      }),
    };
  };
  const googleClient = () => {
    if (!config.GOOGLE_OAUTH_CLIENT_ID || !config.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error("Les identifiants OAuth Google ne sont pas configurés.");
    return new google.auth.OAuth2(config.GOOGLE_OAUTH_CLIENT_ID, config.GOOGLE_OAUTH_CLIENT_SECRET, config.GOOGLE_OAUTH_REDIRECT_URL);
  };

  app.get("/health", async () => ({ status: "ok", service: "la-sportive-api" }));

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    if (input.username !== authUsername || !(await verifyPassword(input.password, passwordHash))) {
      return reply.status(401).send({ message: "Identifiants incorrects." });
    }
    const token = await reply.jwtSign({ sub: "shared-account", username: input.username }, { expiresIn: "8h" });
    reply.setCookie("la_sportive_session", token, {
      httpOnly: true,
      sameSite: config.NODE_ENV === "production" ? "none" : "lax",
      secure: config.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return { user: { username: input.username }, token };
  });

  app.post("/api/v1/auth/logout", async (_request, reply) => {
    reply.clearCookie("la_sportive_session", { path: "/" });
    return { ok: true };
  });

  app.get("/api/v1/auth/session", { preHandler: authenticate }, async () => ({ authenticated: true, username: authUsername }));

  app.get("/api/v1/integrations/google-drive/authorize", { preHandler: authenticate }, async (_request, reply) => {
    const state = randomUUID();
    reply.setCookie("google_drive_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: config.NODE_ENV === "production", path: "/", maxAge: 600 });
    return reply.redirect(googleClient().generateAuthUrl({ access_type: "offline", prompt: "consent", state, scope: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.metadata.readonly"] }));
  });

  app.get("/api/v1/integrations/google-drive/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    if (query.error || !query.code || query.state !== request.cookies.google_drive_oauth_state) return reply.status(400).send({ message: "Autorisation Google Drive refusée ou invalide." });
    const auth = googleClient();
    const { tokens } = await auth.getToken(query.code);
    if (!tokens.refresh_token) return reply.status(422).send({ message: "Google n’a pas fourni de jeton de connexion. Révoquez l’accès à l’application puis recommencez." });
    await repository.saveGoogleDriveConnection({ refreshToken: tokens.refresh_token });
    reply.clearCookie("google_drive_oauth_state", { path: "/" });
    return reply.redirect(`${config.WEB_ORIGIN}/reglages?googleDrive=connected`);
  });

  app.get("/api/v1/integrations/google-drive/folders", { preHandler: authenticate }, async () => {
    const connection = await repository.getGoogleDriveConnection();
    if (!connection.refreshToken) throw new Error("Connectez d’abord votre compte Google Drive.");
    const auth = googleClient(); auth.setCredentials({ refresh_token: connection.refreshToken });
    const result = await google.drive({ version: "v3", auth }).files.list({ q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false", fields: "files(id,name)", orderBy: "name", pageSize: 100 });
    return { data: (result.data.files ?? []).filter((item) => item.id && item.name).map((item) => ({ id: item.id!, name: item.name! })) };
  });

  app.put("/api/v1/integrations/google-drive/folder", { preHandler: authenticate }, async (request) => {
    const body = request.body as { id?: string; name?: string };
    if (!body.id || !body.name) throw new Error("Sélectionnez un dossier Google Drive.");
    await repository.setGoogleDriveFolder({ folderId: body.id, folderName: body.name });
    return repository.getSettings();
  });

  app.delete("/api/v1/integrations/google-drive", { preHandler: authenticate }, async () => {
    await repository.clearGoogleDriveConnection();
    return repository.getSettings();
  });

  app.delete("/api/v1/integrations/gmail/session", { preHandler: authenticate }, async () => {
    mailer.resetConnection();
    return repository.getSettings();
  });

  app.get("/api/v1/enrollments", { preHandler: authenticate }, async (request) => {
    const query = request.query as { search?: string; status?: string };
    let items = (await repository.listEnrollments()).map(toSummary);
    if (query.search) {
      const needle = query.search.toLocaleLowerCase("fr");
      items = items.filter((item) => `${item.firstName} ${item.lastName} ${item.contactEmail}`.toLocaleLowerCase("fr").includes(needle));
    }
    if (query.status) items = items.filter((item) => item.complianceStatus === query.status || item.licenseStatus === query.status);
    return { data: items };
  });

  app.get<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id", { preHandler: authenticate }, async (request, reply) => {
    const record = await repository.getEnrollment(request.params.id);
    return record ? toDetail(record) : reply.status(404).send({ message: "Adhérent introuvable." });
  });

  app.put<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/override", { preHandler: authenticate }, async (request, reply) => {
    const input = overrideSchema.parse(request.body);
    await repository.saveOverride(request.params.id, input.fieldKey, input.value);
    const record = await repository.getEnrollment(request.params.id);
    return reply.send(record ? toDetail(record) : { ok: true });
  });

  app.post<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/issues", { preHandler: authenticate }, async (request, reply) => {
    const issue = await repository.createIssue(request.params.id, issueCreateSchema.parse(request.body));
    return reply.status(201).send(issue);
  });

  app.put<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/compliance/validate", { preHandler: authenticate }, async (request, reply) => {
    const record = await repository.getEnrollment(request.params.id);
    if (!record) return reply.status(404).send({ message: "Adhérent introuvable." });
    if (!["A_VALIDER", "VERIF_CERTIFICAT"].includes(complianceStatus(record))) return reply.status(422).send({ message: "Le dossier doit être complet et sans anomalie ouverte avant validation." });
    await repository.setComplianceValidated(record.id);
    return { ok: true };
  });

  app.get<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/reminder-preview", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { recipient, subject, body } = await reminderPreview(request.params.id);
      return { recipient, subject, body };
    } catch (error) {
      return reply.status(422).send({ message: error instanceof Error ? error.message : "Prévisualisation impossible." });
    }
  });

  app.patch<{ Params: Pick<Params, "issueId"> }>("/api/v1/issues/:issueId", { preHandler: authenticate }, async (request) => {
    const { status } = issueStatusSchema.parse(request.body);
    await repository.setIssueStatus(request.params.issueId, status);
    return { ok: true };
  });

  app.post<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/reminders", { preHandler: authenticate }, async (request, reply) => {
    let preview: Awaited<ReturnType<typeof reminderPreview>>;
    try { preview = await reminderPreview(request.params.id); }
    catch (error) { return reply.status(422).send({ message: error instanceof Error ? error.message : "Relance impossible." }); }
    const { enrollment, recipient, subject, body } = preview;
    let status: "SENT" | "FAILED" = "SENT";
    let error: string | undefined;
    try {
      await mailer.send({ to: recipient, subject, text: body });
    } catch (caught) {
      status = "FAILED";
      error = caught instanceof Error ? caught.message : "Échec d’envoi";
    }
    await repository.addReminder(enrollment.id, { recipient, subject, body, status, error });
    return status === "SENT" ? { status, preview: body } : reply.status(502).send({ message: error });
  });

  app.post<{ Params: Pick<Params, "issueId"> }>("/api/v1/issues/:issueId/documents", { preHandler: authenticate }, async (request, reply) => {
    const part = await request.file();
    if (!part) return reply.status(400).send({ message: "Aucun fichier reçu." });
    const enrollment = (await repository.listEnrollments()).find((item) => item.issues.some((issue) => issue.id === request.params.issueId));
    if (!enrollment) return reply.status(404).send({ message: "Anomalie introuvable." });
    const issue = enrollment.issues.find((item) => item.id === request.params.issueId);
    if (!issue || !issueRequiresDocument(enrollment, issue)) return reply.status(422).send({ message: "Un dépôt de correction est réservé aux anomalies de document." });
    const buffer = await part.toBuffer();
    const campaign = await repository.getActiveCampaign();
    const uploaded = await drive.upload({ name: part.filename, mimeType: part.mimetype, buffer, memberName: `${enrollment.firstName} ${enrollment.lastName}`, campaignName: campaign?.title ?? "Campagne", fieldLabel: issue.fieldLabel });
    await repository.addDocument(request.params.issueId, { ...uploaded, mimeType: part.mimetype });
    return reply.status(201).send(uploaded);
  });

  app.post<{ Params: { issueId: string; documentId: string } }>("/api/v1/issues/:issueId/documents/:documentId/validate", { preHandler: authenticate }, async (request, reply) => {
    try {
      await repository.validateDocumentCorrection(request.params.issueId, request.params.documentId);
      return { ok: true };
    } catch (error) {
      return reply.status(422).send({ message: error instanceof Error ? error.message : "Validation de la correction impossible." });
    }
  });

  app.put<{ Params: Pick<Params, "id"> }>("/api/v1/enrollments/:id/license", { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as { status?: "A_TRAITER" | "TRAITE" };
    const record = await repository.getEnrollment(request.params.id);
    if (!record) return reply.status(404).send({ message: "Adhérent introuvable." });
    if (body.status === "TRAITE" && !licenseReady(record)) return reply.status(422).send({ message: "Le dossier doit être validé avant de traiter sa licence." });
    await repository.setLicenseStatus(record.id, body.status === "TRAITE" ? "TRAITE" : "A_TRAITER");
    return { ok: true };
  });

  app.get("/api/v1/discounts", { preHandler: authenticate }, async () => {
    const data = (await repository.listEnrollments()).map(toSummary).filter((item) => item.discountType || item.discountCode || item.paymentAmount || item.paymentMethod);
    return { data };
  });

  app.get("/api/v1/authorizations", { preHandler: authenticate }, async () => {
    const data: AuthorizationRowDto[] = (await repository.listEnrollments()).map((record) => {
      const summary = toSummary(record);
      return {
        id: summary.id,
        firstName: summary.firstName,
        lastName: summary.lastName,
        contactEmail: summary.contactEmail,
        fields: toDetail(record).fields
          .filter((field) => field.kind === "AUTORISATION")
          .map(({ key, label, value }) => ({ key, label, value })),
      };
    });
    return { data };
  });

  app.get("/api/v1/settings", { preHandler: authenticate }, async () => repository.getSettings());

  app.put("/api/v1/settings", { preHandler: authenticate }, async (request) => {
    const input = settingsUpdateSchema.parse(request.body);
    await repository.updateSettings({
      ...input,
      mappings: input.mappings?.map((mapping) => ({ ...mapping, id: mapping.id ?? randomUUID() })),
    });
    return repository.getSettings();
  });

  app.get("/api/v1/helloasso/campaigns", { preHandler: authenticate }, async () => {
    const active = await repository.getActiveCampaign();
    const organizationSlug = config.HELLOASSO_ORGANIZATION_SLUG || active?.organizationSlug;
    if (!organizationSlug) throw new Error("Renseignez HELLOASSO_ORGANIZATION_SLUG pour charger les campagnes HelloAsso.");
    return { data: await new HelloAssoClient(repository).listMembershipCampaigns(organizationSlug) };
  });

  app.post("/api/v1/integrations/helloasso/test", { preHandler: authenticate }, async () => {
    const active = await repository.getActiveCampaign();
    const organizationSlug = config.HELLOASSO_ORGANIZATION_SLUG || active?.organizationSlug;
    if (!organizationSlug) throw new Error("Renseignez HELLOASSO_ORGANIZATION_SLUG pour tester la connexion HelloAsso.");
    const campaigns = await new HelloAssoClient(repository).listMembershipCampaigns(organizationSlug);
    return { connected: true, campaignCount: campaigns.length };
  });

  app.delete("/api/v1/integrations/helloasso/session", { preHandler: authenticate }, async () => {
    await repository.clearHelloAssoRefreshToken();
    HelloAssoClient.clearTokenCache();
    return { ok: true };
  });

  app.post("/api/v1/helloasso/campaigns/select", { preHandler: authenticate }, async (request) => {
    const selected = helloAssoCampaignSelectionSchema.parse(request.body);
    const active = await repository.getActiveCampaign();
    const organizationSlug = config.HELLOASSO_ORGANIZATION_SLUG || active?.organizationSlug;
    if (!organizationSlug) throw new Error("Renseignez HELLOASSO_ORGANIZATION_SLUG pour sélectionner une campagne.");
    const season = selected.season || selected.title.match(/20\d{2}(?:\s*[-/]\s*20\d{2})?/)?.[0] || String(new Date().getFullYear());
    await repository.activateHelloAssoCampaign({ helloAssoId: selected.id || undefined, title: selected.title, formSlug: selected.formSlug, season, organizationSlug });
    return repository.getSettings();
  });

  app.get<{ Params: { formSlug: string } }>("/api/v1/helloasso/campaigns/:formSlug/fields", { preHandler: authenticate }, async (request, reply) => {
    const active = await repository.getActiveCampaign();
    if (!active || active.formSlug !== request.params.formSlug) return reply.status(422).send({ message: "Sélectionnez d’abord cette campagne." });
    return { data: await new HelloAssoClient(repository).listCampaignFields(active) };
  });

  // Never register this endpoint outside local development: its unfiltered
  // payload includes personal data submitted in the HelloAsso form.
  if (config.NODE_ENV === "development") {
    app.get("/api/v1/dev/helloasso/raw", { preHandler: authenticate }, async (_request, reply) => {
      const campaign = await repository.getActiveCampaign();
      if (!campaign) return reply.status(422).send({ message: "Aucune campagne active n’est configurée." });
      reply.header("Cache-Control", "no-store");
      const orders = await new HelloAssoClient(repository).getRawOrders(campaign);
      return { campaign: { id: campaign.id, organizationSlug: campaign.organizationSlug, formSlug: campaign.formSlug }, orders };
    });
  }

  app.post("/api/v1/sync", { preHandler: authenticate }, async () => sync.run());

  return { sync };
}
