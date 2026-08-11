"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComplianceStatus, EnrollmentSummary } from "@la-sportive/contracts";
import { ChevronRight, Search } from "lucide-react";
import { EnrollmentDrawer } from "@/components/EnrollmentDrawer";
import { EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, formatDate } from "@/lib/api";

export default function ConformitePage() {
  const [items, setItems] = useState<EnrollmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("A_TRAITER");
  const [selected, setSelected] = useState<string>();

  const load = useCallback(async () => {
    try { setItems((await api<{ data: EnrollmentSummary[] }>("/enrollments")).data); setError(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const listener = () => void load();
    window.addEventListener("lasportive:refresh", listener);
    return () => window.removeEventListener("lasportive:refresh", listener);
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.firstName} ${item.lastName} ${item.contactEmail}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"));
    const matchesStatus = status === "TOUS" || (status === "A_TRAITER" ? item.complianceStatus !== "VALIDE" : item.complianceStatus === status);
    return matchesSearch && matchesStatus;
  }), [items, search, status]);
  const count = (target: ComplianceStatus) => items.filter((item) => item.complianceStatus === target).length;

  return <>
    <div className="pageHeader"><div><h1>Conformité des dossiers</h1><p>Contrôlez les inscriptions avant leur préparation en licence.</p></div><div className="toolbar"><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un adhérent…" /></div><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="A_TRAITER">Nécessitent une action</option><option value="TOUS">Tous les statuts</option><option value="INCOMPLET">Incomplets</option><option value="ANOMALIE">Anomalies</option><option value="VERIF_CERTIFICAT">Certificats à vérifier</option><option value="A_VALIDER">À valider</option><option value="VALIDE">Validés</option></select></div></div>
    {error && <div className="errorBanner">{error}</div>}
    <div className="stats"><div className="card stat"><strong>{items.length}</strong><span>Dossiers actifs</span></div><div className="card stat accent"><strong>{count("INCOMPLET")}</strong><span>Incomplets</span></div><div className="card stat"><strong>{count("A_VALIDER")}</strong><span>À valider</span></div><div className="card stat"><strong>{count("VALIDE")}</strong><span>Validés</span></div></div>
    <section className="card tableWrap">{loading ? <div style={{ minHeight: 320, display: "grid", placeItems: "center" }}><Spinner /></div> : filtered.length === 0 ? <EmptyState icon={<Search size={34} />} title="Aucun dossier trouvé" text="Modifiez la recherche ou le filtre pour retrouver un adhérent." /> : <table className="dataTable"><thead><tr><th>Adhérent</th><th>Statut</th><th>Accès licences</th><th>Dernière modification</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} onClick={() => setSelected(item.id)}><td><div className="person"><span className="avatar">{item.firstName[0]}{item.lastName[0]}</span><div><strong>{item.firstName} {item.lastName}</strong><small>{item.contactEmail || "E-mail manquant"}</small></div></div></td><td><StatusPill status={item.complianceStatus} /></td><td><span className="muted">{item.complianceStatus === "VALIDE" ? "Disponible" : "En attente"}</span></td><td className="muted">{formatDate(item.updatedAt, true)}</td><td><ChevronRight size={17} /></td></tr>)}</tbody></table>}</section>
    {selected && <EnrollmentDrawer enrollmentId={selected} module="CONFORMITE" onClose={() => setSelected(undefined)} onChanged={load} />}
  </>;
}
