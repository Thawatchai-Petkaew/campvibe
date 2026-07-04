// lib/delivery/pulse.ts — the delivery-module equivalent of lib/status-pulse.ts.
//
// Bumped by lib/delivery/tickets.ts in the SAME service call that mutates a Ticket — there
// is no webhook to relay from (ADR-010 "single mutation path, no webhook"). Read by
// lib/delivery/status-adapter.ts to key its 60s unstable_cache, exactly mirroring how
// lib/linear.ts keys its cache on lib/status-pulse.ts's StatusPulse.version.
import "server-only";
import { getDeliveryClient } from "@/lib/delivery/client";

const ID = "singleton";

/** Current delivery pulse version (0 if the row does not exist yet). */
export async function readDeliveryPulse(): Promise<number> {
  const db = getDeliveryClient();
  const row = await db.deliveryPulse.findUnique({ where: { id: ID }, select: { version: true } });
  return row?.version ?? 0;
}

/** Bump the pulse. Best-effort, no-throw: a DB hiccup must never fail the calling mutation. */
export async function bumpDeliveryPulse(): Promise<void> {
  try {
    const db = getDeliveryClient();
    await db.deliveryPulse.upsert({
      where: { id: ID },
      update: { version: { increment: 1 } },
      create: { id: ID, version: 1 },
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "delivery_pulse_bump_failed",
        reason: e instanceof Error ? e.message : String(e),
      })
    );
  }
}
