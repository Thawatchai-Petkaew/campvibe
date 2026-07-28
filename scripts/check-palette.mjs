#!/usr/bin/env node
/**
 * check-palette.mjs — F6 palette regression guard (CAM-111)
 *
 * Scans app/** and components/** (.tsx/.ts) for hardcoded Tailwind numbered
 * palette classes and raw hex colour literals in SHIPPING CODE (className /
 * style props / template literals) that must be replaced with semantic
 * design tokens. The hex check ignores comment content — a `//` line
 * comment, a `/* ... *\/` block comment (including JSDoc continuation lines
 * starting with `*`), and the comment tail of a trailing `// ...` — so a
 * PR/issue reference like "#719" in prose can never be mistaken for a raw
 * hex colour (see maskComments below). The numbered-palette check is
 * unaffected by this (Tailwind class names never appear in prose comments
 * worth ignoring, and this guard is intentionally scoped to the hex path).
 *
 * Exit 0  → clean (no violations)
 * Exit 1  → violations found (list printed to stdout)
 *
 * Usage:
 *   node scripts/check-palette.mjs
 *   npm run check:palette
 *
 * Allowed (NOT flagged — documented exceptions from F2/F3):
 *   - text-white, border-white, ring-white, bg-white/<opacity>,
 *     bg-black/<opacity>  (over-image scrims / over-primary-fill)
 *   Only NUMBERED palette (e.g. bg-gray-100) and raw hex (#rrggbb) are violations.
 *
 * Exclusions:
 *   - app/globals.css             (token source — palette refs are intentional)
 *   - app/status/**               (intentionally pinned light UI, out of scope)
 *   - scripts/**                  (this file + peers)
 *   - __tests__/**                (test fixtures)
 *   - node_modules, .next         (generated)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// ── Patterns ──────────────────────────────────────────────────────────────────

/**
 * Numbered Tailwind palette: utility-(color)-(shade)
 * Covers ALL Tailwind utility prefixes that carry a colour argument.
 * Shade must be numeric (50–950) to distinguish from semantic tokens like
 * "bg-primary" or "text-foreground".
 */
const PALETTE_RE =
  /\b(bg|text|border|ring|fill|stroke|from|via|to|divide|placeholder|caret|accent|decoration|outline|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b/g;

/**
 * Raw hex literals in className / style strings / template literals.
 * Matches #rgb, #rrggbb, #rgba, #rrggbbaa etc.
 * Also matches Tailwind arbitrary [#hex] syntax.
 *
 * Applied to a COMMENT-MASKED copy of each line (see maskComments below) so a
 * PR/issue reference like "#719" written in prose (// comment, /* block *\/,
 * or a JSDoc continuation line) can never be mistaken for a hex colour.
 * Code on the same line as a trailing "// ..." comment is still scanned —
 * only the comment tail is masked.
 */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b|\[#[0-9a-fA-F]{3,8}\]/g;

// ── Exclusion helpers ─────────────────────────────────────────────────────────

/** Absolute path prefixes / segments to skip entirely. */
const EXCLUDE_PREFIXES = [
  join(ROOT, "node_modules"),
  join(ROOT, ".next"),
  join(ROOT, "scripts"),
  join(ROOT, "__tests__"),
  join(ROOT, "app", "status"),
  // brand-asset SVG marks (Google/etc.) use their own brand colors — not design tokens (AUTH-G1)
  // Scoped ONLY to components/icons/ — do not broaden this exclusion.
  join(ROOT, "components", "icons"),
];

/** Individual files excluded by absolute path. */
const EXCLUDE_FILES = new Set([join(ROOT, "app", "globals.css")]);

/** Returns true when the path should be skipped. */
function isExcluded(absPath) {
  if (EXCLUDE_FILES.has(absPath)) return true;
  return EXCLUDE_PREFIXES.some((p) => absPath.startsWith(p + "/") || absPath === p);
}

// ── File walker ───────────────────────────────────────────────────────────────

function walkDir(dir, exts, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    if (isExcluded(abs)) continue;
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(abs, exts, results);
    } else if (exts.some((e) => abs.endsWith(e))) {
      results.push(abs);
    }
  }
  return results;
}

// ── Comment masking (hex-check only) ──────────────────────────────────────────

