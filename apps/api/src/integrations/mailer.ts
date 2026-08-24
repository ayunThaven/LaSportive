import net from "node:net";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config.js";

export type MailMessage = { to: string; subject: string; text: string };

export class Mailer {
  private transport?: Transporter;

  private getTransport() {
    if (!config.SMTP_HOST) throw new Error("La connexion SMTP n’est pas configurée.");
    this.transport ??= nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
      getSocket: (_options: unknown, callback: (error: Error | null, socketOptions: object) => void) => {
        const socket = net.connect({ host: config.SMTP_HOST, port: config.SMTP_PORT, family: 4 });
        const onError = (error: Error) => callback(error, { connection: socket });
        socket.once("error", onError);
        socket.once("connect", () => {
          socket.removeListener("error", onError);
          callback(null, { connection: socket });
        });
      },
    });
    return this.transport;
  }

  async send(message: MailMessage): Promise<void> {
    if (config.DEMO_MODE) return;
    await this.getTransport().sendMail({ from: config.SMTP_FROM, replyTo: config.SMTP_REPLY_TO, ...message });
  }

  resetConnection(): void {
    this.transport?.close();
    this.transport = undefined;
  }
}
