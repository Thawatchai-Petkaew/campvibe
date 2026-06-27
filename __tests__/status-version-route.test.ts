import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/status-pulse", () => ({ readPulse: vi.fn(async () => 0) }));

import { GET } from "@/app/api/status/version/route";
import { readPulse } from "@/lib/status-pulse";
import { _store as rateLimitStore } from "@/lib/rate-limit";

const rp = vi.mocked(readPulse);

const TEST_TOKEN = "test-secret";

function req(token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Request(`http://localhost/api/status/version${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // SEC-A: STATUS_TOKEN is now always required; set it so happy-path tests pass auth.
  process.env.STATUS_TOKEN = TEST_TOKEN;
  rateLimitStore.clear();
});

describe("status/version", () => {
  it("[AC4] returns the current pulse version", async () => {
    rp.mockResolvedValueOnce(7);
    const res = await GET(req(TEST_TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 7 });
  });

  it("returns 0 when the pulse row does not exist", async () => {
    rp.mockResolvedValueOnce(0);
    expect(await (await GET(req(TEST_TOKEN))).json()).toEqual({ version: 0 });
  });

  // SEC-A: 401 when STATUS_TOKEN is unset (no open fallback)
  it("[SEC-A] 401 when STATUS_TOKEN is not configured", async () => {
    delete process.env.STATUS_TOKEN;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("[AC5] 401 on a wrong token when STATUS_TOKEN is set", async () => {
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
  });

  it("200 with the correct token", async () => {
    rp.mockResolvedValueOnce(3);
    const res = await GET(req(TEST_TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 3 });
  });

  // SEC-A: rate-limit 429
  it("[SEC-A] 429 + Retry-After when rate limit is exceeded", async () => {
    const now = Date.now();
    const key = "status:version:unknown";
    // Fill the 60-req/min bucket.
    rateLimitStore.set(key, Array.from({ length: 60 }, () => now));
    const res = await GET(req(TEST_TOKEN));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