/**
 * Returns a copy of `src` with every comment's CONTENT replaced by spaces
 * (newlines preserved, so line numbers and column positions line up exactly
 * with the original). String/template-literal content is left untouched so
 * a real hex literal inside a className/style string is never masked.
 *
 * Handles:
 *   - a `//` line comment (rest of the line, up to the next newline)
 *   - a `/* ... *\/` block comment, including JSDoc continuation lines that
 *     start with `*` (the whole block spans this function's char-by-char
 *     state, not per-line, so multi-line blocks are masked correctly)
 *   - a trailing `// ...` after real code on the same line (only the
 *     comment tail is masked; the code before it is left scannable)
 *
 * Deliberately does NOT treat "//" inside a string/template literal (e.g.
 * `"https://example.com/#abc123"`) as a comment start — string state is
 * tracked separately so a URL's "//" can never swallow real code as a
 * false "comment".
 */
function maskComments(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let state = "code"; // code | line-comment | block-comment | str-double | str-single | str-template

  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";

    if (state === "code") {
      if (c === "/" && c2 === "/") {
        state = "line-comment";
        out.push(" ", " ");
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        state = "block-comment";
        out.push(" ", " ");
        i += 2;
        continue;
      }
      if (c === '"') {
        state = "str-double";
      } else if (c === "'") {
        state = "str-single";
      } else if (c === "`") {
        state = "str-template";
      }
      out.push(c);
      i += 1;
      continue;
    }

    if (state === "line-comment") {
      if (c === "\n") {
        state = "code";
        out.push(c);
      } else {
        out.push(" ");
      }
      i += 1;
      continue;
    }

    if (state === "block-comment") {
      if (c === "*" && c2 === "/") {
        state = "code";
        out.push(" ", " ");
        i += 2;
        continue;
      }
      out.push(c === "\n" ? "\n" : " ");
      i += 1;
      continue;
    }

    // str-double | str-single | str-template
    const quote = state === "str-double" ? '"' : state === "str-single" ? "'" : "`";
    if (c === "\\") {
      // Escaped char inside the string — copy both through unmodified,
      // never interpreted as a quote/comment boundary.
      out.push(c);
      if (c2 !== "") out.push(c2);
      i += c2 !== "" ? 2 : 1;
      continue;
    }
    if (c === quote) {
      state = "code";
    }
    out.push(c);
    i += 1;
  }

  return out.join("");
}

// ── Scanner ───────────────────────────────────────────────────────────────────

function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const lines = src.split("\n");
  const maskedLines = maskComments(src).split("\n");
  const rel = relative(ROOT, absPath);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const maskedLine = maskedLines[i] ?? line;
    const lineNo = i + 1;

    // Check numbered palette (unmasked — out of scope for this fix)
    const palMatches = [...line.matchAll(PALETTE_RE)];
    for (const m of palMatches) {
      violations.push({ file: rel, line: lineNo, snippet: line.trim(), match: m[0] });
    }

    // Check raw hex against the COMMENT-MASKED line — a PR/issue reference
    // in a // or /* */ comment (incl. JSDoc continuation) cannot match.
    const hexMatches = [...maskedLine.matchAll(HEX_RE)];
    for (const m of hexMatches) {
      violations.push({ file: rel, line: lineNo, snippet: line.trim(), match: m[0] });
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SCAN_DIRS = [join(ROOT, "app"), join(ROOT, "components")];
const EXTS = [".tsx", ".ts"];

const allFiles = SCAN_DIRS.flatMap((d) => walkDir(d, EXTS));
const allViolations = allFiles.flatMap((f) => scanFile(f));

if (allViolations.length === 0) {
  console.log("check:palette — PASS (0 violations)");
  process.exit(0);
}

// Group by file for readability
const byFile = new Map();
for (const v of allViolations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

console.error("\ncheck:palette — FAIL\n");
for (const [file, items] of byFile) {
  for (const { line, snippet, match } of items) {
    console.error(`  ${file}:${line}: [${match}]  ${snippet}`);
  }
}
console.error(
  `\n${allViolations.length} violation${allViolations.length === 1 ? "" : "s"} found. Replace with semantic tokens (bg-muted, text-foreground, bg-destructive, etc.).\n`
);
process.exit(1);
