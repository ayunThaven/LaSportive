import { config } from "../config.js";
import type { AppRepository, CampaignRecord, SourceEnrollment } from "../domain/types.js";
import type { HelloAssoCampaignDto, HelloAssoFieldDto } from "@la-sportive/contracts";

type UnknownObject = Record<string, unknown>;

function object(value: unknown): UnknownObject {
  return value && typeof value === "object" ? value as UnknownObject : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  return "";
}

/**
 * HelloAsso may return custom fields at different depths depending on the
 * form version and the order endpoint. Walk the order payload instead of
 * assuming they always live directly on an item or its user.
 */
function customFieldContainers(value: unknown): unknown[][] {
  const containers: unknown[][] = [];
  const visited = new Set<UnknownObject>();
  const visit = (current: unknown) => {
    if (Array.isArray(current)) { current.forEach(visit); return; }
    const record = object(current);
    if (!Object.keys(record).length || visited.has(record)) return;
    visited.add(record);
    for (const [key, child] of Object.entries(record)) {
      if (key.toLocaleLowerCase("en-US") === "customfields" && Array.isArray(child)) containers.push(child);
      visit(child);
    }
  };
  visit(value);
  return containers;
}

function customFieldValues(...containers: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const container of containers) {
    const fields = Array.isArray(container) ? container : [];
    for (const raw of fields) {
      const field = object(raw);
      const value = text(field.answer ?? field.value ?? field.formattedValue ?? field.response);
      const id = text(field.id ?? field.fieldId ?? field.key ?? field.slug);
      const name = text(field.name ?? field.label ?? field.question);
      if (id) result[id] = value;
      if (name) result[name] = value;
    }
  }
  return result;
}

function customFieldDefinitions(...containers: unknown[]): HelloAssoFieldDto[] {
  const result = new Map<string, HelloAssoFieldDto>();
  for (const container of containers) {
    for (const raw of Array.isArray(container) ? container : []) {
      const field = object(raw);
      const label = text(field.name ?? field.label ?? field.question ?? field.title);
      const key = text(field.id ?? field.fieldId ?? field.key ?? field.slug) || label;
      if (key && label) result.set(key, { key, label });
    }
  }
  return [...result.values()];
}

