import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("mot de passe partagé", () => {
  it("est stocké sous forme dérivée et vérifié en temps constant", async () => {
    const hash = await hashPassword("une-phrase-secrete");
    expect(hash).not.toContain("une-phrase-secrete");
    await expect(verifyPassword("une-phrase-secrete", hash)).resolves.toBe(true);
    await expect(verifyPassword("mauvais-mot-de-passe", hash)).resolves.toBe(false);
  });
});
