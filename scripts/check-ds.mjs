#!/usr/bin/env node
/**
 * check-ds.mjs — DS-6 design-system consistency guard (CAM-126)
 *               Phase A complete; all rules now BLOCKING (CAM-228 A8)
 *
 * Scans app/** and components/** (.tsx/.ts) for patterns that violate the
 * CampVibe design-system grammar locked in by DS-2, DS-3, DS-5, and CAM-223.
 *
 * Exit 0  → clean (0 violations)
 * Exit 1  → BLOCKING violations found (list printed to stderr)
 *
 * Usage:
 *   node scripts/check-ds.mjs
 *   npm run check:ds
 *
 * ── BLOCKING rules (exit 1 on any match) ─────────────────────────────────────
 *   1. No @tabler/icons-react imports — lucide-react only (DS-5)
 *   2. No !h-* / !w-* important sizing overrides — use Button/Input size prop (DS-2/3)
 *   3. No rounded-[Npx] arbitrary px radius — use Tailwind radius scale tokens (DS-3)
 *   R1. Off-role radius: rounded-(sm|md|lg) on consumers (CAM-223)
 *   R2. Off-tier shadow: shadow-xl / shadow-xs / shadow-inner on consumers (CAM-223)
 *   R3. Arbitrary font size: text-[Npx] (CAM-223)
 *   R4. Hardcoded input focus ring: focus-visible:ring-primary / focus-visible:border-primary (CAM-223)
 *   R5. Button/Badge color override: bg-foreground / text-background as CTA; <Button/<Badge with bg-* variant in className (CAM-223)
 *   R6. Raw status-pill span: <span className containing rounded-full + text-xs + bg- (CAM-223)
 *   R7. Inline height on Button: <Button … className="…h-\d (CAM-223)
 *   R8. Hand-rolled modal: file imports DialogContent but not from modal-shell (CAM-223)
 *
 * ── Designer-approved allowlist (CAM-228 A8) ─────────────────────────────────
 *   R5a: app/profile/page.tsx — avatar hover scrim (bg-foreground/50 opacity-0 group-hover:opacity-100)
 *        → approved intentional image-overlay scrim; not a CTA
 *   R5a: components/CampgroundDetailClient.tsx — photo caption chip (bg-foreground/60 text-background on a <div> with backdrop-blur)
 *        → approved intentional adaptive scrim for text legibility on photos; not a CTA
 *   R5b: any line with variant="ghost" AND hover:bg-primary/5
 *        → approved "ghost-primary" link-action pattern on utility/dashboard surfaces (bookings, dashboard)
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

// ── BLOCKING Patterns ─────────────────────────────────────────────────────────

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

/**
 * R1. Off-role radius: rounded-sm / rounded-md / rounded-lg on consumer files.
 * Role scale: control=rounded-full, card=rounded-3xl, popover=rounded-2xl, inner/badge=rounded-xl.
 * These three are the ones most likely to be hand-rolled outside the token system.
 * Word boundary (\b) prevents matching rounded-sm-foo or similar utility extensions.
 */
const REPORT_RADIUS_RE = /\brounded-(sm|md|lg)\b/g;

/**
 * R2. Off-tier shadow: shadow-xl (too heavy for non-modal), shadow-xs, shadow-inner.
 * Tier map: modal=shadow-2xl, dropdown/popover=shadow-lg; anything heavier or lighter
 * than the tier is a drift signal. Word boundary prevents matching shadow-xl/50 etc.
 */
const REPORT_SHADOW_RE = /\b(shadow-xl|shadow-xs|shadow-inner)\b/g;

/**
 * R3. Arbitrary font size: text-[Npx] where N is one or more digits.
 * Consumers should use the type-scale tokens (text-sm, text-base, text-lg, etc.)
 * rather than raw pixel sizes.
 */
const REPORT_FONT_SIZE_RE = /\btext-\[\d+px\]/g;

/**
 * R4. Hardcoded input focus ring.
 * focus-visible:ring-primary and focus-visible:border-primary bypass the
 * design-system focus token; consumers should use the semantic ring/border tokens.
 */
