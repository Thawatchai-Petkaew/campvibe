// Real-time signal for the /status dashboard. A single row ("singleton") whose
// `version` integer is bumped by the Linear webhook on every issue change; the SSE
// stream polls it and pushes a refresh to connected dashboards. No business data.
import { prisma } from "@/lib/prisma";

const ID = "singleton";

/** Current pulse version (0 if the row does not exist yet). */
export async function readPulse(): Promise<number> {
  const row = await prisma.statusPulse.findUnique({ where: { id: ID }, select: { version: true } });
  return row?.version ?? 0;
}

/** Bump the pulse. Best-effort, no-throw: a DB hiccup must never break the webhook. */
export async function bumpPulse(): Promise<void> {
  try {
    await prisma.statusPulse.upsert({
      where: { id: ID },
      update: { version: { increment: 1 } },
      create: { id: ID, version: 1 },
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "pulse_bump_failed", reason: e instanceof Error ? e.message : String(e) }));
  }
}
