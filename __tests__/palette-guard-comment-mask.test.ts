/**
 * Tooling regression tests — check-palette.mjs comment-masking fix.
 *
 * Layer: unit — extracts the REAL maskComments() function and the REAL
 * PALETTE_RE/HEX_RE regexes straight out of scripts/check-palette.mjs (same
 * source-extraction technique __tests__/f6-palette-guard.test.ts already
 * uses for the regexes), then composes them into a scanSource() harness
 * that mirrors scanFile()'s exact per-line algorithm (PALETTE_RE against the
 * raw line, HEX_RE against the comment-masked line). Deliberately does NOT
 * write fixture files into the real app/**\/components/** tree and run the
 * CLI end-to-end — a repo-wide guard test (e.g. ds6-consistency-guard's own
 * check-ds.mjs repo scan) runs in a parallel vitest worker against the SAME
 * shared filesystem tree, so a temp fixture would race another guard's
 * repo-wide scan and produce a flaky cross-file failure. Operating on an
 * in-memory string instead exercises the identical real logic with zero
 * filesystem race surface. The literal CLI (`npm run check:palette`) was
 * additionally hand-verified once against real fixture files as part of
 * self-verify (see the PR body for the transcript + repo-wide before/after
 * counts).
 *
 * Defect: a PR/issue reference like "#719" written inside a JSDoc
 * continuation line (`* (#719, not yet merged)`) was matched by HEX_RE as a
 * 3-digit hex colour, failing the blocking check:palette CI gate on prose
 * that was never a colour literal. Root cause: HEX_RE was applied to every
 * line with no comment awareness, contradicting the guard's own stated
 * intent ("raw hex literals in className / style strings").
 *
 * Fix: scanFile() now runs HEX_RE against a comment-masked copy of each
 * line (maskComments) — comment content is replaced with spaces (newlines
 * preserved) before the hex regex runs. PALETTE_RE is untouched (still runs
 * against the raw line), per the fix's scope.
 *
 * Coverage:
 *   AC-mask-1   line comment (// ...) is fully masked
 *   AC-mask-2   block comment (/* ... *\/), including JSDoc continuation
 *               lines starting with "*", is fully masked
 *   AC-mask-3   trailing "// ..." comment after real code masks only the
 *               comment tail — the code part is still scanned
 *   AC-mask-4   a "//" inside a string/template literal (e.g. a URL) is
 *               NOT treated as a comment start — real code after it stays
 *               scannable, so masking cannot blind a real violation
 *   AC-mask-5   multi-line block comment spans correctly (state carries
 *               across lines, not reset per line)
 *   AC-scan-1   scanSource() reports ZERO violations for the exact
 *               "* (#719, not yet merged)" JSDoc line from the bug report
 *   AC-scan-2   scanSource() STILL reports className="bg-[#aabbcc]"
 *   AC-scan-3   scanSource() STILL reports style={{ color: '#ff0000' }}
 *   AC-scan-4   scanSource() reports the code half of a line that also
 *               carries a trailing "// #719" comment, and does NOT report
 *               a separate match for the comment's "#719"
 *   AC-repo-1   read-only whole-repo check:palette run is unaffected
 *               (0 violations, unchanged) — no fixture writes, safe to run
 *               alongside other guard tests
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// ─────────────────────────────────────────────────────────────
// Extract maskComments() + the two regexes straight from the guard script
// (same technique __tests__/f6-palette-guard.test.ts uses for the regexes)
// so this test exercises the REAL implementation, not a re-implementation.
// ─────────────────────────────────────────────────────────────

function extractFunctionSource(scriptSrc: string, fnName: string): string {
  const startMarker = `function ${fnName}(src) {`;
  const startIdx = scriptSrc.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Could not find function ${fnName} in guard script`);
  let depth = 0;
  let i = startIdx + startMarker.length - 1; // position of the opening '{'
  let end = -1;
  for (; i < scriptSrc.length; i++) {
    const ch = scriptSrc[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`Could not find end of function ${fnName}`);
  return scriptSrc.slice(startIdx, end + 1);
}

function extractRegexFromScript(scriptSrc: string, varName: string): RegExp {
  const match = scriptSrc.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\/.*?\\/[gimsuy]*)\\s*;`));
  if (!match) throw new Error(`Could not extract ${varName} from guard script`);
  const full = match[1];
  const lastSlash = full.lastIndexOf("/");
  return new RegExp(full.slice(1, lastSlash), full.slice(lastSlash + 1));
}

const guardSrc = src("scripts/check-palette.mjs");
const maskCommentsSrc = extractFunctionSource(guardSrc, "maskComments");
const maskComments: (s: string) => string = new Function(`${maskCommentsSrc}\nreturn maskComments;`)();
const PALETTE_RE = extractRegexFromScript(guardSrc, "PALETTE_RE");
const HEX_RE = extractRegexFromScript(guardSrc, "HEX_RE");

/**
 * Mirrors scanFile()'s exact per-line algorithm using the REAL extracted
 * pieces: PALETTE_RE against the raw line (untouched by this fix), HEX_RE
 * against the comment-masked line (the fix). Operates on an in-memory
 * string — no filesystem writes, so no race with any other guard test's
 * repo-wide scan.
 */
