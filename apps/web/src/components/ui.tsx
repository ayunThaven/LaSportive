"use client";

import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./ui.module.css";

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />;
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    INCOMPLET: "Incomplet", ANOMALIE: "Anomalie", VERIF_CERTIFICAT: "Certificat à vérifier", A_VALIDER: "À valider", VALIDE: "Validé", A_TRAITER: "À traiter", TRAITE: "Traité",
    NON_CONFORME: "À corriger", RELANCE: "Relancé", CORRECTION_RECUE: "Correction reçue", CONFORME: "Conforme",
    SUCCESS: "Réussie", FAILED: "Échec", RUNNING: "En cours",
  };
  return <span className={`${styles.pill} ${styles[`pill_${status}`] ?? ""}`}><i />{labels[status] ?? status}</span>;
}

export function Modal({ title, children, onClose, footer }: PropsWithChildren<{ title: string; onClose: () => void; footer?: ReactNode }>) {
  return <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={styles.modal} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose} aria-label="Fermer"><X size={20} /></button></header><div className={styles.modalBody}>{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className={styles.empty}>{icon}<h3>{title}</h3><p>{text}</p></div>; }
export function Spinner() { return <span className={styles.spinner} aria-label="Chargement" />; }
