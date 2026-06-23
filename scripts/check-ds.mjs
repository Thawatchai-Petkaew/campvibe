#!/usr/bin/env node
/**
 * check-ds.mjs — DS-6 design-system consistency guard (CAM-126)
 *
 * Scans app/** and components/** (.tsx/.ts) for patterns that violate the
 * CampVibe design-system grammar locked in by DS-2, DS-3 and DS-5.
 *
 * Exit 0  → clean (no violations)
 * Exit 1  → violations found (list printed to stderr)
 *
 * Usage:
 *   node scripts/check-ds.mjs
 *   npm run check:ds
 *
 * Rules enforced:
 *   1. No @tabler/icons-react imports — lucide-react only (DS-5)
 *   2. No !h-* / !w-* important sizing overrides — use Button/Input size prop (DS-2/3)
 *   3. No rounded-[Npx] arbitrary px radius — use Tailwind radius scale tokens (DS-3)
 *
 * Exclusions:
 *   - app/status/**         (intentionally pinned light UI, out of scope)
 *   - scripts/**            (this file + peers)
 *   - __tests__/**          (test fixtures)
 *   - components/ui/**      (shadcn auto-generated primitives; sub-pixel values intentional)
 *   - node_modules, .next   (generated)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// ── Patterns ──────────────────────────────────────────────────────────────────

/** DS-5: No @tabler/icons-react — only lucide-react is allowed. */
const TABLER_RE = /from\s+['"]@tabler\/icons-react['"]/g;

/**
 * DS-2/3: No !important sizing overrides on h- / w- utilities.
 * Tailwind applies ! prefix directly before the utility name (e.g. !h-12, !w-4).
 * \B ensures we catch it whether preceded by a space, quote or nothing (not a word char).
 */
const IMPORTANT_H_RE = /\B!h-\S+/g;
const IMPORTANT_W_RE = /\B!w-\S+/g;

/**
 * DS-3: No arbitrary px radius — use the Tailwind scale (rounded-sm … rounded-3xl).
 * Matches rounded-[Npx] where N is one or more digits.
 */
const ARBITRARY_RADIUS_RE = /rounded-\[\d+px\]/g;

// ── Exclusion helpers ─────────────────────────────────────────────────────────

/** Absolute path prefixes / segments to skip entirely. */
const EXCLUDE_PREFIXES = [
  join(ROOT, "node_modules"),
  join(ROOT, ".next"),
  join(ROOT, "scripts"),
  join(ROOT, "__tests__"),
  join(ROOT, "app", "status"),
  join(ROOT, "components", "ui"),
];

/** Returns true when the path should be skipped. */
function isExcluded(absPath) {
  return EXCLUDE_PREFIXES.some(
    (p) => absPath.startsWith(p + "/") || absPath === p
  );
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

/**
 * Each rule: { re, label, hint }
 * re   — RegExp with global flag
 * label — short name for output
 * hint  — fix hint shown in summary
 */
const RULES = [
  {
    re: TABLER_RE,
    label: "tabler-import",
    hint: 'Replace @tabler/icons-react with lucide-react (DS-5).',
  },
  {
    re: IMPORTANT_H_RE,
    label: "!h-override",
    hint: 'Remove !important sizing — use the Button/Input size= prop instead (DS-2/3).',
  },
  {
    re: IMPORTANT_W_RE,
    label: "!w-override",
    hint: 'Remove !important sizing — use the Button/Input size= prop instead (DS-2/3).',
  },
  {
    re: ARBITRARY_RADIUS_RE,
    label: "arbitrary-px-radius",
    hint: 'Use Tailwind radius scale: rounded-sm/md/lg/xl/2xl/3xl (DS-3). rounded-[24px] → rounded-3xl.',
  },
];

function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const lines = src.split("\n");
  const rel = relative(ROOT, absPath);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    for (const { re, label } of RULES) {
      // Reset lastIndex before each match (required for global regexes reused across lines)
      re.lastIndex = 0;
      const matches = [...line.matchAll(re)];
      for (const m of matches) {
        violations.push({
          file: rel,
          line: lineNo,
          snippet: line.trim(),
          match: m[0],
          label,
        });
      }
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
  console.log("check:ds — PASS (0 violations)");
  process.exit(0);
}

// Group by file for readability
const byFile = new Map();
for (const v of allViolations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

console.error("\ncheck:ds — FAIL\n");
for (const [file, items] of byFile) {
  for (const { line, snippet, match, label } of items) {
    console.error(`  ${file}:${line}: [${label}] ${match}  →  ${snippet}`);
  }
}

// Collect unique hints
const hints = new Set(allViolations.map((v) => RULES.find((r) => r.label === v.label)?.hint).filter(Boolean));
console.error(`\n${allViolations.length} violation${allViolations.length === 1 ? "" : "s"} found.\n`);
for (const h of hints) {
  console.error(`  ${h}`);
}
console.error("");
process.exit(1);
