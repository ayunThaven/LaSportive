"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EnrollmentSummary } from "@la-sportive/contracts";
import { Search, Undo2 } from "lucide-react";
import { EnrollmentDrawer } from "@/components/EnrollmentDrawer";
import { Button, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, formatDate } from "@/lib/api";

export default function LicencesPage() {
  const [items, setItems] = useState<EnrollmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("A_TRAITER");
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState<string>();

  const load = useCallback(async () => {
    try { setItems((await api<{ data: EnrollmentSummary[] }>("/enrollments")).data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const listener = () => void load();
    window.addEventListener("lasportive:refresh", listener);
    return () => window.removeEventListener("lasportive:refresh", listener);
  }, [load]);

  const validated = useMemo(() => items.filter((item) => item.complianceStatus === "VALIDE"), [items]);
  const filtered = useMemo(() => validated.filter((item) => `${item.firstName} ${item.lastName}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")) && (filter === "TOUS" || item.licenseStatus === filter)), [validated, search, filter]);

  async function toggle(item: EnrollmentSummary) {
    try {
      await api(`/enrollments/${item.id}/license`, { method: "PUT", body: JSON.stringify({ status: item.licenseStatus === "TRAITE" ? "A_TRAITER" : "TRAITE" }) });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setTimeout(() => setMessage(undefined), 4000);
    }
  }

  return <>
    <div className="pageHeader"><div><h1>Préparation des licences</h1><p>Seuls les dossiers validés en conformité sont affichés ici.</p></div><div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un adhérent…" /></div><select className="select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="TOUS">Tous les dossiers</option><option value="A_TRAITER">À traiter</option><option value="TRAITE">Traités</option></select></div></div>
    <div className="stats"><div className="card stat"><strong>{validated.filter((item) => item.licenseStatus === "A_TRAITER").length}</strong><span>Licences à traiter</span></div><div className="card stat"><strong>{validated.filter((item) => item.licenseStatus === "TRAITE").length}</strong><span>Licences traitées</span></div><div className="card stat"><strong>{validated.length}</strong><span>Dossiers validés</span></div></div>
    {message && <div className="errorBanner" style={{ background: "#e5f5ed", color: "#236c4e", borderColor: "#c8e6d7" }}>{message}</div>}
    <section className="card tableWrap">{loading ? <div style={{ minHeight: 320, display: "grid", placeItems: "center" }}><Spinner /></div> : filtered.length === 0 ? <EmptyState icon={<Search size={34} />} title="Aucune licence" text="Aucun dossier validé ne correspond aux filtres actuels." /> : <table className="dataTable"><thead><tr><th>Adhérent</th><th>Conformité</th><th>Avancement</th><th>Traité le</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} onClick={() => setSelected(item.id)}><td><div className="person"><span className="avatar">{item.firstName[0]}{item.lastName[0]}</span><div><strong>{item.firstName} {item.lastName}</strong><small>{item.contactEmail}</small></div></div></td><td><StatusPill status={item.complianceStatus} /></td><td><StatusPill status={item.licenseStatus} /></td><td className="muted">{formatDate(item.licenseProcessedAt)}</td><td><div className="toolbar" onClick={(event) => event.stopPropagation()}><Button variant={item.licenseStatus === "TRAITE" ? "ghost" : "primary"} onClick={() => void toggle(item)}>{item.licenseStatus === "TRAITE" ? <><Undo2 size={15} />Rouvrir</> : "Marquer traité"}</Button></div></td></tr>)}</tbody></table>}</section>
    {selected && <EnrollmentDrawer enrollmentId={selected} module="LICENCES" onClose={() => setSelected(undefined)} onChanged={load} />}
  </>;
}
