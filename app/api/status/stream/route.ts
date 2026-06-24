// SSE stream that pushes a "refresh" signal to open /status dashboards when the
// Linear webhook bumps the pulse. Zero new infra: the server polls one tiny Postgres
// row and emits an event when `version` increases. Self-closes after MAX_MS so the
// browser's EventSource reconnects cleanly (tolerates the Vercel function-duration cap).
import { readPulse } from "@/lib/status-pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // parity with the /status page
  return new URL(req.url).searchParams.get("token") === required;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });

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
      let last = await readPulse();
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
          const v = await readPulse();
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
