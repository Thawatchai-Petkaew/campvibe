#!/usr/bin/env node
/**
 * check-palette.mjs — F6 palette regression guard (CAM-111)
 *
 * Scans app/** and components/** (.tsx/.ts) for hardcoded Tailwind numbered
 * palette classes and raw hex colour literals that must be replaced with
 * semantic design tokens.
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
 * Raw hex literals in className / style strings.
 * Matches #rgb, #rrggbb, #rgba, #rrggbbaa etc.
 * Also matches Tailwind arbitrary [#hex] syntax.
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

// ── Scanner ───────────────────────────────────────────────────────────────────

function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const lines = src.split("\n");
  const rel = relative(ROOT, absPath);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Check numbered palette
    const palMatches = [...line.matchAll(PALETTE_RE)];
    for (const m of palMatches) {
      violations.push({ file: rel, line: lineNo, snippet: line.trim(), match: m[0] });
    }

    // Check raw hex
    const hexMatches = [...line.matchAll(HEX_RE)];
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
