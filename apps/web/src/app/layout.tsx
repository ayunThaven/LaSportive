import type { Metadata } from "next";
import "./checkbox-fix.css";
import "./globals.css";

export const metadata: Metadata = { title: "La Sportive", description: "Gestion des adhésions HelloAsso" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
