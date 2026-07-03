/**
 * CAM-275 — Fix the gate-approval chain (token asymmetry + silent dispatch failure).
 *
 * Ground truth (already diagnosed, see the ticket):
 *   1. Token asymmetry: /api/status/approve, /api/status/reject, /api/status/issue/[id]
 *      (plus pulse/stream/version) default-DENY when STATUS_TOKEN is unset, but
 *      /status, /status/map, and /status/map/data defaulted OPEN — so with STATUS_TOKEN
 *      unset the map rendered approve buttons that always 401'd.
 *   2. Silent downstream failure: linear-webhook's fireDispatch() and sendTelegram()
 *      could fail with nothing logged — an "approved" click looked successful but never
 *      continued the orchestrator.
 *
 * Fix: lib/status-auth.ts is the single, symmetric, default-deny gate every surface now
 * imports (view + mutation alike), plus structured failure logs for both silent paths.
 *
 * Layer: unit (real function calls with env stubs) + source-inspection (fs read, mirrors
 * the repo's existing status-derive.test.ts / status-map.test.ts style).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// lib/status-auth.ts declares `import "server-only"` (a Next.js-only shim not resolvable
// under plain Node/vitest) — stub it the same way the rest of the suite does.
vi.mock("server-only", () => ({}));

import { isStatusAuthorized, isStatusRequestAuthorized } from "@/lib/status-auth";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

// next/types/global.d.ts augments NodeJS.ProcessEnv with `readonly NODE_ENV` — direct
// assignment/delete fails to typecheck. vi.stubEnv is the repo's established workaround
// (see __tests__/cam-239-upload-blob-csp.test.ts).
function setEnv(nodeEnv: string | undefined, statusToken: string | undefined) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("STATUS_TOKEN", statusToken);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. isStatusAuthorized — the page-surface gate (searchParams.token)
// ─────────────────────────────────────────────────────────────────────────────

describe("lib/status-auth.ts — isStatusAuthorized (CAM-275)", () => {
  it("[dev] NODE_ENV=development → true regardless of STATUS_TOKEN state (unset)", () => {
    setEnv("development", undefined);
    expect(isStatusAuthorized(undefined)).toBe(true);
    expect(isStatusAuthorized(null)).toBe(true);
    expect(isStatusAuthorized("anything")).toBe(true);
  });

  it("[dev] NODE_ENV=development → true even with a mismatching token", () => {
    setEnv("development", "correct");
    expect(isStatusAuthorized("wrong")).toBe(true);
  });

  it("[prod] STATUS_TOKEN unset → false (default-deny, NOT open)", () => {
    setEnv("production", undefined);
    expect(isStatusAuthorized(undefined)).toBe(false);
    expect(isStatusAuthorized("")).toBe(false);
    expect(isStatusAuthorized("anything")).toBe(false);
  });

  it("[prod] STATUS_TOKEN set + matching token → true", () => {
    setEnv("production", "secret-token");
    expect(isStatusAuthorized("secret-token")).toBe(true);
  });

  it("[prod] STATUS_TOKEN set + mismatching token → false", () => {
    setEnv("production", "secret-token");
    expect(isStatusAuthorized("wrong")).toBe(false);
    expect(isStatusAuthorized(undefined)).toBe(false);
  });

  it("[staging-like/test env] NODE_ENV=test + STATUS_TOKEN unset → false (default-deny, not the old open fallback)", () => {
    // The regression this fix closes: NODE_ENV is "test" under vitest (not "development"),
    // so the dev bypass must NOT apply here — proves the fix doesn't silently widen the gate.
    setEnv("test", undefined);
    expect(isStatusAuthorized(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. isStatusRequestAuthorized — the API-route gate (query OR header)
// ─────────────────────────────────────────────────────────────────────────────

function reqWith(opts: { token?: string; header?: string } = {}): Request {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = {};
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/approve${qs}`, { headers });
}

describe("lib/status-auth.ts — isStatusRequestAuthorized (CAM-275)", () => {
  it("[dev] NODE_ENV=development → true with no token at all", () => {
    setEnv("development", undefined);
    expect(isStatusRequestAuthorized(reqWith())).toBe(true);
  });

  it("[prod] STATUS_TOKEN unset → false (default-deny)", () => {
    setEnv("production", undefined);
    expect(isStatusRequestAuthorized(reqWith())).toBe(false);
    expect(isStatusRequestAuthorized(reqWith({ token: "anything" }))).toBe(false);
  });

  it("[prod] matching query token → true", () => {
    setEnv("production", "secret");
    expect(isStatusRequestAuthorized(reqWith({ token: "secret" }))).toBe(true);
  });

  it("[prod] matching x-status-token header → true", () => {
    setEnv("production", "secret");
    expect(isStatusRequestAuthorized(reqWith({ header: "secret" }))).toBe(true);
  });

  it("[prod] mismatching query token and no header → false", () => {
    setEnv("production", "secret");
    expect(isStatusRequestAuthorized(reqWith({ token: "wrong" }))).toBe(false);
  });

  it("[prod] mismatching header → false", () => {
    setEnv("production", "secret");
    expect(isStatusRequestAuthorized(reqWith({ header: "wrong" }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Source-inspection — every surface imports the shared helper; no local
//    open-fallback (`if (!required) return true`) remains anywhere.
// ─────────────────────────────────────────────────────────────────────────────

const SURFACES: Array<{ label: string; path: string; symbol: string }> = [
  { label: "app/status/page.tsx", path: "../app/status/page.tsx", symbol: "isStatusAuthorized" },
  { label: "app/status/map/page.tsx", path: "../app/status/map/page.tsx", symbol: "isStatusAuthorized" },
  { label: "app/status/map/data/route.ts", path: "../app/status/map/data/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/approve/route.ts", path: "../app/api/status/approve/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/reject/route.ts", path: "../app/api/status/reject/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/issue/[id]/route.ts", path: "../app/api/status/issue/[id]/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/pulse/route.ts", path: "../app/api/status/pulse/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/stream/route.ts", path: "../app/api/status/stream/route.ts", symbol: "isStatusRequestAuthorized" },
  { label: "app/api/status/version/route.ts", path: "../app/api/status/version/route.ts", symbol: "isStatusRequestAuthorized" },
];

describe("CAM-275 — every /status surface imports the shared lib/status-auth gate", () => {
  for (const s of SURFACES) {
    it(`${s.label} imports ${s.symbol} from @/lib/status-auth`, () => {
      const src = read(s.path);
      expect(src).toContain("@/lib/status-auth");
      expect(src).toContain(s.symbol);
    });

    it(`${s.label} has NO local open-fallback ("if (!required) return true")`, () => {
      const src = read(s.path);
      expect(src).not.toContain("if (!required) return true");
    });

    it(`${s.label} does not declare its own local "authorized" function (pure delegation)`, () => {
      const src = read(s.path);
      expect(src).not.toMatch(/function authorized\(/);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Unauthorized-page notice copy — symmetric, no jargon, matches the spec verbatim
// ─────────────────────────────────────────────────────────────────────────────

describe("CAM-275 — unauthorized notice copy (Thai, verbatim)", () => {
  it("app/status/page.tsx renders the ลิงก์ไม่ถูกต้อง notice (not the old 'Protected dashboard')", () => {
    const src = read("../app/status/page.tsx");
    expect(src).toContain("ลิงก์ไม่ถูกต้อง");
    expect(src).toContain("เปิดหน้านี้ผ่านลิงก์จาก Telegram หรือใส่รหัสให้ถูกต้อง");
    expect(src).not.toContain("Protected dashboard");
  });

  it("app/status/map/page.tsx renders the same ลิงก์ไม่ถูกต้อง notice", () => {
    const src = read("../app/status/map/page.tsx");
    expect(src).toContain("ลิงก์ไม่ถูกต้อง");
    expect(src).toContain("เปิดหน้านี้ผ่านลิงก์จาก Telegram หรือใส่รหัสให้ถูกต้อง");
    expect(src).not.toContain("Protected dashboard");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Observable failures — notify telegram_send_skipped
//
// CAM-275's original gate_dispatch_failed / awaiting-you-removal-detection coverage lived
// on app/api/linear-webhook/route.ts, which CAM-281 (T-5b) deleted (the delivery service
// — lib/delivery/tickets.ts's approve()/dispatchApproved() — now owns both the dispatch
// and its own structured failure log; see __tests__/cam-281-dual-mode-writes.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

describe("CAM-275 — observable Telegram failures", () => {
  it("lib/notify.ts logs telegram_send_skipped when TELEGRAM_BOT_TOKEN/CHAT_ID are missing", () => {
    const src = read("../lib/notify.ts");
    expect(src).toContain("telegram_send_skipped");
    // Never log the token itself — only a static reason string.
    expect(src).not.toContain('reason: token');
  });
});
