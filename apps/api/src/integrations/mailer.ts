import { config } from "../config.js";

export type MailMessage = { to: string; subject: string; text: string };

type BrevoError = { message?: string; code?: string };

function address(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: value.trim() };
  const [, rawName = "", rawEmail = ""] = match;
  const name = rawName.trim();
  return { email: rawEmail.trim(), ...(name ? { name } : {}) };
}

export class Mailer {
  async send(message: MailMessage): Promise<void> {
    if (config.DEMO_MODE) return;
    if (!config.BREVO_API_KEY) throw new Error("L’API Brevo n’est pas configurée.");
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "application/json", "api-key": config.BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ sender: address(config.EMAIL_FROM), replyTo: address(config.EMAIL_REPLY_TO), to: [address(message.to)], subject: message.subject, textContent: message.text, tags: ["reminder"] }),
    });
    if (response.ok) return;

    const payload = await response.json().catch(() => ({})) as BrevoError;
    const detail = payload.message || payload.code || `Erreur HTTP ${response.status}`;
    throw new Error(`Brevo a refusé l’envoi : ${detail}`);
  }
}
