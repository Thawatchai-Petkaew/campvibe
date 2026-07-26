#!/usr/bin/env node
/**
 * check-scale.mjs — CAM-552 responsive-scale guard (DESIGN.md §2 "Responsive scale")
 *
 * Stops a control from shipping desktop-only sizing, and stops the mobile
 * scale from being used to defeat the 44px touch floor it was built to respect.
 *
 * Run standalone:      node scripts/check-scale.mjs
 * Runs automatically:  npm run check:ds  (check-ds.mjs folds these rules in, so
 *                      no new package.json script is needed and CI picks it up)
 *
 * Exit 0 → no BLOCKING findings (report-mode findings may still be printed)
 * Exit 1 → at least one BLOCKING finding
 *
 * ── The three rules ─────────────────────────────────────────────────────────
 *
 *  M1  control-height-not-responsive
 *      A `h-12` that is a CONTROL height with no `md:` step. `h-12` is the
 *      desktop `lg` height; its only mobile-safe shapes are `h-11 md:h-12`
 *      (a consumer) or `md:h-12` alone.
 *
 *  M2  display-type-not-responsive
 *      A raw `text-2xl`..`text-6xl` with no responsive font-size twin in the
 *      same className. A display size identical on a phone and a desktop is
 *      exactly the defect this story was opened for. Fix = a `text-heading-*`
 *      role, which is responsive by construction.
 *
 *  M3  mobile-step-under-touch-floor        ← BLOCKING REPO-WIDE, backlog 0
 *      A responsive height pair whose MOBILE value lands under 44px, e.g.
 *      `h-9 md:h-12` or `size-10 md:size-11`. Backlog is 0 by construction —
 *      nobody could write a mobile step before CAM-552 defined mobile steps —
 *      so this one ships blocking everywhere from day one. It is the rule that
 *      prevents "compact" from being read as "shrink the tap target".
 *
 * ── Why this is co-occurrence, not a bare string grep (the CAM-221 lesson) ──
 * A grep for `h-12` catches an avatar, a spinner and an empty-state glyph as
 * readily as a control. M1 therefore only fires when the `h-12` is *acting as
 * a control height*:
 *   · it co-occurs with `rounded-full` (the role radius every CampVibe control
 *     carries — button, input, chip, select trigger), OR
 *   · it is the value of a cva `lg:` size variant.
 * and it is skipped when:
 *   · the element is square (`w-12` / `size-12`) → avatar, icon tile, spinner;
 *   · it is a `<Skeleton>` → a placeholder's job is to MIRROR whatever control
 *     it stands in for, so it must track that control rather than this rule.
 *     If the control it mirrors is itself flagged, fixing the control is the
 *     fix; changing the skeleton alone would CREATE layout shift.
 *
 * ── Rollout (.claude/rules/ops.md: report → clear to 0 → blocking) ──────────
 * M1/M2 ship BLOCKING only over the surface CAM-552 actually cleared to 0, and
 * REPORT-mode elsewhere with the backlog counted. M3 is blocking everywhere.
 * Widening M1/M2's blocking scope is a follow-up story that clears the named
 * backlog first — never a flip with a non-zero backlog.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Touch floor in px, and the Tailwind height steps that fall under it. */
export const TOUCH_FLOOR_PX = 44;

/** Tailwind spacing step -> px (step * 4). h-11 = 44px = the floor. */
const stepPx = (n) => n * 4;

/**
 * Blocking surface for M1/M2 — the files CAM-552 migrated to a 0 backlog.
 * Everything else runs the same rules in report mode.
 */
const BLOCKING_PREFIXES = [
  "components/ui/",
  "app/preview/",
  "components/FilterModal.tsx",
  "components/SearchModal.tsx",
  "components/CategoryBar.tsx",
];

/**
 * Named exemptions — each carries the reason it cannot be migrated by this
 * story, so it is a recorded decision rather than a silent hole.
 */
const EXEMPT = new Map([
  [
    "components/ui/option-group-section.tsx",
    "heading className is pinned char-for-char by __tests__/cam-528-detail-taxonomy.test.ts:140, which is outside CAM-552's file surface (follow-up)",
  ],
]);

const EXCLUDE_PREFIXES = [
  join(ROOT, "node_modules"),
  join(ROOT, ".next"),
  join(ROOT, "scripts"),
  join(ROOT, "__tests__"),
  join(ROOT, "e2e"),
  join(ROOT, "app", "status"), // intentionally pinned HUD surface
];

