"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrollmentDetail, IssueCreateInput } from "@la-sportive/contracts";
import { Check, ExternalLink, FileText, FileUp, Mail, Pencil, Plus, Send, X } from "lucide-react";
import { api, formatDate } from "@/lib/api";
import { Button, Modal, Spinner, StatusPill } from "./ui";
import styles from "./EnrollmentDrawer.module.css";

type DrawerModule = "CONFORMITE" | "LICENCES";
type ReminderPreview = { recipient: string; subject: string; body: string };

export function EnrollmentDrawer({ enrollmentId, onClose, onChanged, module = "CONFORMITE" }: { enrollmentId: string; onClose: () => void; onChanged: () => void; module?: DrawerModule }) {
  const [detail, setDetail] = useState<EnrollmentDetail>();
  const [issueOpen, setIssueOpen] = useState(false);
  const [edited, setEdited] = useState<{ key: string; label: string; value: string }>();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderPreview, setReminderPreview] = useState<ReminderPreview>();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [uploadingIssueId, setUploadingIssueId] = useState<string>();
  const [validatingDocumentId, setValidatingDocumentId] = useState<string>();
  const [resolvingIssueId, setResolvingIssueId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [validating, setValidating] = useState(false);

  async function load() {
    try {
      setDetail(await api<EnrollmentDetail>(`/enrollments/${enrollmentId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement impossible");
    }
  }

  useEffect(() => { void load(); }, [enrollmentId]);

  const fields = useMemo(() => detail?.fields.filter((field) => module === "LICENCES" ? field.kind === "LICENCE" : field.kind === "IDENTITE" || field.kind === "DOCUMENT") ?? [], [detail, module]);
  const fieldKeys = useMemo(() => new Set(fields.map((field) => field.key)), [fields]);
  const issues = useMemo(() => detail?.issues.filter((issue) => fieldKeys.has(issue.fieldKey)) ?? [], [detail, fieldKeys]);

  async function createIssue(input: IssueCreateInput) {
    setError(undefined); setNotice(undefined);
    try {
      await api(`/enrollments/${enrollmentId}/issues`, { method: "POST", body: JSON.stringify(input) });
      setIssueOpen(false);
      await load(); onChanged();
      setNotice("Anomalie ajoutée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ajout de l’anomalie impossible");
    }
  }

  async function saveValue(value: string) {
    if (!edited) return;
    setError(undefined); setNotice(undefined);
    try {
      await api(`/enrollments/${enrollmentId}/override`, { method: "PUT", body: JSON.stringify({ fieldKey: edited.key, value }) });
      setEdited(undefined);
      await load(); onChanged();
      setNotice("Modification enregistrée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible");
    }
  }

  async function upload(issueId: string, file?: File) {
    if (!file) return;
    setError(undefined); setNotice(undefined); setUploadingIssueId(issueId);
    try {
      const body = new FormData(); body.set("file", file);
      await api(`/issues/${issueId}/documents`, { method: "POST", body });
      await load(); onChanged();
      setNotice(`« ${file.name} » a bien été déposé et rattaché à cette anomalie.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dépôt de la correction impossible");
    } finally {
      setUploadingIssueId(undefined);
    }
  }

  async function validateDocumentCorrection(issueId: string, documentId: string, documentName: string) {
    setError(undefined); setNotice(undefined); setValidatingDocumentId(documentId);
    try {
      await api(`/issues/${issueId}/documents/${documentId}/validate`, { method: "POST" });
      await load(); onChanged();
      setNotice(`La correction « ${documentName} » est validée et remplace maintenant le document d’origine.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validation de la correction impossible");
    } finally {
      setValidatingDocumentId(undefined);
    }
  }

  async function resolveFieldIssue(issueId: string, fieldLabel: string) {
    setError(undefined); setNotice(undefined); setResolvingIssueId(issueId);
    try {
      await api(`/issues/${issueId}`, { method: "PATCH", body: JSON.stringify({ status: "CONFORME" }) });
      await load(); onChanged();
      setNotice(`L’anomalie « ${fieldLabel} » est marquée comme conforme.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mise à jour de l’anomalie impossible");
    } finally {
      setResolvingIssueId(undefined);
    }
  }

  async function openReminder() {
    setError(undefined); setNotice(undefined); setReminderOpen(true); setReminderPreview(undefined); setLoadingPreview(true);
    try {
      setReminderPreview(await api<ReminderPreview>(`/enrollments/${enrollmentId}/reminder-preview`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prévisualisation de l’e-mail impossible");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function sendReminder() {
    setError(undefined); setNotice(undefined); setSendingReminder(true);
    try {
      await api(`/enrollments/${enrollmentId}/reminders`, { method: "POST" });
      setReminderOpen(false);
      await load(); onChanged();
      setNotice(`E-mail de signalement envoyé à ${reminderPreview?.recipient ?? detail?.contactEmail ?? "l’adhérent"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Envoi de l’e-mail impossible");
    } finally {
      setSendingReminder(false);
    }
  }

  async function validateCompliance() {
    setError(undefined); setNotice(undefined); setValidating(true);
    try {
      await api(`/enrollments/${enrollmentId}/compliance/validate`, { method: "PUT" });
      await load(); onChanged();
      setNotice("Dossier validé.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validation impossible");
    } finally {
      setValidating(false);
    }
  }

  return <>
    <button className={styles.backdrop} onClick={onClose} aria-label="Fermer la fiche" />
    <aside className={styles.drawer}>
      <header><div><span className={styles.avatar}>{detail ? `${detail.firstName[0]}${detail.lastName[0]}` : "…"}</span>{detail && <div><h2>{detail.firstName} {detail.lastName}</h2><p>{detail.contactEmail}</p></div>}</div><button onClick={onClose}><X /></button></header>
      {!detail ? <div className={styles.loading}><Spinner /></div> : <div className={styles.body}>
        {error && <div className="errorBanner">{error}</div>}
        {notice && <div className={styles.notice} role="status">{notice}</div>}
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <div><small>{module === "LICENCES" ? "LICENCES" : "CONFORMITÉ"}</small><h3>{module === "LICENCES" ? "Informations pour la licence" : "Données à vérifier"}</h3></div>
            {module === "CONFORMITE" && <div className="toolbar">{["A_VALIDER", "VERIF_CERTIFICAT"].includes(detail.complianceStatus) && <Button onClick={validateCompliance} disabled={validating}><Check size={15} />{validating ? "Validation…" : "Valider le dossier"}</Button>}<Button variant="ghost" onClick={() => setIssueOpen(true)}><Plus size={15} />Signaler</Button></div>}
          </div>
          {module === "CONFORMITE" && <div style={{ marginBottom: ".8rem" }}><StatusPill status={detail.complianceStatus} /></div>}
          {fields.length === 0 ? <p className={styles.noIssue}>Aucun champ configuré pour ce module.</p> : <div className={styles.fields}>{fields.map((field) => <div className={styles.fieldRow} key={`${field.kind}-${field.key}`}><div><span>{field.label}{field.required && <b>*</b>}</span>{field.kind === "DOCUMENT" && isHttpUrl(field.value) ? <a href={field.value} target="_blank" rel="noreferrer"><FileText size={15} />Ouvrir le document<ExternalLink size={13} /></a> : <strong className={!field.value ? styles.missing : ""}>{field.value || "Non renseigné"}</strong>}</div><button onClick={() => setEdited({ key: field.key, label: field.label, value: field.value })}><Pencil size={15} /></button></div>)}</div>}
        </section>
        <section className={styles.section}>
          <div className={styles.sectionTitle}><div><small>CONFORMITÉ</small><h3>Anomalies</h3></div>{module === "CONFORMITE" && issues.length > 0 && <Button variant="secondary" onClick={openReminder}><Mail size={15} />Envoyer l’e-mail</Button>}</div>
          {issues.length === 0 ? <p className={styles.noIssue}>Aucune anomalie pour ce module.</p> : issues.map((issue) => <article className={styles.issue} key={issue.id}>
            <div className={styles.issueHead}><strong>{issue.fieldLabel}</strong><StatusPill status={issue.status} /></div>
            <p>{issue.reason}</p>
            {issue.kind === "DOCUMENT" && issue.status !== "CONFORME" && <label className={styles.upload}><FileUp size={15} />{uploadingIssueId === issue.id ? "Dépôt en cours…" : "Déposer la correction"}<input type="file" disabled={Boolean(uploadingIssueId)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(issue.id, file); }} /></label>}
            {issue.kind === "FIELD" && issue.status !== "CONFORME" && <div className={styles.fieldIssueActions}><Button variant="secondary" disabled={Boolean(resolvingIssueId)} onClick={() => void resolveFieldIssue(issue.id, issue.fieldLabel)}><Check size={15} />{resolvingIssueId === issue.id ? "Mise à jour…" : "Marquer comme conforme"}</Button><small>Après vérification ou correction de la valeur ci-dessus.</small></div>}
            {issue.documents.length > 0 && <div className={styles.documents}>{issue.documents.map((document) => <div className={styles.document} key={document.id}><a href={document.driveUrl} target="_blank" rel="noreferrer"><FileText size={15} /><span>{document.name}<small>Déposé le {formatDate(document.createdAt, true)}</small></span><ExternalLink size={13} /></a>{issue.status === "CORRECTION_RECUE" && <Button variant="secondary" disabled={Boolean(validatingDocumentId)} onClick={() => void validateDocumentCorrection(issue.id, document.id, document.name)}><Check size={15} />{validatingDocumentId === document.id ? "Validation…" : "Valider cette correction"}</Button>}</div>)}</div>}
          </article>)}
          {detail.reminders.length > 0 && <div className={styles.reminders}><strong>Derniers e-mails envoyés</strong>{detail.reminders.slice(0, 3).map((reminder) => <div className={styles.reminder} key={reminder.id}><Mail size={15} /><span><b>{reminder.status === "SENT" ? "E-mail envoyé" : "Échec d’envoi"}</b><small>{formatDate(reminder.sentAt, true)} · {reminder.recipient}</small></span></div>)}</div>}
        </section>
      </div>}
    </aside>
    {issueOpen && <IssueModal fields={fields} onClose={() => setIssueOpen(false)} onSubmit={createIssue} />}
    {edited && <EditModal field={edited} onClose={() => setEdited(undefined)} onSubmit={saveValue} />}
    {reminderOpen && <ReminderModal preview={reminderPreview} loading={loadingPreview} sending={sendingReminder} onClose={() => setReminderOpen(false)} onSend={sendReminder} />}
  </>;
}

function ReminderModal({ preview, loading, sending, onClose, onSend }: { preview?: ReminderPreview; loading: boolean; sending: boolean; onClose: () => void; onSend: () => void }) {
  return <Modal title="Envoyer l’e-mail de signalement" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={sending}>Annuler</Button><Button onClick={onSend} disabled={!preview || loading || sending}><Send size={15} />{sending ? "Envoi…" : "Envoyer"}</Button></>}>
    {loading ? <div className={styles.previewLoading}><Spinner /></div> : preview ? <><div className={styles.previewMeta}><span>À</span><strong>{preview.recipient}</strong><span>Objet</span><strong>{preview.subject}</strong></div><p className={styles.preview}>{preview.body}</p><p className={styles.hint}>Vérifiez le contenu avant l’envoi. L’e-mail regroupe toutes les anomalies ouvertes.</p></> : <p className={styles.noIssue}>La prévisualisation n’a pas pu être chargée.</p>}
  </Modal>;
}

function IssueModal({ fields, onClose, onSubmit }: { fields: EnrollmentDetail["fields"]; onClose: () => void; onSubmit: (input: IssueCreateInput) => Promise<void> }) {
  const [key, setKey] = useState(fields[0]?.key ?? ""); const [reason, setReason] = useState(""); const field = fields.find((item) => item.key === key);
  return <Modal title="Signaler une non-conformité" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!field || reason.length < 3} onClick={() => field && void onSubmit({ fieldKey: field.key, fieldLabel: field.label, kind: field.kind === "DOCUMENT" ? "DOCUMENT" : "FIELD", reason })}>Ajouter</Button></>}><div className="field"><label>Information</label><select value={key} onChange={(event) => setKey(event.target.value)}>{fields.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div><div className="field"><label>Motif</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div></Modal>;
}

function isHttpUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } }

function EditModal({ field, onClose, onSubmit }: { field: { label: string; value: string }; onClose: () => void; onSubmit: (value: string) => Promise<void> }) {
  const [value, setValue] = useState(field.value);
  return <Modal title={`Corriger ${field.label}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => void onSubmit(value)}>Enregistrer</Button></>}><div className="field"><label>Valeur</label><input value={value} onChange={(event) => setValue(event.target.value)} /></div></Modal>;
}
