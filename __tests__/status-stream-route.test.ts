import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/status-pulse", () => ({ readPulse: vi.fn(async () => 0) }));

import { GET } from "@/app/api/status/stream/route";
import { readPulse } from "@/lib/status-pulse";
import { _store as rateLimitStore } from "@/lib/rate-limit";

const rp = vi.mocked(readPulse);

const TEST_TOKEN = "test-secret";

function req(token?: string) {
  // Default to the TEST_TOKEN so tests that exercise the happy path pass auth.
  const t = token !== undefined ? token : TEST_TOKEN;
  const qs = t ? `?token=${encodeURIComponent(t)}` : "";
  return new Request(`http://localhost/api/status/stream${qs}`);
}

// Drain the SSE stream for up to `ms`, returning all text seen. Bounded so it never hangs
// (the route also self-closes at MAX_MS). Reads against a per-read timeout to stay responsive.
async function drain(res: Response, ms: number): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const step = (await Promise.race([
      reader.read(),
      new Promise((r) => setTimeout(() => r({ value: undefined, done: false }), 40)),
    ])) as { value?: Uint8Array; done: boolean };
    if (step.done) break;
    if (step.value) out += dec.decode(step.value);
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
    const out = await drain(res, 300);
    expect(out).toContain('data: {"version":1}');
  });

  it("does not push a data event when the version is unchanged", async () => {
    rp.mockResolvedValue(5);
    const res = await GET(req());
    const out = await drain(res, 150);
    expect(out).not.toContain("data:");
  });
});
