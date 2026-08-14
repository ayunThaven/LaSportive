"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldMappingDto, HelloAssoCampaignDto, HelloAssoFieldDto, MappingKind, SettingsDto } from "@la-sportive/contracts";
import { Check, CheckCircle2, CircleAlert, Cloud, DatabaseZap, GripVertical, Mail, RefreshCw, Settings2 } from "lucide-react";
import { Button, Modal, Spinner } from "@/components/ui";
import { API_URL, api } from "@/lib/api";
import styles from "./settings.module.css";

const modules = { CONFORMITE: "Conformité", LICENCES: "Licences", REDUCTIONS: "Réductions" } as const;
const reductionDevices = ["Pass’Sport", "Carte Jeune", "Pass’Région"] as const;
type Module = keyof typeof modules;
type SettingsTab = "CONNECTIONS" | "CAMPAIGN";
type DropPosition = "before" | "after";
type ResettingConnection = "helloAsso" | "googleDrive" | "gmail";
type DriveFolder = { id: string; name: string };

const moduleFor = (kind: MappingKind): Module => kind === "LICENCE" ? "LICENCES" : kind.startsWith("REDUCTION") ? "REDUCTIONS" : "CONFORMITE";
const mappingKindFor = (module: Module): MappingKind => module === "LICENCES" ? "LICENCE" : module === "REDUCTIONS" ? "REDUCTION_CODE" : "DOCUMENT";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsDto>();
  const [mappings, setMappings] = useState<FieldMappingDto[]>([]);
  const [campaigns, setCampaigns] = useState<HelloAssoCampaignDto[]>([]);
  const [fields, setFields] = useState<HelloAssoFieldDto[]>([]);
  const [tab, setTab] = useState<SettingsTab>("CONNECTIONS");
  const [module, setModule] = useState<Module>("CONFORMITE");
  const [reductionDevice, setReductionDevice] = useState<(typeof reductionDevices)[number]>(reductionDevices[0]);
  const [message, setMessage] = useState<string>();
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resettingConnection, setResettingConnection] = useState<ResettingConnection>();
  const [configuringDrive, setConfiguringDrive] = useState(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [loadingDriveFolders, setLoadingDriveFolders] = useState(false);
  const [savingDriveFolder, setSavingDriveFolder] = useState(false);
  const [selectedDriveFolderId, setSelectedDriveFolderId] = useState("");
  const [draggedMappingId, setDraggedMappingId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition }>();
  const mappingsRef = useRef<FieldMappingDto[]>([]);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => { void loadSettings(); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("googleDrive") !== "connected") return;
    window.history.replaceState({}, "", window.location.pathname);
    setConfiguringDrive(true);
    void loadSettings();
  }, []);
  useEffect(() => { const campaign = settings?.campaigns.find((item) => item.id === settings.activeCampaignId); if (campaign) { void loadCampaigns(); void loadFields(campaign.formSlug); } }, [settings?.activeCampaignId]);
  useEffect(() => { if (configuringDrive && settings?.googleDrive?.connected) void loadDriveFolders(); }, [configuringDrive, settings?.googleDrive?.connected]);

  async function loadSettings() { try { const data = await api<SettingsDto>("/settings"); const current = data.campaigns.find((item) => item.id === data.activeCampaignId)?.mappings ?? []; mappingsRef.current = current; setSettings(data); setMappings(current); } catch (error) { setMessage(error instanceof Error ? error.message : "Chargement impossible."); } }
  async function loadCampaigns() { setLoadingCampaigns(true); try { setCampaigns((await api<{ data: HelloAssoCampaignDto[] }>("/helloasso/campaigns")).data); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les campagnes HelloAsso."); } finally { setLoadingCampaigns(false); } }
  async function loadFields(formSlug: string) { setLoadingFields(true); try { setFields((await api<{ data: HelloAssoFieldDto[] }>(`/helloasso/campaigns/${encodeURIComponent(formSlug)}/fields`)).data); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les champs de la campagne."); } finally { setLoadingFields(false); } }
  async function persist(next = mappingsRef.current) { if (!settings) throw new Error("Réglages indisponibles."); return api<SettingsDto>("/settings", { method: "PUT", body: JSON.stringify({ activeCampaignId: settings.activeCampaignId, emailSubject: settings.emailSubject, emailTemplate: settings.emailTemplate, mappings: next.map((item, position) => ({ ...item, position })) }) }); }
  function changeMappings(next: FieldMappingDto[]) { mappingsRef.current = next; setMappings(next); saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => { try { setSettings(await persist(next)); setMessage("Configuration enregistrée automatiquement."); } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement automatique impossible."); } }); }
  async function selectCampaign(formSlug: string) { const selected = campaigns.find((item) => item.formSlug === formSlug); if (!selected) return; try { await saveQueue.current; await persist(); const data = await api<SettingsDto>("/helloasso/campaigns/select", { method: "POST", body: JSON.stringify(selected) }); const next = data.campaigns.find((item) => item.id === data.activeCampaignId)?.mappings ?? []; mappingsRef.current = next; setSettings(data); setMappings(next); setFields([]); setTab("CAMPAIGN"); window.dispatchEvent(new Event("lasportive:refresh")); } catch (error) { setMessage(error instanceof Error ? error.message : "Sélection de campagne impossible."); } }
  async function testConnection() { setTesting(true); try { const result = await api<{ campaignCount: number }>("/integrations/helloasso/test", { method: "POST" }); setMessage(`Connexion HelloAsso opérationnelle · ${result.campaignCount} campagne(s) trouvée(s).`); } catch (error) { setMessage(error instanceof Error ? error.message : "Connexion HelloAsso impossible."); } finally { setTesting(false); } }
  async function loadDriveFolders() { setLoadingDriveFolders(true); try { const data = await api<{ data: DriveFolder[] }>("/integrations/google-drive/folders"); setDriveFolders(data.data); setSelectedDriveFolderId((current) => current || settings?.googleDrive?.folderId || ""); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les dossiers Google Drive."); } finally { setLoadingDriveFolders(false); } }
  function configureDrive() { if (settings?.googleDrive?.connected) { setConfiguringDrive(true); return; } window.location.assign(`${API_URL}/integrations/google-drive/authorize`); }
  async function saveDriveFolder() { const folder = driveFolders.find((item) => item.id === selectedDriveFolderId); if (!folder) return; setSavingDriveFolder(true); try { setSettings(await api<SettingsDto>("/integrations/google-drive/folder", { method: "PUT", body: JSON.stringify(folder) })); setConfiguringDrive(false); setMessage("Dossier Google Drive configuré."); } catch (error) { setMessage(error instanceof Error ? error.message : "Configuration Google Drive impossible."); } finally { setSavingDriveFolder(false); } }
  async function resetConnection(connection: ResettingConnection) {
    const endpoints = { helloAsso: "/integrations/helloasso/session", googleDrive: "/integrations/google-drive", gmail: "/integrations/gmail/session" } as const;
    const labels = { helloAsso: "HelloAsso", googleDrive: "Google Drive", gmail: "Gmail" } as const;
    setResettingConnection(connection);
    try {
      const data = await api<SettingsDto | { ok: true }>(endpoints[connection], { method: "DELETE" });
      if ("integrations" in data) setSettings(data);
      else await loadSettings();
      setMessage(`Connexion ${labels[connection]} réinitialisée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Réinitialisation de ${labels[connection]} impossible.`);
    } finally {
      setResettingConnection(undefined);
    }
  }
  function isInCurrentModule(mapping: FieldMappingDto) { return moduleFor(mapping.kind) === module && (module !== "REDUCTIONS" || mapping.reductionDevice === reductionDevice); }
  function toggleField(field: HelloAssoFieldDto) {
    const existing = mappingsRef.current.filter((item) => item.sourceKey === field.key && isInCurrentModule(item));
    const currentReductionMappings = mappingsRef.current.filter((item) => moduleFor(item.kind) === "REDUCTIONS" && item.reductionDevice === reductionDevice);
    if (existing.length) {
      if (module === "REDUCTIONS" && currentReductionMappings.length > 1) { changeMappings(mappingsRef.current.filter((item) => !currentReductionMappings.includes(item) || existing.includes(item))); return; }
      changeMappings(mappingsRef.current.filter((item) => !existing.includes(item)));
      return;
    }
    const withoutCurrentReduction = module === "REDUCTIONS" ? mappingsRef.current.filter((item) => !(moduleFor(item.kind) === "REDUCTIONS" && item.reductionDevice === reductionDevice)) : mappingsRef.current;
    changeMappings([...withoutCurrentReduction, { id: `new-${Date.now()}`, sourceKey: field.key, label: field.label, kind: mappingKindFor(module), required: false, position: withoutCurrentReduction.length, ...(module === "REDUCTIONS" ? { reductionDevice } : {}) }]);
  }
  function reorderMappings(sourceId: string, targetId: string, position: DropPosition) {
    if (sourceId === targetId) return;
    const slots = mappingsRef.current.flatMap((item, index) => isInCurrentModule(item) ? [index] : []);
    const ordered = slots.map((slot) => mappingsRef.current[slot]).filter((item): item is FieldMappingDto => Boolean(item));
    const sourceIndex = ordered.findIndex((item) => item.id === sourceId); const targetIndex = ordered.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [source] = ordered.splice(sourceIndex, 1); if (!source) return;
    let insertionIndex = targetIndex - (sourceIndex < targetIndex ? 1 : 0);
    if (position === "after") insertionIndex += 1;
    ordered.splice(insertionIndex, 0, source);
    const next = [...mappingsRef.current]; slots.forEach((slot, index) => { const item = ordered[index]; if (item) next[slot] = item; });
    changeMappings(next);
  }

  if (!settings) return <div className={styles.loading}><Spinner /></div>;
  const active = settings.campaigns.find((item) => item.id === settings.activeCampaignId);
  const selectedMappings = mappings.filter(isInCurrentModule);
  const success = Boolean(message && /enregistrée|opérationnelle|réinitialisée/.test(message));
  return <>
    <div className="pageHeader"><div><h1>Réglages</h1><p>Configurez les connexions et les données de votre campagne.</p></div></div>
    {message && <div className={success ? styles.success : "errorBanner"}>{message}</div>}
    <nav className={styles.tabs} aria-label="Sections des réglages"><button className={tab === "CONNECTIONS" ? styles.activeTab : ""} onClick={() => setTab("CONNECTIONS")}><Cloud size={16} />Connexions</button><button className={tab === "CAMPAIGN" ? styles.activeTab : ""} onClick={() => setTab("CAMPAIGN")}><Settings2 size={16} />Campagne</button></nav>
    {tab === "CONNECTIONS" ? <section className={styles.connectionGrid}>
      <ConnectionCard icon={<Cloud />} title="HelloAsso" detail="Campagnes et adhésions" connected={settings.integrations.helloAsso}><Button variant="secondary" onClick={testConnection} disabled={testing || Boolean(resettingConnection)}>{testing ? "Test en cours…" : "Tester la connexion"}</Button><Button variant="ghost" onClick={() => resetConnection("helloAsso")} disabled={testing || Boolean(resettingConnection)}>{resettingConnection === "helloAsso" ? "Réinitialisation…" : "Réinitialiser"}</Button></ConnectionCard>
      <ConnectionCard icon={<DatabaseZap />} title="Google Drive" detail="Dépôt des documents corrigés" connected={settings.integrations.googleDrive}><Button variant="secondary" onClick={configureDrive} disabled={Boolean(resettingConnection)}>{settings.googleDrive?.connected ? "Choisir le dossier" : "Configuration Drive"}</Button><Button variant="ghost" onClick={() => resetConnection("googleDrive")} disabled={Boolean(resettingConnection)}>{resettingConnection === "googleDrive" ? "Réinitialisation…" : "Réinitialiser"}</Button></ConnectionCard>
      <ConnectionCard icon={<Mail />} title="Gmail" detail="Envoi des relances adhérents" connected={settings.integrations.smtp}><Button variant="secondary" disabled>Configuration e-mail</Button><Button variant="ghost" onClick={() => resetConnection("gmail")} disabled={Boolean(resettingConnection)}>{resettingConnection === "gmail" ? "Réinitialisation…" : "Réinitialiser"}</Button></ConnectionCard>
    </section> : <section className={`card ${styles.campaignSection}`}>
      <div className={styles.campaignHeader}><div><small>CAMPAGNE ACTIVE</small><h2>{active?.title ?? "Aucune campagne"}</h2><p>Les modifications de sélection sont sauvegardées automatiquement.</p></div><Button variant="secondary" onClick={loadCampaigns} disabled={loadingCampaigns}><RefreshCw size={15} />{loadingCampaigns ? "Chargement…" : "Actualiser HelloAsso"}</Button></div>
      <div className="field"><label>Campagne d’adhésion</label><select value="" onChange={(event) => selectCampaign(event.target.value)} disabled={loadingCampaigns}><option value="">Sélectionnez une campagne…</option>{campaigns.map((campaign) => <option key={campaign.formSlug} value={campaign.formSlug}>{campaign.title}</option>)}</select></div>
      <div className={styles.moduleTabs} role="tablist" aria-label="Modules">{Object.entries(modules).map(([key, label]) => <button key={key} role="tab" aria-selected={module === key} className={module === key ? styles.activeModule : ""} onClick={() => setModule(key as Module)}>{label}</button>)}</div>
      {module === "REDUCTIONS" && <div className={styles.deviceTabs} role="tablist" aria-label="Dispositifs d’aide">{reductionDevices.map((device) => <button key={device} className={reductionDevice === device ? styles.activeDevice : ""} onClick={() => setReductionDevice(device)}>{device}</button>)}</div>}
      <div className={styles.fieldList}>{loadingFields ? <Spinner /> : fields.length === 0 ? <p className={styles.empty}>Sélectionnez une campagne pour afficher ses champs.</p> : fields.map((field) => { const checked = mappings.some((mapping) => mapping.sourceKey === field.key && isInCurrentModule(mapping)); return <label className={styles.fieldChoice} key={field.key}><input type="checkbox" checked={checked} onChange={() => toggleField(field)} /><span className={styles.checkbox}>{checked && <Check size={14} />}</span><span>{field.label}</span></label>; })}</div>
      {selectedMappings.length > 0 && <section className={styles.orderSection}><div><h3>Ordre d’affichage</h3><p>Glissez-déposez les champs pour organiser la fiche.</p></div><div className={styles.orderList}>{selectedMappings.map((mapping, index) => { const position = dropTarget?.id === mapping.id ? dropTarget.position : undefined; return <div className={`${styles.orderItem} ${draggedMappingId === mapping.id ? styles.dragging : ""} ${position === "before" ? styles.dropBefore : ""} ${position === "after" ? styles.dropAfter : ""}`} key={mapping.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedMappingId(mapping.id); setDropTarget(undefined); }} onDragOver={(event) => { event.preventDefault(); if (draggedMappingId !== mapping.id) { const bounds = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: mapping.id, position: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" }); } }} onDrop={(event) => { event.preventDefault(); if (draggedMappingId && dropTarget?.id === mapping.id) reorderMappings(draggedMappingId, mapping.id, dropTarget.position); setDraggedMappingId(undefined); setDropTarget(undefined); }} onDragEnd={() => { setDraggedMappingId(undefined); setDropTarget(undefined); }}><span>{index + 1}</span><GripVertical className={styles.dragHandle} size={17} aria-hidden="true" /><strong>{mapping.label}</strong></div>; })}</div></section>}
    </section>}
    {configuringDrive && <Modal title="Configurer Google Drive" onClose={() => setConfiguringDrive(false)} footer={<><Button variant="secondary" onClick={() => setConfiguringDrive(false)} disabled={savingDriveFolder}>Annuler</Button><Button onClick={saveDriveFolder} disabled={!selectedDriveFolderId || loadingDriveFolders || savingDriveFolder}>{savingDriveFolder ? "Enregistrement…" : "Utiliser ce dossier"}</Button></>}>
      {loadingDriveFolders ? <Spinner /> : <div className="field"><label>Dossier racine La Sportive</label><select value={selectedDriveFolderId} onChange={(event) => setSelectedDriveFolderId(event.target.value)}><option value="">Sélectionnez un dossier…</option>{driveFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><small>Les documents seront classés par campagne, puis par adhérent.</small></div>}
    </Modal>}
  </>;
}

function ConnectionCard({ icon, title, detail, connected, children }: { icon: React.ReactNode; title: string; detail: string; connected: boolean; children: React.ReactNode }) { return <article className={`card ${styles.connectionCard}`}><div className={styles.connectionIcon}>{icon}</div><div><h2>{title}</h2><p>{detail}</p><span className={connected ? styles.connectedText : styles.disconnectedText}>{connected ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{connected ? "Connecté" : "À configurer"}</span></div><div className={styles.connectionActions}>{children}</div></article>; }
