import { describe, expect, it } from "vitest";
import { complianceStatus, effectiveFields, issueRequiresDocument, licenseReady, toDetail, toSummary } from "./enrollment.js";
import type { EnrollmentRecord } from "./types.js";

function enrollment(patch: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  return {
    id: "member-1", externalItemId: "item-1", externalOrderId: "order-1", campaignId: "campaign-1",
    firstName: "Aïcha", lastName: "Martin", contactEmail: "contact@example.org",
    sourceData: { birthDate: "01/02/2012", discountType: "Pass’Sport", discountCode: "PS-42" },
    overrides: {}, active: true, licenseStatus: "A_TRAITER", updatedAt: new Date("2026-06-20T12:00:00Z"),
    mappings: [
      { id: "birth", sourceKey: "birthDate", label: "Date de naissance", kind: "LICENCE", required: true, position: 1 },
      { id: "type", sourceKey: "discountType", label: "Type", kind: "REDUCTION_TYPE", required: false, position: 2 },
      { id: "code", sourceKey: "discountCode", label: "Code", kind: "REDUCTION_CODE", required: false, position: 3 },
    ],
    issues: [], reminders: [], ...patch,
  };
}

describe("règles d’un dossier", () => {
  it("donne la priorité à une correction locale", () => {
    const fields = effectiveFields(enrollment({ overrides: { birthDate: "02/02/2012" } }));
    expect(fields[0]).toMatchObject({ value: "02/02/2012", sourceValue: "01/02/2012", overridden: true });
  });

  it("bloque la licence lorsqu’un champ obligatoire est non conforme", () => {
    const record = enrollment({ issues: [{ id: "issue", fieldKey: "birthDate", fieldLabel: "Date", kind: "FIELD", reason: "Incorrecte", status: "RELANCE", updatedAt: new Date(), documents: [] }] });
    expect(licenseReady(record)).toBe(false);
    expect(complianceStatus(record)).toBe("ANOMALIE");
  });

  it("applique le parcours de champ aux anciennes anomalies enregistrées comme document", () => {
    const detail = toDetail(enrollment({ issues: [{ id: "issue", fieldKey: "birthDate", fieldLabel: "Date", kind: "DOCUMENT", reason: "Incorrecte", status: "RELANCE", updatedAt: new Date(), documents: [] }] }));
    expect(detail.issues[0].kind).toBe("FIELD");
  });

  it("considère comme documents uniquement les liens HelloAsso Docs ou Google Drive", () => {
    expect(issueRequiresDocument(enrollment({ sourceData: { proof: "https://docs.helloasso.com/proof.pdf" } }), { fieldKey: "proof" })).toBe(true);
    expect(issueRequiresDocument(enrollment({ sourceData: { proof: "https://drive.google.com/file/d/proof/view" } }), { fieldKey: "proof" })).toBe(true);
    expect(issueRequiresDocument(enrollment({ sourceData: { proof: "contact@example.org" }, mappings: [{ id: "proof", sourceKey: "proof", label: "Justificatif", kind: "DOCUMENT", required: false, position: 1 }] }), { fieldKey: "proof" })).toBe(false);
  });

  it("marque incomplet un dossier dont une information de conformité est vide", () => {
    expect(complianceStatus(enrollment({
      sourceData: { identityPhoto: "" },
      mappings: [{ id: "photo", sourceKey: "identityPhoto", label: "Photo", kind: "DOCUMENT", required: false, position: 1 }],
    }))).toBe("INCOMPLET");
  });

  it("conserve un dossier validé malgré des informations de conformité manquantes", () => {
    expect(complianceStatus(enrollment({
      sourceData: { identityPhoto: "" },
      mappings: [{ id: "photo", sourceKey: "identityPhoto", label: "Photo", kind: "DOCUMENT", required: false, position: 1 }],
      complianceValidatedAt: new Date(),
    }))).toBe("VALIDE");
  });

  it("normalise les réductions dans le résumé", () => {
    expect(toSummary(enrollment())).toMatchObject({ discountType: "Pass’Sport", discountCode: "PS-42" });
  });

  it("affiche les libellés de réduction avec leur orthographe métier", () => {
    expect(toSummary(enrollment({ sourceData: { discountType: "CARTEJEUNE", discountCode: "CJ-42" } }))).toMatchObject({ discountType: "Carte Jeune", discountCode: "CJ-42" });
  });

  it("n’affiche jamais le type de réduction à la place du code adhérent", () => {
    const summary = toSummary(enrollment({
      sourceData: { discountType: "PASSPORT", passSportCode: "25-DPVJ-ZBUN" },
      mappings: [
        { id: "type-as-code", sourceKey: "discountType", label: "Type", kind: "REDUCTION_CODE", required: false, position: 1, reductionDevice: "Pass’Sport" },
        { id: "actual-code", sourceKey: "passSportCode", label: "Code Pass’Sport", kind: "REDUCTION_CODE", required: false, position: 2, reductionDevice: "Pass’Sport" },
      ],
    }));
    expect(summary.reductions).toEqual([{ device: "Pass’Sport", code: "25-DPVJ-ZBUN" }]);
  });
});
