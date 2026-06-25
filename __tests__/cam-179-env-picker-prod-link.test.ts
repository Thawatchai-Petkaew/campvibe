import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// Regression guard: CAM-179 — Production card link in EnvPickerPanel
//
// Bug: PROD_URL was initialised with `?? ""` (nullish coalescing).
// When NEXT_PUBLIC_PROD_URL is not set (the common case), PROD_URL
// collapsed to "", and the Production card href used the fallback
// `(PROD_URL || STAGING_URL) + ENV_PATH` — resolving to the staging
// URL.  The Production card opened Staging instead of Production.
//
// Fix:
//   1. PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://campvibe.vercel.app"
//      — uses `||` so both undefined AND "" fall through to the prod default.
//   2. Production card href = PROD_URL + ENV_PATH (no || STAGING_URL fallback).
//
// This test uses source-inspection (same harness as the rest of the
// status-map suite) because the Vitest environment is node-only (no jsdom).
// Source-inspection is the strongest feasible guard given this constraint.
//
// How each assertion maps to the bug / fix:
//
//   (1) PROD_URL must use `||` — catches a regression to `?? ""`.
//   (2) PROD_URL default must be the canonical prod URL — not staging.
//   (3) Production card href uses PROD_URL directly — no `|| STAGING_URL` fallback.
//   (4) Staging card href still references STAGING_URL — no regression to Staging card.
//   (5) ENV_PATH is still "" — both cards open the root (home) of their env.
// ============================================================

const overlaySrc = readFileSync(
  resolve(__dirname, "../app/status/map/campsite-overlays.tsx"),
  "utf8",
);

// Isolate the ENV Picker section (from the CAM-167 comment to EnvPickerPanel's
// end) to avoid matching unrelated uses of the same tokens elsewhere in the file.
const envPickerStart = overlaySrc.indexOf("// ── ENV Picker (CAM-167)");
const envPickerEnd   = overlaySrc.indexOf("// ── Status Board");
const envPickerSrc   = overlaySrc.slice(envPickerStart, envPickerEnd);

describe("[regression] CAM-179 — EnvPickerPanel Production card links to prod, not staging", () => {

  // ── (1) PROD_URL declaration uses `||` not `?? ""` ───────────────────────────
  //
  // `?? ""` lets an empty-string env var through → "" → old fallback to STAGING_URL.
  // `||` collapses both undefined and "" to the hard-coded prod default.
  //
  // On old code: the line was `?? ""` → FAIL.
  it("PROD_URL is initialised with || (not ?? \"\") so an unset env var never resolves to empty string", () => {
    expect(envPickerSrc).toContain(
      'const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://campvibe.vercel.app"',
    );
  });

  // ── (2) PROD_URL hard-coded default is the canonical prod URL ─────────────────
  //
  // Ensures the fallback is "campvibe.vercel.app", not "campvibe-staging.vercel.app".
  //
  // On old code: PROD_URL was "", which contained neither URL → FAIL.
  it("PROD_URL default is the canonical production URL (campvibe.vercel.app)", () => {
    expect(envPickerSrc).toContain("https://campvibe.vercel.app");
  });

  it("PROD_URL default is NOT the staging URL (campvibe-staging.vercel.app)", () => {
    // The staging URL appears legitimately as STAGING_URL's value.
    // What we guard here is that it does NOT appear on the PROD_URL line.
    const prodUrlLine = envPickerSrc
      .split("\n")
      .find((l) => l.includes("const PROD_URL"))!;
    expect(prodUrlLine).toBeDefined();
    expect(prodUrlLine).not.toContain("campvibe-staging");
  });

  // ── (3) Production card href uses PROD_URL directly — no || STAGING_URL ───────
  //
  // The old code had `(PROD_URL || STAGING_URL) + ENV_PATH`, which silently
  // fell back to staging when PROD_URL was "".
  // After the fix, the href is simply `PROD_URL + ENV_PATH`.
  //
  // On old code: the fallback expression was present → the first assertion FAILS,
  // and the second assertion (no fallback) also FAILS.
  it("Production card href is PROD_URL + ENV_PATH (no || STAGING_URL fallback)", () => {
    expect(envPickerSrc).toContain("href={PROD_URL + ENV_PATH}");
  });

  it("Production card href does NOT have the || STAGING_URL fallback expression", () => {
    expect(envPickerSrc).not.toContain("(PROD_URL || STAGING_URL)");
  });

  // ── (4) Staging card href still references STAGING_URL (no regression) ────────
  //
  // The Staging card must remain unchanged — still using STAGING_URL + ENV_PATH.
  it("Staging card href still uses STAGING_URL + ENV_PATH", () => {
    expect(envPickerSrc).toContain("href={STAGING_URL + ENV_PATH}");
  });

  // ── (5) ENV_PATH is still "" — both cards open the root (home) ───────────────
  //
  // ENV_PATH must remain an empty string so neither card appends a sub-path.
  it('ENV_PATH is still "" (both cards open the home page of their env)', () => {
    expect(envPickerSrc).toContain('const ENV_PATH = ""');
  });
});
