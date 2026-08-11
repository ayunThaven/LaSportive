import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cron from "node-cron";
import { ZodError } from "zod";
import { config } from "./config.js";
import { createRepository } from "./repositories/index.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.headers.cookie", "body.password"] } });

await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
await app.register(cookie);
await app.register(jwt, { secret: config.JWT_SECRET, cookie: { cookieName: "la_sportive_session", signed: false } });
await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  return payload;
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) return reply.status(400).send({ message: "Les données envoyées sont invalides.", details: error.flatten() });
  app.log.error({ err: error }, "request failed");
  const httpError = error as { statusCode?: number; message?: string };
  const status = httpError.statusCode && httpError.statusCode < 500 ? httpError.statusCode : 500;
  return reply.status(status).send({ message: status === 500 ? "Une erreur interne est survenue." : httpError.message });
});

const repository = await createRepository();
const { sync } = await registerRoutes(app, repository);

if (!config.DEMO_MODE && cron.validate(config.SYNC_CRON)) {
  cron.schedule(config.SYNC_CRON, () => {
    void sync.run().catch((error) => app.log.error({ err: error }, "scheduled sync failed"));
  });
}

await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