function scanSource(text: string): Array<{ line: number; match: string; snippet: string }> {
  const lines = text.split("\n");
  const maskedLines = maskComments(text).split("\n");
  const violations: Array<{ line: number; match: string; snippet: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const maskedLine = maskedLines[i] ?? line;

    const palRe = new RegExp(PALETTE_RE.source, PALETTE_RE.flags);
    for (const m of line.matchAll(palRe)) {
      violations.push({ line: i + 1, match: m[0], snippet: line.trim() });
    }

    const hexRe = new RegExp(HEX_RE.source, HEX_RE.flags);
    for (const m of maskedLine.matchAll(hexRe)) {
      violations.push({ line: i + 1, match: m[0], snippet: line.trim() });
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────
// AC-mask-1..5 — unit tests against the extracted real maskComments()
// ─────────────────────────────────────────────────────────────

describe("AC-mask-1: line comment (//) is fully masked", () => {
  it('masks "#719" inside a trailing-only // comment line', () => {
    const line = "// see PR #719 for context";
    const masked = maskComments(line);
    expect(masked).not.toContain("#719");
    expect(masked.length).toBe(line.length); // positions preserved
  });
});

describe("AC-mask-2: block comment incl. JSDoc continuation is fully masked", () => {
  it('masks the exact reported line: "* (#719, not yet merged)"', () => {
    const block = [
      "/**",
      " * this file deliberately does NOT import it.",
      " * (#719, not yet merged) - see the linked PR.",
      " */",
      "",
    ].join("\n");
    const masked = maskComments(block);
    expect(masked).not.toContain("#719");
  });

  it("masks a single-line block comment /* #abc123 */ on one line", () => {
    const line = "const x = 1; /* ticket #abc123 */";
    const masked = maskComments(line);
    expect(masked).not.toContain("#abc123");
    expect(masked).toContain("const x = 1;"); // code before the comment stays
  });
});

describe("AC-mask-3: trailing // comment masks only the tail", () => {
  it("keeps the real hex code scannable while masking the comment tail", () => {
    const line = `const bg = "#ff0000"; // see PR #719 for context`;
    const masked = maskComments(line);
    expect(masked).toContain("#ff0000"); // real code untouched
    expect(masked).not.toContain("#719"); // comment tail masked
  });
});

describe("AC-mask-4: // inside a string is NOT treated as a comment start", () => {
  it('does not blind code that follows a URL containing "//"', () => {
    const line = `const url = "https://example.com/#abc123"; const bg = "#ff0000";`;
    const masked = maskComments(line);
    // Nothing after the URL's "//" is masked — both hex-looking tokens survive.
    expect(masked).toContain("#ff0000");
    expect(masked).toContain("https://example.com/#abc123");
  });
});

describe("AC-mask-5: multi-line block comment spans correctly", () => {
  it("masks every line of a multi-line block comment, state carried across lines", () => {
    const block = ["/*", " * ticket #12345 tracks this", " * follow-up #6789", " */", "const y = 2;"].join(
      "\n"
    );
    const masked = maskComments(block);
    expect(masked).not.toContain("#12345");
    expect(masked).not.toContain("#6789");
    expect(masked).toContain("const y = 2;");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-scan-1..4 — behavioral: real scanFile() algorithm (extracted regexes +
// extracted maskComments composed exactly as scanFile does), in-memory only
// ─────────────────────────────────────────────────────────────

describe("AC-scan-1: scanSource reports ZERO violations for the exact reported #719 JSDoc comment", () => {
  it("a file whose only '#719'-shaped token is prose in a comment is clean", () => {
    const fileText = [
      "/**",
      " * booking-flow — deliberately does NOT import the shared client.",
      " * (#719, not yet merged) - this file deliberately does NOT import it.",
      " */",
      "export const bookingFlowPlaceholder = true;",
      "",
    ].join("\n");
    expect(scanSource(fileText)).toHaveLength(0);
  });
});

describe("AC-scan-2: scanSource STILL reports className bg-[#aabbcc]", () => {
  it("reports the arbitrary Tailwind hex violation", () => {
    const fileText = [
      "export function Bad() {",
      '  return <div className="bg-[#aabbcc]">hi</div>;',
      "}",
      "",
    ].join("\n");
    const violations = scanSource(fileText);
    expect(violations.some((v) => v.match === "[#aabbcc]")).toBe(true);
  });
});

describe("AC-scan-3: scanSource STILL reports style={{ color: '#ff0000' }}", () => {
  it("reports the raw hex style violation", () => {
    const fileText = [
      "export function Bad() {",
      "  return <div style={{ color: '#ff0000' }}>hi</div>;",
      "}",
      "",
    ].join("\n");
    const violations = scanSource(fileText);
    expect(violations.some((v) => v.match === "#ff0000")).toBe(true);
  });
});

describe("AC-scan-4: real code sharing a line with a trailing '// #719' comment is not blinded", () => {
  it("reports the code half and does not separately report the comment's #719", () => {
    const fileText = [`export const bg = "#ff0000"; // see PR #719 for context`, ""].join("\n");
    const violations = scanSource(fileText);
    expect(violations.some((v) => v.match === "#ff0000")).toBe(true);
    expect(violations.some((v) => v.match.includes("719"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-repo-1 — read-only whole-repo scan is unaffected (no fixture writes;
// safe to run concurrently with any other guard test's own repo-wide scan)
// ─────────────────────────────────────────────────────────────

describe("AC-repo-1: whole-repo check:palette is unaffected by the fix", () => {
  it("exits 0 with 0 violations repo-wide (unchanged from before the fix)", () => {
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync("node scripts/check-palette.mjs", { cwd: root, encoding: "utf-8" });
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string };
      exitCode = e.status ?? 1;
      stdout = e.stdout ?? "";
    }
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/PASS.*0 violations/i);
  });
});

// ─────────────────────────────────────────────────────────────
// Guard doc-comment intent now matches behavior
// ─────────────────────────────────────────────────────────────

describe("guard doc comment states the comment-aware intent", () => {
  it("the file header documents that comments are ignored by the hex check", () => {
    expect(guardSrc).toMatch(/ignores comment content/i);
  });

  it("maskComments is present and used by scanFile", () => {
    expect(guardSrc).toMatch(/function maskComments/);
    expect(guardSrc).toMatch(/maskComments\(src\)/);
  });
});
