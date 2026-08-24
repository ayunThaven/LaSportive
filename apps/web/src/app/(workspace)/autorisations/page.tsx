"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthorizationRowDto } from "@la-sportive/contracts";
import { Printer, Search, ShieldCheck } from "lucide-react";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import styles from "./page.module.css";

type AuthorizationField = AuthorizationRowDto["fields"][number];
type PrintRow = { item: AuthorizationRowDto; emergency: string; outing: string; image: string; care: string; transport: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").toLocaleLowerCase("fr").trim();
}

function displayValue(value: string) {
  const normalized = normalize(value);
  const pill = (label: string, color: string, background: string) => <span style={{ display: "inline-flex", padding: ".22rem .55rem", borderRadius: 999, color, background, fontSize: ".78rem", fontWeight: 800 }}>{label}</span>;
  if (["oui", "yes", "true", "1", "accepte", "j accepte"].includes(normalized)) return pill("Oui", "#236c4e", "#e5f5ed");
  if (["non", "no", "false", "0", "refuse"].includes(normalized)) return pill("Non", "#a33636", "#fceaea");
  return value || <span className="muted">Non renseigné</span>;
}

function compactContact(field?: AuthorizationField) {
  if (!field?.value.trim()) return "Aucun";
  const value = field.value.trim();
  const phone = value.match(/(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){8,14}\d/)?.[0]?.replace(/\s+/g, " ");
  if (!phone) return "Aucun";
  const namePart = (value.split(/\s*\/\s*/)[0] ?? "").replace(phone ?? "", "").trim();
  const uppercaseName = namePart.match(/^([A-ZÀ-ÖØ-Þ' -]+)(?=\s|$)/)?.[1]?.trim();
  const lastName = uppercaseName || namePart.split(/\s+/)[0] || "—";
  return `${lastName} : ${phone}`;
}

function printMark(field?: AuthorizationField) {
  const value = normalize(field?.value ?? "");
  if (["oui", "yes", "true", "1", "accepte", "j accepte"].includes(value)) return "✓";
  if (["non", "no", "false", "0", "refuse"].includes(value)) return "✗";
  return "—";
}

function fieldMatching(item: AuthorizationRowDto, predicate: (label: string) => boolean) {
  return item.fields.find((field) => predicate(normalize(field.label)));
}

function PrintTable({ rows }: { rows: PrintRow[] }) {
  return <table className={styles.printTable}><thead><tr><th>Adhérent</th><th>Contact d&apos;urgence</th><th>Sortie</th><th>Droit à l&apos;image</th><th>Soins</th><th>Transport</th></tr></thead><tbody>{rows.map(({ item, emergency, outing, image, care, transport }) => <tr key={item.id}><td>{item.firstName} {item.lastName}</td><td>{emergency}</td><td className={styles.mark}>{outing}</td><td className={styles.mark}>{image}</td><td className={styles.mark}>{care}</td><td className={styles.mark}>{transport}</td></tr>)}</tbody></table>;
}

export default function AuthorizationsPage() {
  const [items, setItems] = useState<AuthorizationRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const load = useCallback(() => api<{ data: AuthorizationRowDto[] }>("/authorizations").then((result) => setItems(result.data)).finally(() => setLoading(false)), []);

  useEffect(() => {
    void load();
    const listener = () => void load();
    window.addEventListener("lasportive:refresh", listener);
    return () => window.removeEventListener("lasportive:refresh", listener);
  }, [load]);

  const fields = useMemo<AuthorizationField[]>(() => {
    const unique = new Map<string, AuthorizationField>();
    items.forEach((item) => item.fields.forEach((field) => unique.set(field.key, field)));
    return [...unique.values()];
  }, [items]);
  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase("fr");
    return items.filter((item) => `${item.firstName} ${item.lastName} ${item.contactEmail} ${item.fields.map((field) => field.value).join(" ")}`.toLocaleLowerCase("fr").includes(needle));
  }, [items, search]);
  const printRows = useMemo<PrintRow[]>(() => filtered.map((item) => {
    const contact = fieldMatching(item, (label) => label.includes("contact") && label.includes("urgence"));
    const outing = fieldMatching(item, (label) => label.includes("autorisation de sortie") || (label.includes("quitter") && label.includes("salle de gym")));
    const care = fieldMatching(item, (label) => label.includes("decision medicale") || (label.includes("accident") && label.includes("urgence")));
    const image = fieldMatching(item, (label) => label.includes("prise de photo") || label.includes("diffusion de photo") || (label.includes("prise") && label.includes("diffusion") && label.includes("photo")));
    const transport = fieldMatching(item, (label) => label.includes("transporter"));
    return { item, emergency: compactContact(contact), outing: printMark(outing), image: printMark(image), care: printMark(care), transport: printMark(transport) };
  }), [filtered]);

  return <>
    <div className="pageHeader"><div><h1>Autorisations</h1><p>Consultez rapidement les contacts d’urgence et les autorisations déclarées.</p></div><div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un adhérent…" /></div><Button variant="secondary" onClick={() => window.print()} disabled={loading || printRows.length === 0}><Printer size={16} />Imprimer</Button></div></div>
    <div className="stats"><div className="card stat"><strong>{items.length}</strong><span>Adhérents</span></div><div className="card stat"><strong>{fields.length}</strong><span>Informations configurées</span></div></div>
    <section className="card tableWrap">{loading ? <div style={{ minHeight: 320, display: "grid", placeItems: "center" }}><Spinner /></div> : fields.length === 0 ? <EmptyState icon={<ShieldCheck size={36} />} title="Aucune autorisation configurée" text="Dans Réglages > Campagne > Autorisations, sélectionnez les champs à afficher." /> : filtered.length === 0 ? <EmptyState icon={<Search size={34} />} title="Aucun adhérent trouvé" text="Aucun résultat ne correspond à votre recherche." /> : <table className="dataTable"><thead><tr><th>Adhérent</th>{fields.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><div className="person"><span className="avatar">{item.firstName[0]}{item.lastName[0]}</span><div><strong>{item.firstName} {item.lastName}</strong><small>{item.contactEmail}</small></div></div></td>{fields.map((field) => <td key={field.key}>{displayValue(item.fields.find((itemField) => itemField.key === field.key)?.value ?? "")}</td>)}</tr>)}</tbody></table>}</section>
    <section className={`${styles.printSheet} authorizationsPrint`} aria-hidden="true"><h1>Registre des autorisations</h1><p>{printRows.length} adhérent{printRows.length > 1 ? "s" : ""}{search ? ` — recherche : ${search}` : ""}</p><PrintTable rows={printRows} /></section>
  </>;
}
