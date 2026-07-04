// SSE stream that pushes a "refresh" signal to open /status dashboards when a ticket
// mutation bumps the pulse. Zero new infra: the server polls one tiny Postgres row and
// emits an event when `version` increases. Self-closes after MAX_MS so the browser's
// EventSource reconnects cleanly (tolerates the Vercel function-duration cap).
//
// CAM-287: switched from lib/status-pulse.ts (StatusPulse — bumped by the retired Linear
// webhook, CAM-281 T-5b) to lib/delivery/pulse.ts (DeliveryPulse — bumped in-process by
// every lib/delivery/tickets.ts mutation, ADR-010 "single mutation path, no webhook").
// This is the pulse real ticket mutations actually bump today; the response/event shape
// and version semantics (a monotonic integer, "value changed" = refresh) are unchanged.
import { readDeliveryPulse } from "@/lib/delivery/pulse";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Shared STATUS_TOKEN gate (lib/status-auth.ts — CAM-275): default-deny — missing
  // STATUS_TOKEN → 401 (no open fallback).
  if (!isStatusRequestAuthorized(req)) return new Response("unauthorized", { status: 401 });

  // RISK-7: IP connection rate-limit (5 connections / 1 min).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:stream:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response("rate_limited", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  // Read per-request (env-overridable) so tests can drive the loop with tiny values.
  // CAM-175: default reduced from 2500ms to 1500ms for ≤15s freshness target.
  const POLL_MS = Number(process.env.STATUS_STREAM_POLL_MS) || 1500;
  const HEARTBEAT_MS = Number(process.env.STATUS_STREAM_HEARTBEAT_MS) || 15000;
  const MAX_MS = Number(process.env.STATUS_STREAM_MAX_MS) || 25000;

  const encoder = new TextEncoder();
  let poll: ReturnType<typeof setInterval> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let closeT: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = await readDeliveryPulse();
      let closed = false;
      const send = (s: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(s)); } catch { /* stream already closed */ }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (poll) clearInterval(poll);
        if (beat) clearInterval(beat);
        if (closeT) clearTimeout(closeT);
        try { controller.close(); } catch { /* already closed */ }
      };

      send(`retry: 3000\n\n`); // EventSource reconnect backoff
      send(`: connected\n\n`);

      poll = setInterval(async () => {
        try {
          const v = await readDeliveryPulse();
          if (v > last) { last = v; send(`data: {"version":${v}}\n\n`); }
        } catch { /* transient DB error — keep the connection, retry next tick */ }
      }, POLL_MS);

      beat = setInterval(() => send(`: hb\n\n`), HEARTBEAT_MS); // keep-alive comment
      closeT = setTimeout(cleanup, MAX_MS);

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (poll) clearInterval(poll);
      if (beat) clearInterval(beat);
      if (closeT) clearTimeout(closeT);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