function isExcluded(abs) {
  return EXCLUDE_PREFIXES.some((p) => abs.startsWith(p + "/") || abs === p);
}

function walkDir(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    if (isExcluded(abs)) continue;
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkDir(abs, results);
    else if (abs.endsWith(".tsx") || abs.endsWith(".ts")) results.push(abs);
  }
  return results;
}

// ── Rule matchers (exported so the regression test can drive them directly) ──

/** Any responsive font-size twin: md:text-lg, lg:text-2xl, sm:text-xl … */
const RESPONSIVE_FONT_RE = /\b(sm|md|lg|xl|2xl):text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/;
/** A raw display-scale font size with no breakpoint prefix of its own. */
const RAW_DISPLAY_FONT_RE = /(?<![\w:-])text-(2xl|3xl|4xl|5xl|6xl)\b/;

const SQUARE_RE = /\b(w-12|size-12)\b/;
const SKELETON_RE = /<Skeleton\b/;

/**
 * A comment-only line. Prose that NAMES a class ("matches w-full h-12
 * rounded-full") is documentation, not a declaration — flagging it would train
 * people to stop writing comments, which is the opposite of what we want.
 * Covers JSX comments, `//`, `/* … *\/` and the `*` continuation of a block.
 */
const COMMENT_LINE_RE = /^\s*(\{\s*\/\*|\/\/|\/\*|\*(?!\/)|\*\/)/;

/**
 * Media / decorative elements. Their rendered height is a layout choice with
 * no tap-target meaning, so a responsive image height like `h-8 md:h-10` is
 * correct code, not a floor breach. (If the LINK wrapping such an image is
 * under 44px that is a real a11y defect — but it is a defect of the link's
 * hit area, which this rule is not the right instrument to detect.)
 */
const MEDIA_ELEMENT_RE = /<(img|Image|Skeleton|svg)\b/;
const ROUNDED_FULL_RE = /\brounded-full\b/;
const RESPONSIVE_H12_RE = /\bmd:h-12\b/;
/** A bare h-12 (no breakpoint prefix). */
const RAW_H12_RE = /(?<![\w:-])h-12\b/;
/** cva size variant: `lg: "...")` — the primitive-side declaration. */
const CVA_LG_RE = /\blg:\s*["'`]([^"'`]*)["'`]/;

/**
 * M3 — a responsive height/size pair whose MOBILE half is under the floor.
 * Matches e.g. `h-9 md:h-12`, `h-10 md:h-11`, `size-8 md:size-11`.
 * The mobile value is the bare utility; the desktop value carries `md:`.
 */
const MOBILE_STEP_PAIR_RE = /(?<![\w:-])(h|size)-(\d+)\b(?=[^"'`]*\bmd:\1-(\d+)\b)/g;

/**
 * Returns every M3 violation in one className-bearing line.
 * Exported for the CAM-552 regression test (both directions).
 */
export function findFloorBreaches(line) {
  const out = [];
  if (COMMENT_LINE_RE.test(line)) return out;
  if (MEDIA_ELEMENT_RE.test(line)) return out;
  for (const m of line.matchAll(MOBILE_STEP_PAIR_RE)) {
    const [, prop, mobileStep, desktopStep] = m;
    const mobilePx = stepPx(Number(mobileStep));
    const desktopPx = stepPx(Number(desktopStep));
    // Only a step that GROWS toward desktop is a "mobile step". A pair that
    // shrinks toward desktop is some other layout intent, not this scale.
    if (desktopPx <= mobilePx) continue;
    if (mobilePx >= TOUCH_FLOOR_PX) continue;
    out.push({
      match: `${prop}-${mobileStep} md:${prop}-${desktopStep}`,
      mobilePx,
      desktopPx,
    });
  }
  return out;
}

/** Returns true when this line declares a CONTROL height of h-12 with no md: step. */
export function isControlHeightViolation(line) {
  if (COMMENT_LINE_RE.test(line)) return false;
  if (!RAW_H12_RE.test(line)) return false;
  if (RESPONSIVE_H12_RE.test(line)) return false; // already has the desktop step
  if (SKELETON_RE.test(line)) return false; // mirrors a control; tracks it, not this rule
  if (SQUARE_RE.test(line)) return false; // avatar / icon tile / spinner, not a control
  const cvaLg = line.match(CVA_LG_RE);
  const isCvaLgValue = cvaLg != null && /(?<![\w:-])h-12\b/.test(cvaLg[1]);
  return ROUNDED_FULL_RE.test(line) || isCvaLgValue;
}