function formCustomFieldDefinitions(value: unknown): HelloAssoFieldDto[] {
  const result = new Map<string, HelloAssoFieldDto>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const record = object(node);
    for (const [key, child] of Object.entries(record)) {
      if (key.toLocaleLowerCase("en-US") === "customfields") {
        for (const field of customFieldDefinitions(child)) result.set(field.key, field);
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return [...result.values()];
}

function isInactive(state: string) {
  const normalized = state.toLowerCase();
  return ["refund", "cancel", "aband", "rejet"].some((fragment) => normalized.includes(fragment));
}

function firstFieldValue(fields: Record<string, string>, ...keys: string[]) {
  return keys.map((key) => fields[key]).find((value) => Boolean(value)) ?? "";
}

function displayPaymentMethod(value: unknown): string {
  const method = text(value);
  const labels: Record<string, string> = {
    card: "Carte bancaire",
    check: "Chèque",
    cheque: "Chèque",
    cash: "Espèces",
    banktransfer: "Virement bancaire",
    transfer: "Virement bancaire",
    directdebit: "Prélèvement bancaire",
    sepa: "Prélèvement bancaire",
    applepay: "Apple Pay",
    googlepay: "Google Pay",
  };
  const key = method.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return labels[key] ?? method;
}

export function normalizeHelloAssoOrders(orders: unknown[], campaign: CampaignRecord): SourceEnrollment[] {
  const output: SourceEnrollment[] = [];
  const contactMapping = campaign.mappings.find((mapping) => mapping.sourceKey === "contactEmail" || mapping.label.toLowerCase().includes("mail de contact"));
  for (const rawOrder of orders) {
    const order = object(rawOrder);
    const orderId = text(order.id);
    const state = text(order.state ?? order.status);
    const payer = object(order.payer);
    const payments = Array.isArray(order.payments) ? order.payments.map(object) : [];
    const payment = payments.find((item) => !isInactive(text(item.state ?? item.status))) ?? payments[0] ?? {};
    const items = Array.isArray(order.items) ? order.items : [];
    for (const rawItem of items) {
      const item = object(rawItem);
      const itemId = text(item.id);
      if (!itemId) continue;
      const user = object(item.user ?? item.participant);
      const discount = object(item.discount);
      const fields = customFieldValues(...customFieldContainers(item), ...customFieldContainers(user), ...customFieldContainers(order));
      const firstName = text(user.firstName ?? item.firstName) || firstFieldValue(fields, "firstName", "Prénom");
      const lastName = text(user.lastName ?? item.lastName) || firstFieldValue(fields, "lastName", "Nom");
      // An order may contain non-member items (for example a contribution or
      // an adjustment). They carry the payer's email but no participant, and
      // must not create a second, anonymous member record.
      if (!firstName.trim() && !lastName.trim()) continue;
      const sourceData: Record<string, string> = {
        ...fields,
        firstName,
        lastName,
        // Semantic aliases keep existing mappings working while the source
        // remains the question label, not an ID regenerated with a new form.
        birthDate: firstFieldValue(fields, "birthDate", "Date de naissance"),
        address: firstFieldValue(fields, "address", "Adresse postale complète", "Adresse"),
        discountCode: text(discount.code),
        discountType: text(discount.code).split(":")[0]?.trim() ?? "",
        discountAmount: typeof discount.amount === "number" ? (discount.amount / 100).toFixed(2) : "",
        // The item identifies the membership option selected in HelloAsso
        // (for example "Adhésion adulte"), whereas paymentMeans only tells
        // us the technical payment channel ("Card", "Check", etc.).
        paymentAmount: typeof item.amount === "number" ? (item.amount / 100).toFixed(2) : typeof payment.amount === "number" ? (payment.amount / 100).toFixed(2) : "",
        paymentMethod: text(item.name ?? item.label ?? item.title) || displayPaymentMethod(payment.paymentMeans ?? payment.paymentMethod ?? payment.method ?? payment.type),
        paymentStatus: text(payment.state ?? payment.status ?? order.state ?? order.status),
        paymentDate: text(payment.date ?? payment.createdAt ?? payment.paymentDate),
        paymentReference: text(payment.id ?? payment.reference ?? payment.transactionId),
      };
      const contactEmail = contactMapping
        ? firstFieldValue(fields, contactMapping.sourceKey, contactMapping.label, "E-mail de contact", "Email de contact") || text(payer.email)
        : text(payer.email);
      sourceData.contactEmail = contactEmail;
      output.push({
        externalItemId: itemId,
        externalOrderId: orderId,
        campaignId: campaign.id,
        firstName,
        lastName,
        contactEmail,
        sourceData,
        helloAssoUrl: text(order.url ?? order.adminUrl) || undefined,
        active: !isInactive(state) && !isInactive(text(item.state ?? item.status)),
      });
    }
  }
  return output;
}

export class HelloAssoClient {
  private static accessToken?: { value: string; expiresAt: number };
  private static tokenRequest?: Promise<string>;
  private baseUrl = config.HELLOASSO_API_BASE_URL || (config.HELLOASSO_ENVIRONMENT === "sandbox"
    ? "https://api.helloasso-sandbox.com"
    : "https://api.helloasso.com");

  constructor(private tokenStore?: Pick<AppRepository, "getHelloAssoRefreshToken" | "saveHelloAssoRefreshToken" | "clearHelloAssoRefreshToken">) {}

  async getEnrollments(campaign: CampaignRecord): Promise<SourceEnrollment[]> {
    return normalizeHelloAssoOrders(await this.getRawOrders(campaign), campaign);
  }

  async listMembershipCampaigns(organizationSlug: string): Promise<HelloAssoCampaignDto[]> {
    if (config.DEMO_MODE) return [];
    const token = await this.getToken();
    const forms: HelloAssoCampaignDto[] = [];
    let pageIndex = 1;
    let hasNext = true;
    while (hasNext) {
      const url = new URL(`/v5/organizations/${encodeURIComponent(organizationSlug)}/forms`, this.baseUrl);
      url.searchParams.set("formTypes", "Membership");
      url.searchParams.set("pageIndex", String(pageIndex));
      url.searchParams.set("pageSize", "100");
      const response = await this.authorizedFetch(url, token);
      if (!response.ok) throw new Error(`HelloAsso a répondu avec le statut ${response.status}.`);
      const payload = object(await response.json());
      const data = Array.isArray(payload.data) ? payload.data : [];
      for (const raw of data) {
        const form = object(raw);
        const formSlug = text(form.formSlug);
        if (formSlug) forms.push({ id: text(form.id), title: text(form.title) || formSlug, formSlug, state: text(form.state), startDate: text(form.startDate) || undefined, endDate: text(form.endDate) || undefined });
      }
      const pagination = object(payload.pagination);
      hasNext = pageIndex < Number(pagination.totalPages ?? pageIndex) && data.length > 0;
      pageIndex += 1;
    }
    return forms;
  }

  async listCampaignFields(campaign: CampaignRecord): Promise<HelloAssoFieldDto[]> {
    const fields = new Map<string, HelloAssoFieldDto>([
      ["firstName", { key: "firstName", label: "Prénom" }],
      ["lastName", { key: "lastName", label: "Nom" }],
      ["contactEmail", { key: "contactEmail", label: "E-mail de contact" }],
      ["discountType", { key: "discountType", label: "Type de réduction" }],
      ["discountCode", { key: "discountCode", label: "Code de réduction" }],
      ["paymentAmount", { key: "paymentAmount", label: "Montant du paiement" }],
      ["paymentMethod", { key: "paymentMethod", label: "Option de paiement" }],
      ["paymentStatus", { key: "paymentStatus", label: "Statut du paiement" }],
      ["paymentDate", { key: "paymentDate", label: "Date du paiement" }],
      ["paymentReference", { key: "paymentReference", label: "Référence du paiement" }],
    ]);
    // A form definition is available before the first membership, including
    // fields attached to membership tiers.
    for (const field of formCustomFieldDefinitions(await this.getPublicForm(campaign))) fields.set(field.key, field);
    for (const rawOrder of await this.getRawOrders(campaign)) {
      const order = object(rawOrder);
      for (const rawItem of Array.isArray(order.items) ? order.items : []) {
        const item = object(rawItem);
        for (const field of customFieldDefinitions(...customFieldContainers(item), ...customFieldContainers(order))) fields.set(field.key, field);
      }
    }
    return [...fields.values()];
  }

  private async getPublicForm(campaign: CampaignRecord): Promise<unknown> {
    if (config.DEMO_MODE) return {};
    if (!config.HELLOASSO_CLIENT_ID || !config.HELLOASSO_CLIENT_SECRET) throw new Error("La connexion HelloAsso n’est pas configurée.");
    const token = await this.getToken();
    const url = new URL(`/v5/organizations/${encodeURIComponent(campaign.organizationSlug)}/forms/Membership/${encodeURIComponent(campaign.formSlug)}/public`, this.baseUrl);
    const response = await this.authorizedFetch(url, token);
    if (!response.ok) throw new Error(`HelloAsso a répondu avec le statut ${response.status}.`);
    return response.json();
  }

  /**
   * Development diagnostic helper. The response deliberately remains
   * un-normalized so field identifiers can be mapped without guesswork.
   */
  async getRawOrders(campaign: CampaignRecord): Promise<unknown[]> {
    if (config.DEMO_MODE) return [];
    if (!config.HELLOASSO_CLIENT_ID || !config.HELLOASSO_CLIENT_SECRET) throw new Error("La connexion HelloAsso n’est pas configurée.");
    const token = await this.getToken();
    const orders: unknown[] = [];
    let pageIndex = 1;
    let hasNext = true;
    while (hasNext) {
      const url = new URL(`/v5/organizations/${encodeURIComponent(campaign.organizationSlug)}/forms/Membership/${encodeURIComponent(campaign.formSlug)}/orders`, this.baseUrl);
      url.searchParams.set("pageIndex", String(pageIndex));
      url.searchParams.set("pageSize", "100");
      // The form-field mappings rely on custom fields, which HelloAsso only
      // includes in order responses when this option is enabled.
      url.searchParams.set("withDetails", "true");
      const response = await this.authorizedFetch(url, token);
      if (!response.ok) throw new Error(`HelloAsso a répondu avec le statut ${response.status}.`);
      const payload = object(await response.json());
      const data = Array.isArray(payload.data) ? payload.data : [];
      orders.push(...data);
      const pagination = object(payload.pagination);
      const totalPages = Number(pagination.totalPages ?? pageIndex);
      hasNext = pageIndex < totalPages && data.length > 0;
      pageIndex += 1;
    }
    return orders;
  }

  static clearTokenCache() {
    HelloAssoClient.accessToken = undefined;
    HelloAssoClient.tokenRequest = undefined;
  }

  static resetTokenCacheForTests() { HelloAssoClient.clearTokenCache(); }

  private async authorizedFetch(url: URL, token: string) {
    let response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (response.status !== 401) return response;
    HelloAssoClient.accessToken = undefined;
    const renewedToken = await this.getToken();
    response = await fetch(url, { headers: { Authorization: `Bearer ${renewedToken}`, Accept: "application/json" } });
    return response;
  }

  private async getToken() {
    const cached = HelloAssoClient.accessToken;
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (!HelloAssoClient.tokenRequest) HelloAssoClient.tokenRequest = this.loadToken();
    try {
      return await HelloAssoClient.tokenRequest;
    } finally {
      HelloAssoClient.tokenRequest = undefined;
    }
  }

  private async loadToken() {
    const refreshToken = await this.tokenStore?.getHelloAssoRefreshToken();
    if (refreshToken) {
      try {
        return await this.requestRefreshToken(refreshToken);
      } catch {
        await this.tokenStore?.clearHelloAssoRefreshToken();
      }
    }
    return this.requestToken();
  }

  private async requestRefreshToken(refreshToken: string) {
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!response.ok) throw new Error(`Le renouvellement HelloAsso a échoué (statut ${response.status}).`);
    return this.saveTokenResponse(object(await response.json()));
  }

  private async requestToken() {
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.HELLOASSO_CLIENT_ID ?? "",
        client_secret: config.HELLOASSO_CLIENT_SECRET ?? "",
      }),
    });
    if (!response.ok) throw new Error("L’authentification HelloAsso a échoué.");
    const payload = object(await response.json());
    return this.saveTokenResponse(payload);
  }

  private async saveTokenResponse(payload: UnknownObject) {
    const token = text(payload.access_token);
    if (!token) throw new Error("HelloAsso n’a pas retourné de jeton d’accès.");
    const expiresIn = Number(payload.expires_in);
    const lifetime = Number.isFinite(expiresIn) && expiresIn > 60 ? expiresIn : 3600;
    HelloAssoClient.accessToken = { value: token, expiresAt: Date.now() + (lifetime - 30) * 1000 };
    const refreshToken = text(payload.refresh_token);
    if (refreshToken) await this.tokenStore?.saveHelloAssoRefreshToken(refreshToken);
    return token;
  }
}
