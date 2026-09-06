import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "./LegalLinks";
import styles from "./LegalPage.module.css";

export function LegalPage({ title, introduction, children }: { title: string; introduction: string; children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>LS · La Sportive</Link><Link href="/conformite">Accéder à l’application →</Link></header>
    <article className={styles.document}>
      <p className={styles.kicker}>ESPACE INTERNE · MEMBRES DU BUREAU</p>
      <h1>{title}</h1>
      <p className={styles.introduction}>{introduction}</p>
      <p className={styles.date}>Dernière mise à jour : <time dateTime="2026-09-06">6 septembre 2026</time></p>
      <div className={styles.content}>{children}</div>
    </article>
    <footer><LegalLinks /></footer>
  </main>;
}
