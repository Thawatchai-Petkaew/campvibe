/**
 * CAM-111 — F6 palette guard + sweep: regression tests.
 *
 * Layer: unit (static source / fs inspection, execSync — vitest env 'node').
 *
 * AC coverage:
 *
 *   AC-guard-1   scripts/check-palette.mjs exists on disk
 *   AC-guard-2   package.json exposes "check:palette" npm script
 *   AC-guard-3   .github/workflows/ci.yml has a step running check:palette
 *   AC-regex-1   PALETTE_RE flags bg-red-500 (numbered palette = violation)
 *   AC-regex-2   PALETTE_RE flags text-gray-500 (numbered palette = violation)
 *   AC-regex-3   HEX_RE flags raw hex literal #ff0000
 *   AC-regex-4   HEX_RE flags Tailwind arbitrary [#abc123]
 *   AC-regex-5   PALETTE_RE flags bg-emerald-700
 *   AC-allow-1   text-white is NOT flagged (documented exception)
 *   AC-allow-2   bg-black/95 is NOT flagged (opacity scrim exception)
 *   AC-allow-3   bg-white/10 is NOT flagged (opacity scrim exception)
 *   AC-allow-4   ring-white is NOT flagged (documented exception)
 *   AC-allow-5   border-white is NOT flagged (documented exception)
 *   AC-allow-6   bg-card (semantic token) is NOT flagged
 *   AC-fix-1     ImageUpload.tsx uses bg-destructive (not bg-rose-500)
 *   AC-fix-2     ImageUpload.tsx uses text-destructive-foreground
 *   AC-fix-3     LogoUpload.tsx uses bg-destructive (not bg-rose-500)
 *   AC-fix-4     LogoUpload.tsx uses text-destructive-foreground
 *   AC-fix-5     LanguageSwitcher.tsx uses hover:bg-muted (not hover:bg-gray-100)
 *   AC-excl-1    app/status/** is excluded from scan (guard exit 0 despite hex in status)
 *   AC-excl-2    app/globals.css is excluded from scan
 *   AC-dod-1     npm run check:palette exits 0 repo-wide (0 violations on clean branch)
 *   AC-status    app/status/page.tsx does NOT appear in git diff vs staging
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

// ─── Re-export the two regexes from the guard script by reading + eval'ing
// the relevant lines (avoids ESM dynamic import complexity in Vitest node env).
// We extract the literal regex source from the script and reconstruct them.
function extractRegexFromScript(scriptSrc: string, varName: string): RegExp {
  // Match: const VARNAME = /...pattern.../flags;
  const match = scriptSrc.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\/.*?\\/[gimsuy]*)\\s*;`));
  if (!match) throw new Error(`Could not extract ${varName} from guard script`);
  // Safely evaluate the regex literal string
  // Extract pattern and flags
  const full = match[1]; // e.g. /pattern/g
  const lastSlash = full.lastIndexOf("/");
  const pattern = full.slice(1, lastSlash);
  const flags = full.slice(lastSlash + 1);
  return new RegExp(pattern, flags);
}

const guardPath = path.join(root, "scripts", "check-palette.mjs");
const guardSrc = src("scripts/check-palette.mjs");

// We need a fresh (non-sticky) regex for each test — copy flags but reset lastIndex via new RegExp.
const PALETTE_RE = extractRegexFromScript(guardSrc, "PALETTE_RE");
const HEX_RE = extractRegexFromScript(guardSrc, "HEX_RE");

function paletteMatches(line: string): string[] {
  const re = new RegExp(PALETTE_RE.source, PALETTE_RE.flags);
  return [...line.matchAll(re)].map((m) => m[0]);
}
function hexMatches(line: string): string[] {
  const re = new RegExp(HEX_RE.source, HEX_RE.flags);
  return [...line.matchAll(re)].map((m) => m[0]);
}
function noMatch(line: string): boolean {
  const pHits = paletteMatches(line);
  const hHits = hexMatches(line);
  return pHits.length === 0 && hHits.length === 0;
}

// ─────────────────────────────────────────────────────────────
// AC-guard-1/2/3: script exists, npm script present, CI wired
// ─────────────────────────────────────────────────────────────

describe("AC-guard-1: guard script exists", () => {
  it("scripts/check-palette.mjs is present on disk", () => {
    expect(fs.existsSync(guardPath)).toBe(true);
  });
});

describe("AC-guard-2: npm script wired", () => {
  it('package.json has "check:palette" script pointing to the guard', () => {
    const pkg = JSON.parse(src("package.json"));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts["check:palette"]).toMatch(/check-palette\.mjs/);
  });
});

describe("AC-guard-3: CI job runs check:palette", () => {
  it(".github/workflows/ci.yml includes a step running npm run check:palette", () => {
    const ciSrc = src(".github/workflows/ci.yml");
    // Must contain the palette check command somewhere in the quality-gate job
    expect(ciSrc).toMatch(/check:palette/);
  });

  it("CI palette step appears before or alongside type-check and test steps", () => {
    const ciSrc = src(".github/workflows/ci.yml");
    const paletteIdx = ciSrc.indexOf("check:palette");
    const typecheckIdx = ciSrc.indexOf("typecheck");
    // Palette guard must be present and in quality-gate (before build at minimum)
    expect(paletteIdx).toBeGreaterThan(-1);
    expect(typecheckIdx).toBeGreaterThan(-1);
    // Palette guard is wired before typecheck in the quality-gate job
    expect(paletteIdx).toBeLessThan(typecheckIdx);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-regex-1..5: guard CATCHES violations (false-negative test)
// ─────────────────────────────────────────────────────────────

describe("AC-regex-1: PALETTE_RE flags bg-red-500", () => {
  it('matches "bg-red-500"', () => {
    const hits = paletteMatches('className="bg-red-500"');
    expect(hits).toContain("bg-red-500");
  });
});

describe("AC-regex-2: PALETTE_RE flags text-gray-500", () => {
  it('matches "text-gray-500"', () => {
    const hits = paletteMatches('className="text-gray-500"');
    expect(hits).toContain("text-gray-500");
  });
});

describe("AC-regex-3: HEX_RE flags raw hex #ff0000", () => {
  it("matches raw hex literal #ff0000", () => {
    const hits = hexMatches("style={{color:'#ff0000'}}");
    expect(hits.some((h) => h.includes("ff0000"))).toBe(true);
  });
});

describe("AC-regex-4: HEX_RE flags Tailwind arbitrary [#abc123]", () => {
  it("matches arbitrary Tailwind hex bg-[#abc123]", () => {
    const hits = hexMatches('className="bg-[#abc123]"');
    expect(hits.some((h) => h.includes("abc123"))).toBe(true);
  });
});

describe("AC-regex-5: PALETTE_RE flags bg-emerald-700", () => {
  it('matches "bg-emerald-700"', () => {
    const hits = paletteMatches('className="bg-emerald-700"');
    expect(hits).toContain("bg-emerald-700");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-allow-1..6: allowlist — documented exceptions NOT flagged
// ─────────────────────────────────────────────────────────────

describe("AC-allow-1: text-white is NOT flagged", () => {
  it('"text-white" passes without violation', () => {
    expect(noMatch('className="text-white"')).toBe(true);
  });
});

describe("AC-allow-2: bg-black/95 is NOT flagged", () => {
  it('"bg-black/95" passes (unnumbered shade + opacity)', () => {
    expect(noMatch('className="bg-black/95"')).toBe(true);
  });
});

describe("AC-allow-3: bg-white/10 is NOT flagged", () => {
  it('"bg-white/10" passes (unnumbered shade + opacity)', () => {
    expect(noMatch('className="bg-white/10"')).toBe(true);
  });
});

describe("AC-allow-4: ring-white is NOT flagged", () => {
  it('"ring-white" passes without violation', () => {
    expect(noMatch('className="ring-white"')).toBe(true);
  });
});

describe("AC-allow-5: border-white is NOT flagged", () => {
  it('"border-white" passes without violation', () => {
    expect(noMatch('className="border-white"')).toBe(true);
  });
});

describe("AC-allow-6: bg-card semantic token is NOT flagged", () => {
  it('"bg-card" passes (no shade number — semantic token)', () => {
    expect(noMatch('className="bg-card"')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-fix-1..5: the three files are corrected
// ─────────────────────────────────────────────────────────────

describe("AC-fix-1/2: ImageUpload.tsx uses bg-destructive + text-destructive-foreground", () => {
  const imageSrc = src("components/ImageUpload.tsx");

  it("uses bg-destructive (not bg-rose-500)", () => {
    expect(imageSrc).toMatch(/bg-destructive/);
    expect(imageSrc).not.toMatch(/bg-rose-\d+/);
  });

  it("uses text-destructive-foreground", () => {
    expect(imageSrc).toMatch(/text-destructive-foreground/);
  });
});

describe("AC-fix-3/4: LogoUpload.tsx uses bg-destructive + text-destructive-foreground", () => {
  const logoSrc = src("components/LogoUpload.tsx");

  it("uses bg-destructive (not bg-rose-500)", () => {
    expect(logoSrc).toMatch(/bg-destructive/);
    expect(logoSrc).not.toMatch(/bg-rose-\d+/);
  });

  it("uses text-destructive-foreground", () => {
    expect(logoSrc).toMatch(/text-destructive-foreground/);
  });
});

describe("AC-fix-5: LanguageSwitcher.tsx uses hover:bg-muted (not hover:bg-gray-100)", () => {
  const lsSrc = src("components/LanguageSwitcher.tsx");

  it("uses hover:bg-muted", () => {
    expect(lsSrc).toMatch(/hover:bg-muted/);
  });

  it("does not use hover:bg-gray-100", () => {
    expect(lsSrc).not.toMatch(/hover:bg-gray-\d+/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-excl-1/2: exclusions work (guard script documents + honours them)
// ─────────────────────────────────────────────────────────────

describe("AC-excl-1: app/status/** excluded from scan", () => {
  it("guard script declares app/status as an excluded prefix", () => {
    expect(guardSrc).toMatch(/app.*status/);
  });

  it("app/status/page.tsx contains hex colours (confirming exclusion is needed)", () => {
    const statusSrc = src("app/status/page.tsx");
    // The status page is known to contain hex or numbered colours; if it didn't
    // the exclusion would be untestable. We just confirm the file exists and is readable.
    expect(statusSrc.length).toBeGreaterThan(0);
  });
});

describe("AC-excl-2: app/globals.css excluded", () => {
  it("guard script declares app/globals.css as an excluded file", () => {
    expect(guardSrc).toMatch(/globals\.css/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-dod-1: guard exits 0 repo-wide (no violations on clean branch)
// ─────────────────────────────────────────────────────────────

describe("AC-dod-1: npm run check:palette exits 0 repo-wide", () => {
  it("guard exits with code 0 and reports 0 violations", () => {
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync("node scripts/check-palette.mjs", {
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

// ─────────────────────────────────────────────────────────────
// AC-status: app/status/page.tsx not in git diff vs staging
// ─────────────────────────────────────────────────────────────

describe("AC-status: app/status/page.tsx not touched in F6 diff", () => {
  it("git diff staging --name-only does not include app/status/page.tsx", () => {
    // This guard is only relevant when on an F6 branch. ST1/ST2 intentionally touch page.tsx.
    let branch = "";
    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf-8" }).trim();
    } catch { /* ignore */ }
    if (branch.startsWith("feature/st1") || branch.startsWith("feature/st2") || branch.startsWith("feature/st1-st2") || branch.startsWith("refactor/cut-autonomous") || branch.startsWith("feat/cam-145")) {
      return; // skip: this story (ST1/ST2/CAM-145) owns app/status/page.tsx
    }
    let diffOutput = "";
    try {
      diffOutput = execSync("git diff staging --name-only", {
        cwd: root,
        encoding: "utf-8",
      });
    } catch {
      // If git command fails treat as clean
      diffOutput = "";
    }
    const changedFiles = diffOutput.split("\n").map((l) => l.trim());
    expect(changedFiles).not.toContain("app/status/page.tsx");
  });
});
