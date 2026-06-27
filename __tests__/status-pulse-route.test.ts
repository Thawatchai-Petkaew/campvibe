import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/status-pulse", () => ({ bumpPulse: vi.fn(async () => {}) }));

import { POST } from "@/app/api/status/pulse/route";
import { bumpPulse } from "@/lib/status-pulse";
import { _store as rateLimitStore } from "@/lib/rate-limit";

const bump = vi.mocked(bumpPulse);

const TEST_TOKEN = "test-secret";

function req(opts: { token?: string; header?: string } = {}) {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = {};
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/pulse${qs}`, { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  // SEC-A: STATUS_TOKEN is now always required; set it so happy-path tests pass auth.
  process.env.STATUS_TOKEN = TEST_TOKEN;
  rateLimitStore.clear();
});

describe("status/pulse", () => {
  // SEC-A: 401 when STATUS_TOKEN is unset (no open fallback)
  it("[SEC-A] 401 when STATUS_TOKEN is not configured — does NOT bump", async () => {
    delete process.env.STATUS_TOKEN;
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(bump).not.toHaveBeenCalled();
  });

  it("[SEC-A] 401 on a wrong token when STATUS_TOKEN is set — does NOT bump", async () => {
    const res = await POST(req({ token: "nope" }));
    expect(res.status).toBe(401);
    expect(bump).not.toHaveBeenCalled();
  });

  it("200 with the correct token via query param", async () => {
    const res = await POST(req({ token: TEST_TOKEN }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(bump).toHaveBeenCalledTimes(1);
  });

  it("200 with the correct token via x-status-token header", async () => {
    const res = await POST(req({ header: TEST_TOKEN }));
    expect(res.status).toBe(200);
    expect(bump).toHaveBeenCalledTimes(1);
  });

  // SEC-A: rate-limit 429
  it("[SEC-A] 429 + Retry-After when rate limit is exceeded", async () => {
    // Exhaust the 30-req/min window for this IP.
    const now = Date.now();
    const key = "status:pulse:unknown";
    // Fill the bucket to exactly the limit.
    rateLimitStore.set(key, Array.from({ length: 30 }, () => now));
    const res = await POST(req({ token: TEST_TOKEN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(bump).not.toHaveBeenCalled();
  });
});
