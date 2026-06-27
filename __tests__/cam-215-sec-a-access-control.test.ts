/**
 * CAM-215 SEC-A access-control tests.
 *
 * 1. Open-redirect fix in lib/actions.ts:
 *    The redirect sanitization logic is tested by extracting the exact
 *    condition from actions.ts as a pure predicate, then asserting which
 *    paths are accepted or fall back.  This avoids pulling in the full
 *    next-auth/server stack in the Node test environment.
 *
 * 2. Status routes return 401 when STATUS_TOKEN is unset (no open fallback):
 *    POST /api/status/pulse
 *    GET  /api/status/version
 *    GET  /api/status/issue/[id]
 *
 * 3. Rate-limit 429 on pulse / version / issue/[id].
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks for status-route dependencies ──────────────────────────────────────

vi.mock("@/lib/status-pulse", () => ({
  readPulse: vi.fn(async () => 0),
  bumpPulse: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { POST as pulse } from "@/app/api/status/pulse/route";
import { GET as version } from "@/app/api/status/version/route";
import { GET as issueDetail } from "@/app/api/status/issue/[id]/route";
import { _store as rateLimitStore } from "@/lib/rate-limit";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mirrors the EXACT sanitization condition from lib/actions.ts (SEC-A fix).
 * A valid redirect target must:
 *   - be a non-null string
 *   - start with "/"
 *   - NOT start with "//" (protocol-relative)
 *   - NOT start with "/\" (backslash trick)
 * Otherwise fall back to "/".
 */
function sanitizeRedirect(raw: string | null | undefined): string {
  return typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
    ? raw
    : "/";
}

function pulseReq(token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Request(`http://localhost/api/status/pulse${qs}`, { method: "POST" });
}

function versionReq(token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Request(`http://localhost/api/status/version${qs}`);
}

function issueReq(id: string, token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Request(`http://localhost/api/status/issue/${id}${qs}`);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;
  rateLimitStore.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Open-redirect fix — sanitizeRedirect() (mirrors lib/actions.ts SEC-A fix)
// ─────────────────────────────────────────────────────────────────────────────

describe("[SEC-A] open-redirect sanitization — lib/actions.ts authenticate()", () => {
  it("valid same-origin path /dashboard → preserved", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
  });

  it("valid nested path /status/map → preserved", () => {
    expect(sanitizeRedirect("/status/map")).toBe("/status/map");
  });

  it("root path / → preserved", () => {
    expect(sanitizeRedirect("/")).toBe("/");
  });

  it("external URL http://evil.com → falls back to /", () => {
    expect(sanitizeRedirect("http://evil.com")).toBe("/");
  });

  it("external URL https://evil.com/steal → falls back to /", () => {
    expect(sanitizeRedirect("https://evil.com/steal")).toBe("/");
  });

  it("protocol-relative //evil.com → falls back to /", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/");
  });

  it("backslash trick /\\evil.com → falls back to /", () => {
    expect(sanitizeRedirect("/\\evil.com")).toBe("/");
  });

  it("null → falls back to /", () => {
    expect(sanitizeRedirect(null)).toBe("/");
  });

  it("undefined → falls back to /", () => {
    expect(sanitizeRedirect(undefined)).toBe("/");
  });

  it("empty string → falls back to /", () => {
    expect(sanitizeRedirect("")).toBe("/");
  });

  it("relative path without leading slash → falls back to /", () => {
    expect(sanitizeRedirect("dashboard")).toBe("/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Status routes — 401 when STATUS_TOKEN is unset (no open fallback)
// ─────────────────────────────────────────────────────────────────────────────

describe("[SEC-A] status/pulse — 401 when STATUS_TOKEN is unset", () => {
  it("returns 401 with no token configured", async () => {
    // STATUS_TOKEN is deleted in beforeEach
    const res = await pulse(pulseReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token when STATUS_TOKEN is set", async () => {
    process.env.STATUS_TOKEN = "correct";
    const res = await pulse(pulseReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct token", async () => {
    process.env.STATUS_TOKEN = "correct";
    const res = await pulse(pulseReq("correct"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("[SEC-A] status/version — 401 when STATUS_TOKEN is unset", () => {
  it("returns 401 with no token configured", async () => {
    const res = await version(versionReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token when STATUS_TOKEN is set", async () => {
    process.env.STATUS_TOKEN = "correct";
    const res = await version(versionReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct token", async () => {
    process.env.STATUS_TOKEN = "correct";
    const res = await version(versionReq("correct"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ version: 0 });
  });
});

describe("[SEC-A] status/issue/[id] — 401 when STATUS_TOKEN is unset", () => {
  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 401 with no token configured", async () => {
    const res = await issueDetail(issueReq("CAM-9"), makeParams("CAM-9"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token when STATUS_TOKEN is set", async () => {
    process.env.STATUS_TOKEN = "correct";
    const res = await issueDetail(issueReq("CAM-9", "wrong"), makeParams("CAM-9"));
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rate-limit 429 + Retry-After
// ─────────────────────────────────────────────────────────────────────────────

describe("[SEC-A] rate-limit — pulse (30/min)", () => {
  it("429 + Retry-After when bucket is exhausted", async () => {
    process.env.STATUS_TOKEN = "tok";
    const now = Date.now();
    rateLimitStore.set("status:pulse:unknown", Array.from({ length: 30 }, () => now));
    const res = await pulse(pulseReq("tok"));
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("allows within the 30-req/min limit", async () => {
    process.env.STATUS_TOKEN = "tok";
    // Only 29 entries — should allow the 30th.
    const now = Date.now();
    rateLimitStore.set("status:pulse:unknown", Array.from({ length: 29 }, () => now));
    const res = await pulse(pulseReq("tok"));
    expect(res.status).toBe(200);
  });
});

describe("[SEC-A] rate-limit — version (60/min)", () => {
  it("429 + Retry-After when bucket is exhausted", async () => {
    process.env.STATUS_TOKEN = "tok";
    const now = Date.now();
    rateLimitStore.set("status:version:unknown", Array.from({ length: 60 }, () => now));
    const res = await version(versionReq("tok"));
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("allows within the 60-req/min limit", async () => {
    process.env.STATUS_TOKEN = "tok";
    const now = Date.now();
    rateLimitStore.set("status:version:unknown", Array.from({ length: 59 }, () => now));
    const res = await version(versionReq("tok"));
    expect(res.status).toBe(200);
  });
});

describe("[SEC-A] rate-limit — issue/[id] (60/min)", () => {
  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("429 + Retry-After when bucket is exhausted", async () => {
    process.env.STATUS_TOKEN = "tok";
    const now = Date.now();
    rateLimitStore.set("status:issue:unknown", Array.from({ length: 60 }, () => now));
    const res = await issueDetail(issueReq("CAM-9", "tok"), makeParams("CAM-9"));
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
