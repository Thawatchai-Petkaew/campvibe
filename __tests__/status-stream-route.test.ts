import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/status-auth.ts (CAM-275) declares `import "server-only"` — stub it so the route's
// transitive import resolves under plain Node/vitest.
vi.mock("server-only", () => ({}));

// CAM-287: the route now reads lib/delivery/pulse.ts's DeliveryPulse (the pulse real
// ticket mutations bump), not the legacy lib/status-pulse.ts StatusPulse.
vi.mock("@/lib/delivery/pulse", () => ({ readDeliveryPulse: vi.fn(async () => 0) }));

import { GET } from "@/app/api/status/stream/route";
import { readDeliveryPulse } from "@/lib/delivery/pulse";
import { _store as rateLimitStore } from "@/lib/rate-limit";

const rp = vi.mocked(readDeliveryPulse);

const TEST_TOKEN = "test-secret";

function req(token?: string) {
  // Default to the TEST_TOKEN so tests that exercise the happy path pass auth.
  const t = token !== undefined ? token : TEST_TOKEN;
  const qs = t ? `?token=${encodeURIComponent(t)}` : "";
  return new Request(`http://localhost/api/status/stream${qs}`);
}

// Drain the SSE stream up to `ms`. If `until` is given, return early as soon as that
// substring is seen — so a happy-path assertion waits on the real event instead of a
// fixed window that flakes under CI load. The stream self-closes at STATUS_STREAM_MAX_MS,
// so a route that never emits still ends the loop (done) and the assertion fails — teeth intact.
//
// CAM-346: keep exactly ONE `reader.read()` in flight at a time (`pending`). The earlier
// version called `reader.read()` fresh on every loop iteration and raced it against a
// 40ms per-iteration timeout; when the timeout won, that read() call was NOT cancelled —
// it stayed pending in the background while the loop issued a brand-new read() next
// iteration. A stream reader resolves pending read() requests in FIFO order, so when the
// real chunk arrived just after a 40ms window elapsed (routinely, under CI CPU
// contention), it resolved the ABANDONED prior read() — whose outer Promise.race had
// already settled via timeout — and the loop's *current* read() kept waiting for a chunk
// that was already silently consumed. The data event vanished with no error (matches the
// PR #325 CI failure: only `retry`+`connected` observed). Reusing the single pending
// promise across iterations (re-checking it, never re-issuing while unresolved) removes
// the orphaned-read window entirely — a chunk can now only ever be seen by the read()
// call that is actually waiting for it. Reproduced deterministically + fix verified in
// isolation (10/10 old=drops the late chunk, new=keeps it); see CAM-346 QA notes.
async function drain(res: Response, ms: number, until?: string): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  const deadline = Date.now() + ms;
  const TIMEOUT = Symbol("drain-timeout");
  let pending: Promise<{ value?: Uint8Array; done: boolean }> | null = null;
  while (Date.now() < deadline) {
    if (!pending) pending = reader.read();
    const step = await Promise.race([
      pending,
      new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), 40)),
    ]);
    if (step === TIMEOUT) continue; // still the same pending read — keep waiting on it, don't reissue
    pending = null; // this read settled; the next iteration (if any) starts a fresh one
    if (step.done) break;
    if (step.value) out += dec.decode(step.value);
    if (until && out.includes(until)) break;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  // RISK-7: STATUS_TOKEN is now required; set a test token so happy-path tests pass auth.
  process.env.STATUS_TOKEN = TEST_TOKEN;
  process.env.STATUS_STREAM_POLL_MS = "15";
  process.env.STATUS_STREAM_HEARTBEAT_MS = "1000";
  process.env.STATUS_STREAM_MAX_MS = "400";
  // Clear in-process rate-limit store between tests.
  rateLimitStore.clear();
});
afterEach(() => {
  delete process.env.STATUS_STREAM_POLL_MS;
  delete process.env.STATUS_STREAM_HEARTBEAT_MS;
  delete process.env.STATUS_STREAM_MAX_MS;
});

describe("status/stream (SSE)", () => {
  it("[AC5] 401 on a wrong token when STATUS_TOKEN is set", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
  });

  it("opens with the reconnect hint + connected comment + SSE content-type", async () => {
    rp.mockResolvedValue(0);
    const res = await GET(req());
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const out = await drain(res, 120);
    expect(out).toContain("retry: 3000");
    expect(out).toContain(": connected");
  });

  it("[AC1] pushes a data event when the pulse version increases", async () => {
    let v = 0;
    rp.mockImplementation(async () => v);
    const res = await GET(req());
    setTimeout(() => { v = 1; }, 30); // bump shortly after the stream opens
    // Wait until the data event actually arrives (early-exit), not a fixed window.
    // 2000ms is only a safety cap — the stream self-closes at MAX_MS (400ms) well before it.
    const out = await drain(res, 2000, 'data: {"version":1}');
    expect(out).toContain('data: {"version":1}');
  });

  it("does not push a data event when the version is unchanged", async () => {
    rp.mockResolvedValue(5);
    const res = await GET(req());
    const out = await drain(res, 150);
    expect(out).not.toContain("data:");
  });
});
