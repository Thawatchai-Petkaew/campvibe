/**
 * CAM-369 — scripts/db-reset.mjs must never print a connection-string
 * secret to console/CI logs.
 *
 * Defect (retro finding, ledger row CAM-359/db-reset): the script masked
 * only userinfo (`url.replace(/:\/\/[^@]*@/, "://***@")`) before
 * `console.log`. A query-string secret (`?api_key=...`, `?password=...` —
 * Prisma Postgres URLs carry an `api_key` param) is NOT touched by that
 * mask and printed raw into console/CI logs.
 *
 * Fix: `describeUrlShape()` (ported from `e2e/regression/db-guard.ts`'s
 * helper of the same name/intent) prints scheme + hostname only.
 *
 * Two layers, per the ticket:
 *  1. Source-inspection — the vulnerable pattern is gone, and the
 *     hostname-only helper is what feeds the pre-reset console.log.
 *  2. Behavioural — importing the module's named exports and calling the
 *     helper directly with a URL carrying userinfo + path + query.
 *
 * `scripts/db-reset.mjs` is a plain .mjs script (not covered by the
 * `**\/*.test.ts` vitest include as a source file, but importable directly
 * since it is real ESM). Its top-level side effect (`main()`) is guarded
 * behind an `isMain` check so importing it for its named exports
 * (`describeUrlShape`, `main`) never runs the destructive reset flow or
 * calls `process.exit` as an import side effect.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("CAM-369 — source inspection", () => {
  const src = read("scripts/db-reset.mjs");

  it("must NOT contain the vulnerable userinfo-only mask pattern", () => {
    expect(src).not.toContain('replace(/:\\/\\/[^@]*@/, "://***@")');
    expect(src).not.toMatch(/\*\*\*@/);
  });

  it("must define a hostname-only describeUrlShape helper", () => {
    expect(src).toContain("export function describeUrlShape(");
  });

  it("the pre-reset console.log must be fed by describeUrlShape(url), not the raw/masked url", () => {
    const logLine = src
      .split("\n")
      .find((l) => l.includes("Resetting DB (drop + migrate deploy + seed)"));
    expect(logLine).toBeDefined();
    expect(logLine).toContain("describeUrlShape(url)");
    expect(logLine).not.toContain("${url}");
    expect(logLine).not.toContain("${masked}");
  });

  it("guard semantics (ALLOW_DB_RESET, looksProd) are unchanged", () => {
    expect(src).toContain('process.env.ALLOW_DB_RESET === "1"');
    expect(src).toContain("/prod/i.test(url)");
    expect(src).toContain('process.env.NODE_ENV === "production"');
    expect(src).toContain('process.env.VERCEL_ENV === "production"');
    expect(src).toContain(
      "npx prisma migrate reset --force --skip-generate"
    );
  });
});

describe("CAM-369 — behavioral: describeUrlShape()", () => {
  it("strips userinfo, path, and query — output is scheme://hostname only", async () => {
    const mod = await import("../scripts/db-reset.mjs");
    const out = mod.describeUrlShape(
      "postgresql://user:s3cret@db.example.com:5432/campvibe?schema=public&api_key=abcd1234"
    );
    expect(out).toBe("postgresql://db.example.com");
    expect(out).not.toContain("s3cret");
    expect(out).not.toContain("api_key");
    expect(out).not.toContain("campvibe");
    expect(out).not.toContain("@");
    expect(out).not.toContain("?");
  });

  it("strips IPv6 brackets from the hostname", async () => {
    const mod = await import("../scripts/db-reset.mjs");
    const out = mod.describeUrlShape("postgresql://user:pw@[::1]:5432/db");
    expect(out).toBe("postgresql://::1");
  });

  it("returns a fixed placeholder for an unparseable URL (never echoes the input)", async () => {
    const mod = await import("../scripts/db-reset.mjs");
    const out = mod.describeUrlShape("not-a-url-at-all ?api_key=leak");
    expect(out).toBe("(unparseable)");
    expect(out).not.toContain("leak");
  });
});