const REPORT_FOCUS_RING_RE = /\bfocus-visible:(ring-primary|border-primary)\b/g;

/**
 * R5a. bg-foreground / text-background used as a CTA color heuristic.
 * These are intentional DS tokens only for specific roles; appearing in arbitrary
 * consumer classNames usually signals a manual CTA color override.
 *
 * Designer-approved allowlist (CAM-228 A8):
 *   - app/profile/page.tsx lines with "bg-foreground/50 opacity-0 group-hover:opacity-100"
 *     (avatar hover scrim — image overlay, not a CTA)
 *   - components/CampgroundDetailClient.tsx lines with "bg-foreground/60 text-background"
 *     AND "backdrop-blur" (photo caption chip — adaptive scrim on photo, not a CTA)
 */
const REPORT_CTA_COLOR_RE = /\b(bg-foreground|text-background)\b/g;

/**
 * R5b. <Button or <Badge with a className prop containing bg-(primary|foreground|secondary|destructive).
 * Heuristic: scan for the JSX opening tag on the same line or multi-line block.
 * Line-level scan: flag any line that has both "<Button" or "<Badge" AND "bg-(variant)".
 *
 * Designer-approved allowlist (CAM-228 A8):
 *   - Lines with variant="ghost" AND hover:bg-primary/5
 *     (ghost-primary link-action pattern on utility/dashboard surfaces)
 */
const REPORT_BTN_BADGE_COLOR_RE = /\b(bg-primary|bg-foreground|bg-secondary|bg-destructive)\b/g;

/**
 * R6. Raw status-pill <span: className containing rounded-full AND text-xs AND bg-.
 * A span carrying all three is almost certainly a hand-rolled badge that should use <Badge>.
 * Note: this is detected per-file (not per-line) since the three tokens may split lines;
 * the per-file heuristic flags the file for manual review.
 * Per-line heuristic: flag lines with both rounded-full and text-xs and bg- in the className.
 */
const REPORT_RAW_PILL_RE = /rounded-full[\s\S]{0,120}?text-xs[\s\S]{0,120}?bg-\S+/;

/**
 * R7. Inline height on <Button: <Button ... className="...h-N
 * Should use the size= prop instead of forcing a custom height via className.
 * Heuristic: a line with <Button and className containing h-N (whole token, e.g. h-9, h-10, h-12).
 * \b after the digits avoids matching h-10 inside h-100 etc.
 */
const REPORT_BUTTON_HEIGHT_RE = /\bh-\d+\b/g;

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

// ── All-rules Scanner (blocking) ─────────────────────────────────────────────

/**
 * Each blocking rule: { re, label, hint }
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

// ── R1–R8 Scanner (now blocking, CAM-228 A8) ─────────────────────────────────

/**
 * Scans a file for all 8 consistency categories (R1–R8).
 * Returns an object keyed by category name, each an array of { file, line, snippet, match }.
 * All findings are now BLOCKING (exit 1). Designer-approved exceptions are allowlisted
 * per the comments on each rule above.
 */
