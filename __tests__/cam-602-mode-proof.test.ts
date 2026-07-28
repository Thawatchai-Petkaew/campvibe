/**
 * scripts/lib/ticket-sync-mode-proof.mjs unit tests (CAM-602).
 *
 * Pure decision logic: does a GET /api/tickets?mode=<mode> response body PROVE the server
 * actually applied that mode? Kept as a pure-function test — no network, no live ticket DB,
 * no CLI process (see __tests__/cam-602-cli-mode-proof.test.ts for the real-spawn
 * behavioral proof of the CLI wiring built on top of this).
 */
import { describe, it, expect } from "vitest";
import { checkModeApplied } from "../scripts/lib/ticket-sync-mode-proof.mjs";

describe("checkModeApplied — CAM-602", () => {
  it("[normal] ok=true when appliedMode matches the requested mode (gate)", () => {
    expect(checkModeApplied({ appliedMode: "gate" }, "gate")).toEqual({ ok: true, appliedMode: "gate" });
  });

  it("[normal] ok=true when appliedMode matches the requested mode (audit)", () => {
    expect(checkModeApplied({ appliedMode: "audit" }, "audit")).toEqual({ ok: true, appliedMode: "audit" });
  });

  it("[error/validation] ok=false when appliedMode is missing entirely — the exact CAM-595 rollout shape (an older server that never read `mode` off the URL at all)", () => {
    expect(checkModeApplied({ tickets: [] }, "gate")).toEqual({ ok: false, appliedMode: undefined });
  });

  it("[error/validation] ok=false when appliedMode is null (a genuine general read leaked through as if it were the mode-scoped one)", () => {
    expect(checkModeApplied({ appliedMode: null }, "gate")).toEqual({ ok: false, appliedMode: null });
  });

  it("[error/validation] ok=false when appliedMode names the OTHER mode", () => {
    expect(checkModeApplied({ appliedMode: "audit" }, "gate")).toEqual({ ok: false, appliedMode: "audit" });
  });

  it("[null/empty] ok=false on a null response body", () => {
    expect(checkModeApplied(null, "gate")).toEqual({ ok: false, appliedMode: undefined });
  });

  it("[null/empty] ok=false on an undefined response body", () => {
    expect(checkModeApplied(undefined, "audit")).toEqual({ ok: false, appliedMode: undefined });
  });

  it("[boundary] does not throw on a non-object body (e.g. a string)", () => {
    expect(checkModeApplied("not json", "gate").ok).toBe(false);
  });
});
