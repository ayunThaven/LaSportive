import { describe, expect, it } from "vitest";
import { DemoRepository } from "./demo.js";

describe("DemoRepository", () => {
  it("préserve la validation manuelle après une actualisation HelloAsso", async () => {
    const repository = new DemoRepository();
    const existing = await repository.getEnrollment("emma");
    if (!existing) throw new Error("Adhérente de démonstration introuvable");
    await repository.setComplianceValidated(existing.id);

    await repository.upsertSourceEnrollment({
      externalItemId: existing.externalItemId,
      externalOrderId: existing.externalOrderId,
      campaignId: existing.campaignId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      contactEmail: existing.contactEmail,
      sourceData: { ...existing.sourceData, address: "15 rue des Tilleuls, 69003 Lyon" },
      helloAssoUrl: existing.helloAssoUrl,
      active: true,
    });

    expect((await repository.getEnrollment(existing.id))?.complianceValidatedAt).toBeInstanceOf(Date);
  });

  it("refuse un dépôt de correction pour une anomalie de champ", async () => {
    const repository = new DemoRepository();
    const issue = await repository.createIssue("emma", {
      fieldKey: "address",
      fieldLabel: "Adresse",
      // Simule une ancienne anomalie où le type était enregistré à tort.
      kind: "DOCUMENT",
      reason: "Le code postal est incomplet.",
    });

    await expect(repository.addDocument(issue.id, {
      driveFileId: "file-1",
      driveUrl: "https://drive.example/file-1",
      name: "correction.pdf",
      mimeType: "application/pdf",
    })).rejects.toThrow("réservé aux anomalies de document");
  });
});
