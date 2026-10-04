import { describe, expect, it } from "vitest";
import { formatEmergencyContacts } from "./emergency-contacts";

const text = (value: string) => formatEmergencyContacts(value).map((parts) => parts.map((part) => part.value).join(""));

describe("emergency contact printing", () => {
  it("keeps full names and relationships while formatting French numbers", () => {
    expect(text("DUPONT Marie (mère) : 0612345678 / Martin Paul : 07.98.76.54.32"))
      .toEqual(["DUPONT Marie (mère): 06 12 34 56 78", "Martin Paul: 07 98 76 54 32"]);
  });

  it("keeps multiple numbers and notes in their original order", () => {
    expect(text("Marie +33 (0)6 12 34 56 78 ou 0033 7 98 76 54 32 (après 18h)"))
      .toEqual(["Marie: +33 6 12 34 56 78 ou +33 7 98 76 54 32 (après 18h)"]);
  });

  it("preserves ambiguous numbers, foreign numbers and contacts without numbers", () => {
    const value = "Paul +44 20 7946 0958, poste 123;Marie\nNuméro incomplet 061234, référence 061234567890";
    expect(text(value)).toEqual(["Paul +44 20 7946 0958, poste 123", "Marie", "Numéro incomplet 061234, référence 061234567890"]);
  });

  it("keeps both contacts when there is no explicit separator", () => {
    expect(text("Marie 0612345678 Paul 0798765432"))
      .toEqual(["Marie: 06 12 34 56 78", "Paul: 07 98 76 54 32"]);
    expect(formatEmergencyContacts(" \n ; ")).toEqual([]);
  });

  it("uses the same separator for differently entered contacts", () => {
    expect(text("Dupont Marie - 0612345678/Martin Paul tél. : 0798765432"))
      .toEqual(["Dupont Marie: 06 12 34 56 78", "Martin Paul: 07 98 76 54 32"]);
    expect(text("0612345678 Dupont Marie")).toEqual(["Dupont Marie: 06 12 34 56 78"]);
  });

  it("joins a name and its phone entered on separate lines", () => {
    expect(text("Dupont Marie\n0612345678\nMartin Paul\nTéléphone: 0798765432"))
      .toEqual(["Dupont Marie: 06 12 34 56 78", "Martin Paul: 07 98 76 54 32"]);
    expect(text("Dupont Marie\n06 12 34 56 78 (mère)"))
      .toEqual(["Dupont Marie: 06 12 34 56 78 (mère)"]);
  });

  it("does not attach an already named contact to a previous name", () => {
    expect(text("Dupont Marie\nMartin Paul 0798765432"))
      .toEqual(["Dupont Marie", "Martin Paul: 07 98 76 54 32"]);
  });

  it("separates named alternatives with slash-separated phones", () => {
    expect(text("Marie Dupont / 0612345678 OU Paul Martin / 0798765432"))
      .toEqual(["Marie Dupont: 06 12 34 56 78", "Paul Martin: 07 98 76 54 32"]);
    expect(text("Marie Dupont / 06 12 34 56 78 ou Paul Martin / 07 98 76 54 32"))
      .toEqual(["Marie Dupont: 06 12 34 56 78", "Paul Martin: 07 98 76 54 32"]);
  });

  it("keeps consecutive phones with the same person", () => {
    for (const numbers of ["0612345678 0798765432", "06 12 34 56 78 07 98 76 54 32", "0612345678 / 0798765432", "0612345678\n0798765432"]) {
      expect(text(`Marie Dupont ${numbers}`))
        .toEqual(["Marie Dupont: 06 12 34 56 78 / 07 98 76 54 32"]);
    }
  });
});
