// Legacy real-time signal for what used to be the TICKETS_SOURCE=linear read path (that
// rollback switch was fully retired in chore/retire-linear-sync — lib/linear.ts's
// fetchStatusIssues() now delegates unconditionally to the delivery ticket DB). A single row
// ("singleton") whose `version` integer used to be bumped by the Linear webhook on every
// issue change (retired CAM-281 T-5b).
//
// CAM-287: app/api/status/stream/route.ts (the SSE loop) and app/api/status/pulse/route.ts
// (the manual-bump endpoint) switched to lib/delivery/pulse.ts's DeliveryPulse — the pulse
// real ticket mutations actually bump today (ADR-010, no webhook). Nothing calls
// `bumpPulse` in this codebase any more, so this row is now dormant/frozen — it will not
// change again. `readPulse` still has real callers (app/status/page.tsx,
// app/status/map/page.tsx, app/status/map/data/route.ts, app/api/status/version/route.ts),
// but the value now goes nowhere useful: they pass it into fetchStatusIssues(pulse), which
// ignores the argument unconditionally now that the TICKETS_SOURCE=linear branch it used to
// key is gone — an inert read, not a live cache key. Simplifying those call sites is a
// follow-up, out of scope for chore/retire-linear-sync. Do NOT delete this file — those
// reads still resolve; only their usefulness downstream has changed.
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
