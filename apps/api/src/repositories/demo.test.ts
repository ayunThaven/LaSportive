import { describe, expect, it } from "vitest";
import { DemoRepository } from "./demo.js";

describe("DemoRepository", () => {
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
