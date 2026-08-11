"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EnrollmentSummary } from "@la-sportive/contracts";
import { Clipboard, Search, TicketPercent } from "lucide-react";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

type ReductionRow = { enrollment: EnrollmentSummary; device: string; code: string };

export default function ReductionsPage() {
  const [items, setItems] = useState<EnrollmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("TOUS");
  const [copied, setCopied] = useState<string>();
  const load = useCallback(() => api<{ data: EnrollmentSummary[] }>("/discounts").then((result) => setItems(result.data)).finally(() => setLoading(false)), []);
  useEffect(() => { void load(); const listener = () => void load(); window.addEventListener("lasportive:refresh", listener); return () => window.removeEventListener("lasportive:refresh", listener); }, [load]);
  const rows = useMemo<ReductionRow[]>(() => items.flatMap((enrollment) => enrollment.reductions.map((reduction) => ({ enrollment, ...reduction }))), [items]);
  const devices = Array.from(new Set(rows.map((row) => row.device)));
  const filtered = rows.filter((row) => `${row.enrollment.firstName} ${row.enrollment.lastName} ${row.device} ${row.code}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")) && (device === "TOUS" || row.device === device));
  async function copy(row: ReductionRow) { await navigator.clipboard.writeText(row.code); setCopied(`${row.enrollment.id}-${row.device}-${row.code}`); setTimeout(() => setCopied(undefined), 1800); }

  return <><div className="pageHeader"><div><h1>Réductions et dispositifs</h1><p>Chaque code est rattaché au dispositif configuré dans la campagne.</p></div><div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou code…" /></div><select className="select" value={device} onChange={(event) => setDevice(event.target.value)}><option value="TOUS">Tous les dispositifs</option>{devices.map((item) => <option key={item}>{item}</option>)}</select></div></div><div className="stats"><div className="card stat"><strong>{rows.length}</strong><span>Aides déclarées</span></div>{devices.map((item) => <div className="card stat" key={item}><strong>{rows.filter((row) => row.device === item).length}</strong><span>{item}</span></div>)}</div><section className="card tableWrap">{loading ? <div style={{ minHeight: 320, display: "grid", placeItems: "center" }}><Spinner /></div> : filtered.length === 0 ? <EmptyState icon={<TicketPercent size={36} />} title="Aucune réduction trouvée" text="Les aides apparaîtront une fois leurs champs de code configurés et renseignés." /> : <table className="dataTable"><thead><tr><th>Adhérent</th><th>Dispositif</th><th>Code</th><th>Contact</th><th /></tr></thead><tbody>{filtered.map((row, index) => { const rowId = `${row.enrollment.id}-${row.device}-${row.code}`; return <tr key={`${rowId}-${index}`}><td><div className="person"><span className="avatar">{row.enrollment.firstName[0]}{row.enrollment.lastName[0]}</span><strong>{row.enrollment.firstName} {row.enrollment.lastName}</strong></div></td><td><strong>{row.device}</strong></td><td><code style={{ fontWeight: 800, letterSpacing: ".04em" }}>{row.code}</code></td><td className="muted">{row.enrollment.contactEmail}</td><td><Button variant="secondary" onClick={() => copy(row)}><Clipboard size={15} />{copied === rowId ? "Copié !" : "Copier le code"}</Button></td></tr>; })}</tbody></table>}</section></>;
}
