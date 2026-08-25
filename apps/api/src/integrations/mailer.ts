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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function renderHtml(text: string) {
  const content = text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.every((line) => /^[•-]\s+/.test(line.trim()))) {
      return `<ul style="margin:20px 0;padding:0;list-style:none">${lines.map((line) => `<li style="margin:10px 0;padding:12px 16px;background:#f4f8f7;border-left:4px solid #2d7369;border-radius:4px;color:#263638">${escapeHtml(line.trim().replace(/^[•-]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 18px;color:#263638;font:16px/1.6 Arial,sans-serif">${escapeHtml(block).replace(/\r?\n/g, "<br />")}</p>`;
  }).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" /></head><body style="margin:0;padding:24px;background:#eef3f2"><main style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(16,47,56,.12)"><header style="padding:28px 36px;background:#102f38;color:#ffffff;font:700 22px Arial,sans-serif">La Sportive</header><section style="padding:32px 36px">${content}</section><footer style="padding:20px 36px;background:#f4f8f7;color:#607174;font:13px/1.5 Arial,sans-serif">Cet e-mail concerne le suivi de votre adhésion à La Sportive.</footer></main></body></html>`;
}

export class Mailer {
  async send(message: MailMessage): Promise<void> {
    if (config.DEMO_MODE) return;
    if (!config.BREVO_API_KEY) throw new Error("L’API Brevo n’est pas configurée.");
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "application/json", "api-key": config.BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ sender: address(config.EMAIL_FROM), replyTo: address(config.EMAIL_REPLY_TO), to: [address(message.to)], subject: message.subject, textContent: message.text, htmlContent: renderHtml(message.text), tags: ["reminder"] }),
    });
    if (response.ok) return;

    const payload = await response.json().catch(() => ({})) as BrevoError;
    const detail = payload.message || payload.code || `Erreur HTTP ${response.status}`;
    throw new Error(`Brevo a refusé l’envoi : ${detail}`);
  }
}
