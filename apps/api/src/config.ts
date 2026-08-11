import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: new URL("../../../.env", import.meta.url) });

const booleanString = z.string().optional().transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgresql://lasportive:lasportive@localhost:5432/lasportive?schema=public"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-123456"),
  APP_USERNAME: z.string().default("association"),
  APP_PASSWORD_HASH: z.string().optional(),
  APP_PASSWORD: z.string().min(8).default("demo-sportive"),
  DEMO_MODE: booleanString,
  DEMO_USERNAME: z.string().default("association"),
  DEMO_PASSWORD: z.string().min(8).default("demo-sportive"),
  SYNC_CRON: z.string().default("*/15 * * * *"),
  HELLOASSO_ENVIRONMENT: z.enum(["sandbox", "production"]).default("production"),
  HELLOASSO_API_BASE_URL: z.string().url().optional().or(z.literal("")),
  HELLOASSO_ORGANIZATION_SLUG: z.string().optional(),
  HELLOASSO_CAMPAIGN_SLUG: z.string().optional(),
  HELLOASSO_CLIENT_ID: z.string().optional(),
  HELLOASSO_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanString,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("La Sportive <association@example.org>"),
  SMTP_REPLY_TO: z.string().email().default("association@example.org"),
  GOOGLE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URL: z.string().url().default("http://localhost:4000/api/v1/integrations/google-drive/callback"),
});

export type AppConfig = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);

if (config.NODE_ENV === "production") {
  if (!config.APP_PASSWORD_HASH) throw new Error("APP_PASSWORD_HASH est obligatoire en production.");
  if (config.JWT_SECRET === "development-only-secret-change-me-123456") throw new Error("JWT_SECRET doit être remplacé en production.");
}
