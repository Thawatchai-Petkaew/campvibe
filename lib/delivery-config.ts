// Singleton delivery-team config (autonomous mode flag) — read by the /status
// dashboard + the orchestrator, written by the /status toggle and `/camper-agent`.
// Persisted in DB (not memory) so it survives Vercel serverless instances.
import "server-only";
import { prisma } from "@/lib/prisma";

const ID = "singleton";

export async function getAutonomousMode(): Promise<boolean> {
  try {
    const row = await prisma.deliveryConfig.findUnique({ where: { id: ID } });
    return row?.autonomousMode ?? false;
  } catch {
    return false; // default OFF if the table/row isn't there yet
  }
}

export async function setAutonomousMode(on: boolean, by?: string): Promise<boolean> {
  const row = await prisma.deliveryConfig.upsert({
    where: { id: ID },
    update: { autonomousMode: on, updatedBy: by ?? null },
    create: { id: ID, autonomousMode: on, updatedBy: by ?? null },
  });
  return row.autonomousMode;
}
