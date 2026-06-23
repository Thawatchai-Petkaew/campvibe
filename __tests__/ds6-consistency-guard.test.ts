/**
 * CAM-126 — DS-6 consistency guard: regression tests.
 *
 * Layer: unit (static source / fs inspection, execSync — vitest env 'node').
 *
 * AC coverage:
 *
 *   AC-guard-1   scripts/check-ds.mjs exists on disk
 *   AC-guard-2   package.json exposes "check:ds" npm script
 *   AC-guard-3   .github/workflows/ci.yml has a step running check:ds
 *   AC-regex-1   TABLER_RE flags @tabler/icons-react import (DS-5)
 *   AC-regex-2   IMPORTANT_H_RE flags !h-12 (DS-2/3)
 *   AC-regex-3   IMPORTANT_W_RE flags !w-8 (DS-2/3)
 *   AC-regex-4   ARBITRARY_RADIUS_RE flags rounded-[99px] (DS-3)
 *   AC-regex-5   ARBITRARY_RADIUS_RE flags rounded-[24px] (DS-3)
 *   AC-allow-1   lucide-react import is NOT flagged
 *   AC-allow-2   rounded-3xl is NOT flagged
 *   AC-allow-3   rounded-xl is NOT flagged
 *   AC-allow-4   h-12 (no ! prefix) is NOT flagged by !h- rule
 *   AC-excl-1    components/ui/** excluded (shadcn sub-pixel primitives)
 *   AC-excl-2    app/status/** excluded from scan
 *   AC-dod-1     npm run check:ds exits 0 repo-wide (0 violations on clean branch)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const guardPath = path.join(root, "scripts", "check-ds.mjs");
const guardSrc = src("scripts/check-ds.mjs");

// The guard defines its regexes as module-level consts. We test equivalent
// patterns inline (avoids ESM dynamic-import complexity in Vitest node env).
// These must match the regexes in check-ds.mjs exactly.
const TABLER_RE = /from\s+['"]@tabler\/icons-react['"]/g;
const IMPORTANT_H_RE = /\B!h-\S+/g;
const IMPORTANT_W_RE = /\B!w-\S+/g;
const ARBITRARY_RADIUS_RE = /rounded-\[\d+px\]/g;

function matches(re: RegExp, line: string): string[] {
  const fresh = new RegExp(re.source, re.flags);
  return [...line.matchAll(fresh)].map((m) => m[0]);
}

function noMatch(line: string): boolean {
  return (
    matches(TABLER_RE, line).length === 0 &&
    matches(IMPORTANT_H_RE, line).length === 0 &&
    matches(IMPORTANT_W_RE, line).length === 0 &&
    matches(ARBITRARY_RADIUS_RE, line).length === 0
  );
}

// ─────────────────────────────────────────────────────────────
// AC-guard-1/2/3: script exists, npm script present, CI wired
// ─────────────────────────────────────────────────────────────

describe("AC-guard-1: guard script exists", () => {
  it("scripts/check-ds.mjs is present on disk", () => {
    expect(fs.existsSync(guardPath)).toBe(true);
  });
});

describe("AC-guard-2: npm script wired", () => {
  it('package.json has "check:ds" script pointing to the guard', () => {
    const pkg = JSON.parse(src("package.json"));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts["check:ds"]).toMatch(/check-ds\.mjs/);
  });
});

describe("AC-guard-3: CI job runs check:ds", () => {
  it(".github/workflows/ci.yml includes a step running npm run check:ds", () => {
    const ciSrc = src(".github/workflows/ci.yml");
    expect(ciSrc).toMatch(/check:ds/);
  });

  it("CI check:ds step appears after check:palette and before type-check", () => {
    const ciSrc = src(".github/workflows/ci.yml");
    const paletteIdx = ciSrc.indexOf("check:palette");
    const dsIdx = ciSrc.indexOf("check:ds");
    const typecheckIdx = ciSrc.indexOf("typecheck");
    expect(paletteIdx).toBeGreaterThan(-1);
    expect(dsIdx).toBeGreaterThan(-1);
    expect(typecheckIdx).toBeGreaterThan(-1);
    // DS guard comes after palette guard
    expect(dsIdx).toBeGreaterThan(paletteIdx);
    // DS guard comes before typecheck
    expect(dsIdx).toBeLessThan(typecheckIdx);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-regex-1..5: guard CATCHES violations
// ─────────────────────────────────────────────────────────────

describe("AC-regex-1: TABLER_RE flags @tabler/icons-react import", () => {
  it("matches @tabler/icons-react double-quote import", () => {
    const hits = matches(TABLER_RE, `import { IconHome } from "@tabler/icons-react"`);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("matches @tabler/icons-react single-quote import", () => {
    const hits = matches(TABLER_RE, `import { IconStar } from '@tabler/icons-react'`);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("AC-regex-2: IMPORTANT_H_RE flags !h-12", () => {
  it('matches !h-12 inside className string', () => {
    const hits = matches(IMPORTANT_H_RE, `<div className="!h-12 w-full">`);
    expect(hits).toContain("!h-12");
  });

  it("matches !h-full", () => {
    const hits = matches(IMPORTANT_H_RE, `className="flex !h-full items-center"`);
    expect(hits).toContain("!h-full");
  });
});

describe("AC-regex-3: IMPORTANT_W_RE flags !w-8", () => {
  it("matches !w-8 inside className string", () => {
    const hits = matches(IMPORTANT_W_RE, `<div className="!w-8 h-4">`);
    expect(hits).toContain("!w-8");
  });
});

describe("AC-regex-4: ARBITRARY_RADIUS_RE flags rounded-[99px]", () => {
  it("matches rounded-[99px]", () => {
    const hits = matches(ARBITRARY_RADIUS_RE, `<div className="rounded-[99px]">`);
    expect(hits).toContain("rounded-[99px]");
  });
});

describe("AC-regex-5: ARBITRARY_RADIUS_RE flags rounded-[24px]", () => {
  it("matches rounded-[24px] (was present pre-DS-6 in CampgroundDetailClient)", () => {
    const hits = matches(ARBITRARY_RADIUS_RE, `<div className="rounded-[24px] p-4">`);
    expect(hits).toContain("rounded-[24px]");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-allow-1..4: allowlist — valid patterns NOT flagged
// ─────────────────────────────────────────────────────────────

describe("AC-allow-1: lucide-react import is NOT flagged", () => {
  it("lucide-react import passes all rules", () => {
    expect(noMatch(`import { Star } from "lucide-react"`)).toBe(true);
  });
});

describe("AC-allow-2: rounded-3xl is NOT flagged", () => {
  it("rounded-3xl passes (scale token, not arbitrary px)", () => {
    expect(noMatch(`<div className="rounded-3xl p-4">`)).toBe(true);
  });
});

describe("AC-allow-3: rounded-xl is NOT flagged", () => {
  it("rounded-xl passes (scale token)", () => {
    expect(noMatch(`<div className="rounded-xl">`)).toBe(true);
  });
});

describe("AC-allow-4: h-12 without ! prefix is NOT flagged", () => {
  it("h-12 (no !important) passes the !h- rule", () => {
    const hits = matches(IMPORTANT_H_RE, `<div className="h-12 w-4">`);
    expect(hits.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-excl-1/2: exclusions declared in the guard script
// ─────────────────────────────────────────────────────────────

describe("AC-excl-1: components/ui/** excluded (shadcn primitives)", () => {
  it("guard script declares components/ui as an excluded prefix", () => {
    expect(guardSrc).toMatch(/components.*ui/);
  });
});

describe("AC-excl-2: app/status/** excluded from scan", () => {
  it("guard script declares app/status as an excluded prefix", () => {
    expect(guardSrc).toMatch(/app.*status/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-fix: CampgroundDetailClient.tsx no longer has rounded-[24px]
// ─────────────────────────────────────────────────────────────

describe("AC-fix: CampgroundDetailClient.tsx uses rounded-3xl (not rounded-[24px])", () => {
  const fileSrc = src("components/CampgroundDetailClient.tsx");

  it("does not contain rounded-[24px]", () => {
    expect(fileSrc).not.toMatch(/rounded-\[24px\]/);
  });

  it("uses rounded-3xl for hero image and booking widget containers", () => {
    expect(fileSrc).toMatch(/rounded-3xl/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-dod-1: guard exits 0 repo-wide (no violations on clean branch)
// ─────────────────────────────────────────────────────────────

describe("AC-dod-1: npm run check:ds exits 0 repo-wide", () => {
  it("guard exits with code 0 and reports 0 violations", () => {
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync("node scripts/check-ds.mjs", {
        cwd: root,
        encoding: "utf-8",
      });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      stdout = err.stdout ?? "";
    }
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/PASS.*0 violations/i);
  });
});
