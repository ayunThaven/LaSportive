import { afterEach, describe, expect, it } from "vitest";
import { HelloAssoClient, normalizeHelloAssoOrders } from "./helloasso.js";
import type { CampaignRecord } from "../domain/types.js";

const campaign: CampaignRecord = {
  id: "campaign", title: "Adhésions", season: "2026", organizationSlug: "club", formSlug: "adhesions", active: true, archived: false,
  mappings: [{ id: "email", sourceKey: "contact-parent", label: "E-mail de contact", kind: "IDENTITE", required: true, position: 1 }],
};

describe("normalisation HelloAsso", () => {
  afterEach(() => HelloAssoClient.resetTokenCacheForTests());
  it("crée un dossier par participant et utilise le champ de contact mappé", () => {
    const result = normalizeHelloAssoOrders([{ id: 90, state: "Processed", payer: { email: "payeur@example.org", firstName: "Camille", lastName: "Martin" }, items: [
      { id: 1, user: { firstName: "Lina", lastName: "Petit" }, customFields: [{ id: "contact-parent", name: "E-mail de contact", answer: "parent@example.org" }] },
      { id: 2, user: { firstName: "Noé", lastName: "Petit" }, customFields: [{ id: "contact-parent", answer: "parent@example.org" }] },
    ] }], campaign);
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.externalItemId)).toEqual(["1", "2"]);
    expect(result.every((item) => item.contactEmail === "parent@example.org")).toBe(true);
    expect(result.every((item) => item.sourceData.payerFirstName === "Camille" && item.sourceData.payerLastName === "Martin")).toBe(true);
  });

  it("utilise l’e-mail du payeur et les libellés de questions lorsque les IDs changent", () => {
    const [item] = normalizeHelloAssoOrders([{ id: 92, payer: { email: "parent@example.org" }, items: [{ id: 4, user: { firstName: "Mila", lastName: "Noir" }, customFields: [
      { id: 99999, name: "Date de naissance", answer: "03/11/2003" },
      { id: 88888, name: "Adresse postale complète", answer: "1 rue des Sports" },
    ] }] }], campaign);
    expect(item?.contactEmail).toBe("parent@example.org");
    expect(item?.sourceData.birthDate).toBe("03/11/2003");
    expect(item?.sourceData.address).toBe("1 rue des Sports");
  });

  it("ignore les lignes de commande qui ne correspondent à aucun adhérent", () => {
    const result = normalizeHelloAssoOrders([{ id: 94, payer: { email: "parent@example.org" }, items: [
      { id: "adjustment" },
      { id: "member", user: { firstName: "Lina", lastName: "Petit" } },
    ] }], campaign);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ externalItemId: "member", firstName: "Lina", lastName: "Petit" });
  });

  it("désactive les éléments remboursés", () => {
    const [item] = normalizeHelloAssoOrders([{ id: 91, state: "Refunded", items: [{ id: 3, user: { firstName: "Eva", lastName: "Roux" } }] }], campaign);
    expect(item?.active).toBe(false);
  });

  it("récupère le code promotionnel HelloAsso de l’article", () => {
    const [item] = normalizeHelloAssoOrders([{ id: 93, items: [{ id: 5, user: { firstName: "Bob", lastName: "Durand" }, discount: { code: "PASSPORT : -150,00€", amount: 15000 } }] }], campaign);
    expect(item?.sourceData.discountType).toBe("PASSPORT");
    expect(item?.sourceData.discountCode).toBe("PASSPORT : -150,00€");
    expect(item?.sourceData.discountAmount).toBe("150.00");
  });

  it("normalise les informations de paiement de la commande", () => {
    const [item] = normalizeHelloAssoOrders([{ id: 95, state: "Processed", payments: [{ id: 42, amount: 2500, paymentMeans: "Card", state: "Authorized", date: "2026-08-20" }], items: [{ id: 6, name: "Adhésion adulte", amount: 12000, user: { firstName: "Lina", lastName: "Petit" } }] }], campaign);
    expect(item?.sourceData).toMatchObject({ paymentAmount: "120.00", paymentMethod: "Adhésion adulte", paymentStatus: "Authorized", paymentDate: "2026-08-20", paymentReference: "42" });
  });

  it("demande les détails afin de recevoir les champs personnalisés", async () => {
    const requests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      if (requests.length === 1) return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
      return new Response(JSON.stringify({ data: [], pagination: { totalPages: 1 } }), { status: 200 });
    };
    try {
      await new HelloAssoClient().getEnrollments(campaign);
      expect(requests[1]).toContain("withDetails=true");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("récupère les champs d’une campagne brouillon même sans adhésion", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
      if (url.endsWith("/public")) return new Response(JSON.stringify({ tiers: [{ customFields: [
        { id: 123, name: "Certificat médical" },
        { id: 456, name: "Numéro de licence" },
      ] }] }), { status: 200 });
      return new Response(JSON.stringify({ data: [], pagination: { totalPages: 1 } }), { status: 200 });
    };
    try {
      const fields = await new HelloAssoClient().listCampaignFields(campaign);
      expect(fields).toEqual(expect.arrayContaining([
        { key: "123", label: "Certificat médical" },
        { key: "456", label: "Numéro de licence" },
        { key: "paymentAmount", label: "Montant du paiement" },
      ]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("peut exposer les commandes brutes sans les normaliser", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input) => new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    try {
      globalThis.fetch = async (input) => String(input).includes("oauth2/token")
        ? new Response(JSON.stringify({ access_token: "token" }), { status: 200 })
        : new Response(JSON.stringify({ data: [{ id: 90, items: [] }], pagination: { totalPages: 1 } }), { status: 200 });
      await expect(new HelloAssoClient().getRawOrders(campaign)).resolves.toEqual([{ id: 90, items: [] }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
