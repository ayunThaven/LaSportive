import { config } from "../config.js";
import type { AppRepository } from "../domain/types.js";
import { DemoRepository } from "./demo.js";

export async function createRepository(): Promise<AppRepository> {
  if (config.DEMO_MODE) return new DemoRepository();
  const { PrismaRepository } = await import("./prisma.js");
  return new PrismaRepository();
}