function scanFileReport(absPath) {
  const src = readFileSync(absPath, "utf8");
  const lines = src.split("\n");
  const rel = relative(ROOT, absPath);

  const findings = {
    "R1-off-role-radius": [],
    "R2-off-tier-shadow": [],
    "R3-arb-font-size": [],
    "R4-hardcoded-focus-ring": [],
    "R5-cta-color": [],
    "R5b-btn-badge-color": [],
    "R6-raw-status-pill": [],
    "R7-button-inline-height": [],
    "R8-hand-rolled-modal": [],
  };

  // ── Per-line rules ────────────────────────────────────────────────────────

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const trimmed = line.trim();

    // R1. Off-role radius
    REPORT_RADIUS_RE.lastIndex = 0;
    for (const m of [...line.matchAll(REPORT_RADIUS_RE)]) {
      findings["R1-off-role-radius"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
    }

    // R2. Off-tier shadow
    REPORT_SHADOW_RE.lastIndex = 0;
    for (const m of [...line.matchAll(REPORT_SHADOW_RE)]) {
      findings["R2-off-tier-shadow"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
    }

    // R3. Arbitrary font size
    REPORT_FONT_SIZE_RE.lastIndex = 0;
    for (const m of [...line.matchAll(REPORT_FONT_SIZE_RE)]) {
      findings["R3-arb-font-size"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
    }

    // R4. Hardcoded focus ring
    REPORT_FOCUS_RING_RE.lastIndex = 0;
    for (const m of [...line.matchAll(REPORT_FOCUS_RING_RE)]) {
      findings["R4-hardcoded-focus-ring"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
    }

    // R5a. CTA color (bg-foreground / text-background anywhere)
    // Allowlist (designer-approved A8/CAM-228):
    //   - app/profile/page.tsx: avatar hover scrim — bg-foreground/50 with opacity-0 group-hover:opacity-100
    //   - components/CampgroundDetailClient.tsx: photo caption chip — bg-foreground/60 text-background with backdrop-blur
    REPORT_CTA_COLOR_RE.lastIndex = 0;
    const isProfileAvatarScrim =
      rel === "app/profile/page.tsx" &&
      line.includes("bg-foreground/50") &&
      line.includes("opacity-0") &&
      line.includes("group-hover:opacity-100");
    const isCampgroundPhotoChip =
      rel === "components/CampgroundDetailClient.tsx" &&
      line.includes("bg-foreground/60") &&
      line.includes("text-background") &&
      line.includes("backdrop-blur");
    if (!isProfileAvatarScrim && !isCampgroundPhotoChip) {
      for (const m of [...line.matchAll(REPORT_CTA_COLOR_RE)]) {
        findings["R5-cta-color"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
      }
    }

    // R5b. <Button or <Badge with a bg-variant class on the same line
    // Allowlist (designer-approved A8/CAM-228):
    //   - Lines with variant="ghost" AND hover:bg-primary/5 → ghost-primary link-action pattern
    if (/<(Button|Badge)\b/.test(line)) {
      const isGhostPrimaryLinkAction =
        line.includes('variant="ghost"') && line.includes("hover:bg-primary/5");
      if (!isGhostPrimaryLinkAction) {
        REPORT_BTN_BADGE_COLOR_RE.lastIndex = 0;
        for (const m of [...line.matchAll(REPORT_BTN_BADGE_COLOR_RE)]) {
          findings["R5b-btn-badge-color"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
        }
      }
    }

    // R6. Raw status-pill <span (per-line: rounded-full + text-xs + bg- on same line)
    if (/<span\b/.test(line) && /rounded-full/.test(line) && /\btext-xs\b/.test(line) && /\bbg-/.test(line)) {
      findings["R6-raw-status-pill"].push({ file: rel, line: lineNo, snippet: trimmed, match: "<span> with rounded-full+text-xs+bg-" });
    }

    // R7. Inline height on <Button (h-\d in className on a line that has <Button)
    if (/<Button\b/.test(line)) {
      REPORT_BUTTON_HEIGHT_RE.lastIndex = 0;
      for (const m of [...line.matchAll(REPORT_BUTTON_HEIGHT_RE)]) {
        findings["R7-button-inline-height"].push({ file: rel, line: lineNo, snippet: trimmed, match: m[0] });
      }
    }
  }

  // ── R8. Hand-rolled modal (per-file) ─────────────────────────────────────
  // File uses the <DialogContent JSX tag (not just the word in a comment/string)
  // but does NOT import from @/components/ui/modal-shell.
  // Exclude files where every DialogContent is actually AlertDialogContent.
  const hasDialogContent = /<DialogContent\b/.test(src.replace(/<AlertDialogContent/g, ""));
  const hasModalShellImport = /from\s+['"]@\/components\/ui\/modal-shell['"]/.test(src);

  if (hasDialogContent && !hasModalShellImport) {
    findings["R8-hand-rolled-modal"].push({
      file: rel,
      line: 0,
      snippet: "(file-level)",
      match: "DialogContent without modal-shell import",
    });
  }

  return findings;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SCAN_DIRS = [join(ROOT, "app"), join(ROOT, "components")];
const EXTS = [".tsx", ".ts"];

const allFiles = SCAN_DIRS.flatMap((d) => walkDir(d, EXTS));
const allViolations = allFiles.flatMap((f) => scanFile(f));

// ── Collect R1–R8 findings (now blocking) ────────────────────────────────────

const reportTotals = {
  "R1-off-role-radius": [],
  "R2-off-tier-shadow": [],
  "R3-arb-font-size": [],
  "R4-hardcoded-focus-ring": [],
  "R5-cta-color": [],
  "R5b-btn-badge-color": [],
  "R6-raw-status-pill": [],
  "R7-button-inline-height": [],
  "R8-hand-rolled-modal": [],
};

for (const f of allFiles) {
  const perFile = scanFileReport(f);
  for (const key of Object.keys(reportTotals)) {
    reportTotals[key].push(...perFile[key]);
  }
}

// ── Print active guard summary ────────────────────────────────────────────────

console.log("");
console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
console.log("│ CampVibe DS Guard — active (R1–R8 fully blocking since CAM-228 A8)         │");
console.log("│ Approved allowlist in guard source; violations = CI failure.               │");
console.log("└─────────────────────────────────────────────────────────────────────────────┘");
console.log("");

const REPORT_LABELS = {
  "R1-off-role-radius":        "R1  Off-role radius  (rounded-sm/md/lg → use role-scale token)",
  "R2-off-tier-shadow":        "R2  Off-tier shadow  (shadow-xl/xs/inner → modal=shadow-2xl, dropdown=shadow-lg)",
  "R3-arb-font-size":          "R3  Arbitrary font size  (text-[Npx] → use type-scale token)",
  "R4-hardcoded-focus-ring":   "R4  Hardcoded focus ring  (focus-visible:ring/border-primary → semantic token)",
  "R5-cta-color":              "R5a CTA color override  (bg-foreground/text-background as CTA)",
  "R5b-btn-badge-color":       "R5b Button/Badge bg-variant  (<Button|Badge className with bg-primary/etc.)",
  "R6-raw-status-pill":        "R6  Raw status-pill <span>  (rounded-full+text-xs+bg- → use <Badge>)",
  "R7-button-inline-height":   "R7  Button inline height  (<Button className h-N → use size= prop)",
  "R8-hand-rolled-modal":      "R8  Hand-rolled modal  (DialogContent without modal-shell import)",
};

// Collect R1–R8 violations into allViolations so exit code is unified
const reportViolations = [];
for (const [key, label] of Object.entries(REPORT_LABELS)) {
  const items = reportTotals[key];
  const count = items.length;
  const status = count > 0 ? `FAIL (${count})` : "ok   (0)";
  console.log(`  ${status.padEnd(12)} ${label}`);
  for (const { file, line, snippet, match } of items) {
    const loc = line > 0 ? `${file}:${line}` : file;
    console.log(`               ${loc}: [${match}]  ${snippet.slice(0, 100)}`);
    reportViolations.push({ file, line, snippet, match, label });
  }
}

console.log("");

// ── BLOCKING output + exit ────────────────────────────────────────────────────

const totalViolations = allViolations.length + reportViolations.length;

if (totalViolations === 0) {
  console.log("check:ds — PASS (0 violations)");
  process.exit(0);
}

// Group by file for readability
const byFile = new Map();
for (const v of allViolations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

if (byFile.size > 0) {
  console.error("\ncheck:ds — FAIL (blocking violations)\n");
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
}

if (reportViolations.length > 0) {
  console.error("\ncheck:ds — FAIL (R1–R8 consistency violations)\n");
  for (const { file, line, snippet, match, label } of reportViolations) {
    const loc = line > 0 ? `${file}:${line}` : file;
    console.error(`  ${loc}: [${label}] ${match}  →  ${snippet.slice(0, 100)}`);
  }
  console.error(`\n${reportViolations.length} R1–R8 violation${reportViolations.length === 1 ? "" : "s"} found.`);
  console.error("  Fix the drift or add to the designer-approved allowlist in check-ds.mjs.");
  console.error("");
}

process.exit(1);
