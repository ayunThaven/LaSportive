"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("association");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(undefined);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      router.replace("/conformite");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); }
    finally { setLoading(false); }
  }

  return <main className={styles.page}>
    <section className={styles.story}>
      <div className={styles.brand}><span>LS</span>La Sportive</div>
      <div className={styles.storyText}><p>SAISON 2026–2027</p><h1>Moins de fichiers.<br/>Plus de sport.</h1><span>Suivez les dossiers, préparez les licences et retrouvez les aides sans quitter votre espace.</span></div>
      <div className={styles.quote}><ShieldCheck/><div><strong>Données maîtrisées</strong><small>HelloAsso reste votre source. Les corrections sont tracées séparément.</small></div></div>
    </section>
    <section className={styles.login}>
      <form onSubmit={submit}>
        <div className={styles.lock}><LockKeyhole/></div>
        <p className={styles.kicker}>ESPACE ASSOCIATION</p>
        <h2>Heureux de vous revoir</h2>
        <p className={styles.intro}>Connectez-vous avec le compte partagé de l’association.</p>
        {error && <div className={styles.error}>{error}</div>}
        <label>Identifiant<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••" minLength={8} required /></label>
        <Button type="submit" disabled={loading}>{loading ? "Connexion…" : <>Se connecter <ArrowRight size={18}/></>}</Button>
        <small className={styles.help}>Un souci d’accès ? Contactez l’administrateur de l’association.</small>
      </form>
    </section>
  </main>;
}
