export type ContactPart = { kind: "text" | "phone"; value: string };

function contactName(value: string) {
  return value.trim().replace(/^[\s,/:;–—-]+|[\s,/:;–—-]+$/g, "")
    .replace(/\s+(?:tél(?:éphone)?\.?|tel(?:ephone)?\.?)\s*$/iu, "")
    .replace(/\s+/g, " ").trim();
}

function contactLines(parts: ContactPart[]): ContactPart[][] {
  if (!parts.some((part) => part.kind === "phone")) return [parts];
  const contacts: ContactPart[][] = [];
  let pending = "";
  for (const part of parts) {
    if (part.kind === "text") {
      pending += part.value;
      continue;
    }
    // Alternatives belong to the same person; a new name starts a new line.
    if (contacts.length && /^[\s,/:;–—-]*(?:ou|et|or|\/)\s*$/iu.test(pending)) {
      contacts.at(-1)!.push({ kind: "text", value: ` ${pending.trim()} ` }, part);
    } else {
      const name = contactName(pending);
      contacts.push([{ kind: "text", value: `${name || "Contact"}: ` }, part]);
    }
    pending = "";
  }
  if (pending.trim()) {
    // Handle phone-first entries without confusing trailing notes with names.
    const firstPart = contacts[0]?.[0];
    if (contacts.length === 1 && firstPart?.value === "Contact: " && !/^\s*[(,]/u.test(pending)) {
      firstPart.value = `${contactName(pending)}: `;
    } else {
      contacts.at(-1)!.push({ kind: "text", value: ` ${pending.trim()}` });
    }
  }
  return contacts;
}

// Only reformat unambiguous French numbers. All other text stays visible.
export function formatEmergencyContacts(value: string): ContactPart[][] {
  const entries = value.split(/\r?\n|;|\s*\/\s*/).map((line) => {
    const parts: ContactPart[] = [];
    const phones = /(?<![\p{L}\d+])(?:0[1-9](?:[ .\u00a0-]?\d{2}){4}|(?:\+33|0033)[ .\u00a0-]?(?:\(0\)[ .\u00a0-]?)?[1-9](?:[ .\u00a0-]?\d{2}){4})(?![\p{L}\d]|[ .\u00a0-]\d)/gu;
    let offset = 0;
    for (const match of line.matchAll(phones)) {
      if (match.index > offset) parts.push({ kind: "text", value: line.slice(offset, match.index) });
      const digits = match[0].replace(/\D/g, "");
      const international = digits.startsWith("33") || digits.startsWith("0033");
      const national = international ? digits.replace(/^(?:0033|33)0?/, "") : digits.slice(1);
      const groups = national.slice(1).match(/\d{2}/g)!.join(" ");
      parts.push({ kind: "phone", value: international ? `+33 ${national[0]} ${groups}` : `0${national[0]} ${groups}` });
      offset = match.index + match[0].length;
    }
    if (offset < line.length) parts.push({ kind: "text", value: line.slice(offset) });
    return parts;
  }).filter((parts) => parts.some((part) => part.value.trim()));

  const grouped: ContactPart[][] = [];
  for (const parts of entries) {
    const previous = grouped.at(-1);
    const phoneIndex = parts.findIndex((part) => part.kind === "phone");
    const prefix = parts.slice(0, phoneIndex).map((part) => part.value).join("");
    const phoneOnlyPrefix = /^[\s:–—-]*(?:(?:tél(?:éphone)?\.?|tel(?:ephone)?\.?)\s*[:–—-]?\s*)?$/iu.test(prefix);
    if (previous && !previous.some((part) => part.kind === "phone") && phoneIndex >= 0 && phoneOnlyPrefix) {
      previous.push({ kind: "text", value: " " }, ...parts.slice(phoneIndex));
    } else {
      grouped.push(parts);
    }
  }
  return grouped.flatMap(contactLines);
}
