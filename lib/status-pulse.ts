// Legacy real-time signal for the TICKETS_SOURCE=linear read path. A single row
// ("singleton") whose `version` integer used to be bumped by the Linear webhook on every
// issue change (retired CAM-281 T-5b).
//
// CAM-287: app/api/status/stream/route.ts (the SSE loop) and app/api/status/pulse/route.ts
// (the manual-bump endpoint) switched to lib/delivery/pulse.ts's DeliveryPulse — the pulse
// real ticket mutations actually bump today (ADR-010, no webhook). Nothing calls
// `bumpPulse` in this codebase any more, so this row is now dormant/frozen — it will not
// change again. `readPulse` still has real callers (app/status/page.tsx,
// app/status/map/page.tsx, app/status/map/data/route.ts, app/api/status/version/route.ts):
// they key their own cache off this version for the legacy TICKETS_SOURCE=linear rendering
// path, and each already falls back to a time-based cache when the pulse is stale/unavailable.
// Do NOT delete this file — those reads still resolve; only the write path is orphaned.
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
