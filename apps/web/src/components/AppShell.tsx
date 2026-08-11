"use client";

import { useEffect, useState, type PropsWithChildren } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, BadgePercent, CodeXml, FileCheck2, LogOut, Menu, RefreshCw, Settings, X } from "lucide-react";
import type { SettingsDto } from "@la-sportive/contracts";
import { api } from "@/lib/api";
import { Button, Modal, Spinner } from "./ui";
import styles from "./AppShell.module.css";
import jsonStyles from "./AppShellJson.module.css";

const navigation = [
  { href: "/conformite", label: "Conformité", icon: FileCheck2 },
  { href: "/licences", label: "Licences", icon: BadgeCheck },
  { href: "/reductions", label: "Réductions", icon: BadgePercent },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingRawJson, setLoadingRawJson] = useState(false);
  const [rawHelloAsso, setRawHelloAsso] = useState<unknown>();
  const [message, setMessage] = useState<string>();
  const [campaignLabel, setCampaignLabel] = useState("Campagne active");
  const [season, setSeason] = useState("Saison en cours");

  useEffect(() => {
    api("/auth/session").then(async () => {
      const settings = await api<SettingsDto>("/settings");
      const campaign = settings.campaigns.find((item) => item.id === settings.activeCampaignId);
      if (campaign) { setSeason(`Saison ${campaign.season}`); setCampaignLabel(campaign.title); }
      setReady(true);
    }).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    const refreshCampaign = () => {
      void api<SettingsDto>("/settings").then((settings) => {
        const campaign = settings.campaigns.find((item) => item.id === settings.activeCampaignId);
        if (campaign) { setSeason(`Saison ${campaign.season}`); setCampaignLabel(campaign.title); }
      });
    };
    window.addEventListener("lasportive:refresh", refreshCampaign);
    return () => window.removeEventListener("lasportive:refresh", refreshCampaign);
  }, []);

  async function synchronize() {
    setSyncing(true); setMessage(undefined);
    try {
      const result = await api<{ imported: number; updated: number }>("/sync", { method: "POST" });
      setMessage(`${result.imported} importé(s), ${result.updated} actualisé(s)`);
      window.dispatchEvent(new Event("lasportive:refresh"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Échec de la synchronisation"); }
    finally { setSyncing(false); setTimeout(() => setMessage(undefined), 5000); }
  }

  async function showRawHelloAsso() {
    setLoadingRawJson(true); setMessage(undefined);
    try {
      setRawHelloAsso(await api<unknown>("/dev/helloasso/raw"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de récupérer le JSON HelloAsso."); }
    finally { setLoadingRawJson(false); }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!ready) return <main className={styles.boot}><Spinner /><p>Préparation de votre espace…</p></main>;

  return (
    <div className={styles.layout}>
      <button className={styles.menuButton} onClick={() => setMenu(true)} aria-label="Ouvrir le menu"><Menu /></button>
      <aside className={`${styles.sidebar} ${menu ? styles.open : ""}`}>
        <button className={styles.close} onClick={() => setMenu(false)} aria-label="Fermer"><X /></button>
        <Link href="/conformite" className={styles.brand} onClick={() => setMenu(false)}>
          <span className={styles.mark}>LS</span><span>La Sportive<small>Gestion des adhésions</small></span>
        </Link>
        <nav>
          <p>ESPACE DE TRAVAIL</p>
          {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? styles.active : ""} onClick={() => setMenu(false)}><Icon size={19}/>{label}</Link>)}
        </nav>
        <div className={styles.sideBottom}>
          <Link href="/reglages" className={pathname === "/reglages" ? styles.active : ""}><Settings size={19}/>Réglages</Link>
          <button onClick={logout}><LogOut size={19}/>Se déconnecter</button>
          <div className={styles.account}><span>A</span><div><strong>Association</strong><small>Compte partagé</small></div></div>
        </div>
      </aside>
      {menu && <button className={styles.mobileBackdrop} onClick={() => setMenu(false)} aria-label="Fermer le menu" />}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div><span className={styles.seasonDot}/><strong>{season}</strong><small>{campaignLabel}</small></div>
          <section className={jsonStyles.topbarActions}>
            <Button variant="ghost" onClick={showRawHelloAsso} disabled={syncing || loadingRawJson}><CodeXml size={16}/>{loadingRawJson ? "Chargement…" : "Voir le JSON"}</Button>
            <Button variant="secondary" onClick={synchronize} disabled={syncing || loadingRawJson}><RefreshCw size={16} className={syncing ? styles.spin : ""}/>{syncing ? "Synchronisation…" : "Actualiser HelloAsso"}</Button>
          </section>
        </header>
        {message && <div className={styles.toast}>{message}</div>}
        <div className={styles.content}>{children}</div>
      </main>
      {rawHelloAsso !== undefined && <Modal title="JSON reçu de HelloAsso" onClose={() => setRawHelloAsso(undefined)} footer={<Button variant="secondary" onClick={() => setRawHelloAsso(undefined)}>Fermer</Button>}>
        <p className={jsonStyles.hint}>Données brutes de la campagne active. Elles peuvent contenir des informations personnelles.</p>
        <pre className={jsonStyles.content}>{JSON.stringify(rawHelloAsso, null, 2)}</pre>
      </Modal>}
    </div>
  );
}