/** Returns true when this line uses a raw display font size with no responsive twin. */
export function isDisplayTypeViolation(line) {
  if (COMMENT_LINE_RE.test(line)) return false;
  if (!RAW_DISPLAY_FONT_RE.test(line)) return false;
  return !RESPONSIVE_FONT_RE.test(line);
}

const RULES = [
  {
    id: "M1-control-height-not-responsive",
    test: isControlHeightViolation,
    scoped: true,
    hint: 'Control height must step: "h-11 md:h-12" (or use <Button size="lg"> / inputSize="lg", which already do).',
  },
  {
    id: "M2-display-type-not-responsive",
    test: isDisplayTypeViolation,
    scoped: true,
    hint: "Use a responsive type role (type-display / type-heading-1 / type-heading-2 / type-heading-3) instead of a raw text-2xl..6xl.",
  },
  {
    id: "M3-mobile-step-under-touch-floor",
    test: (line) => findFloorBreaches(line).length > 0,
    scoped: false, // blocking repo-wide; backlog 0 by construction
    hint: `A mobile step may never land under the ${TOUCH_FLOOR_PX}px touch floor. Compact padding/gap/type instead, and keep the height at h-11.`,
  },
];

function isBlockingScope(rel) {
  if (EXEMPT.has(rel)) return false;
  return BLOCKING_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

/** Scans the repo and returns { blocking: [], report: [], exempt: [] }. */
export function runScaleGuard() {
  const files = [join(ROOT, "app"), join(ROOT, "components")].flatMap((d) => walkDir(d));
  const blocking = [];
  const report = [];
  const exempt = [];

  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (!rule.test(line)) continue;
        const finding = {
          file: rel,
          line: i + 1,
          rule: rule.id,
          hint: rule.hint,
          snippet: line.trim().slice(0, 110),
        };
        if (!rule.scoped) blocking.push(finding);
        else if (EXEMPT.has(rel)) exempt.push({ ...finding, reason: EXEMPT.get(rel) });
        else if (isBlockingScope(rel)) blocking.push(finding);
        else report.push(finding);
      }
    });
  }
  return { blocking, report, exempt };
}

function main() {
  const { blocking, report, exempt } = runScaleGuard();

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ CampVibe Responsive-Scale Guard (CAM-552) — DESIGN.md §2                   │");
  console.log("│ M1/M2 BLOCKING on components/ui + preview + the 3 migrated surfaces;       │");
  console.log("│ REPORT elsewhere. M3 (touch floor) BLOCKING repo-wide, backlog 0.          │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘");
  console.log("");

  for (const rule of RULES) {
    const b = blocking.filter((f) => f.rule === rule.id).length;
    const r = report.filter((f) => f.rule === rule.id).length;
    const mode = rule.scoped ? "blocking(scoped)+report" : "blocking(repo-wide)";
    const status = b === 0 ? `ok   (0 blocking)` : `FAIL (${b} blocking)`;
    console.log(`  ${status.padEnd(22)} ${rule.id}  [${mode}]  backlog=${r}`);
  }
  console.log("");

  if (report.length > 0) {
    console.log(`check:scale — ${report.length} report-mode finding(s), NOT blocking yet:`);
    for (const f of report) {
      console.log(`    ${f.file}:${f.line}  [${f.rule}]  ${f.snippet}`);
    }
    console.log("  Clear this backlog to 0 before widening the blocking scope (.claude/rules/ops.md).");
    console.log("");
  }

  if (exempt.length > 0) {
    console.log(`check:scale — ${exempt.length} named exemption(s):`);
    for (const f of exempt) {
      console.log(`    ${f.file}:${f.line}  [${f.rule}]  ${f.reason}`);
    }
    console.log("");
  }

  if (blocking.length === 0) {
    console.log("check:scale — PASS (0 blocking violations)");
    return 0;
  }

  console.error("\ncheck:scale — FAIL (blocking violations)\n");
  for (const f of blocking) {
    console.error(`  ${f.file}:${f.line}: [${f.rule}]  ${f.snippet}`);
  }
  const hints = new Set(blocking.map((f) => f.hint));
  console.error(`\n${blocking.length} blocking violation(s) found.\n`);
  for (const h of hints) console.error(`  ${h}`);
  console.error("");
  return 1;
}

// CLI only — importing this module (the CAM-552 regression test imports the
// matchers) must never scan the repo or call process.exit.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
