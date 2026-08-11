import { describe, expect, it } from "vitest";
import { correctionFileName, maxDocumentSize, validateDocument } from "./drive.js";

describe("validation des corrections", () => {
  it("accepte PDF, JPEG et PNG sous 10 Mo", () => expect(() => validateDocument("application/pdf", 1024)).not.toThrow());
  it("refuse les formats exécutables", () => expect(() => validateDocument("application/x-msdownload", 1024)).toThrow(/PDF/));
  it("refuse les fichiers trop volumineux", () => expect(() => validateDocument("image/png", maxDocumentSize + 1)).toThrow(/10 Mo/));
  it("renomme le document avec le libellé du champ et conserve son extension", () => expect(correctionFileName("Attestation de santé / certificat médical", "scan-original.PDF")).toBe("Attestation de santé - certificat médical.PDF"));
});
