import Link from "next/link";
import styles from "./LegalPage.module.css";

export function LegalLinks() {
  return <nav className={styles.links} aria-label="Informations légales">
    <Link href="/confidentialite">Confidentialité</Link>
    <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
  </nav>;
}
