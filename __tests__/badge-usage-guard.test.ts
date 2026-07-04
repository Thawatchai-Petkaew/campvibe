/**
 * DS-badge-norm — Badge className usage guard
 *
 * Regression guard: scans every *.tsx file for <Badge> usages and asserts
 * that NO className contains a forbidden override. Forbidden overrides are
 * those that contradict the variant/DS contract (color, radius, font-weight,
 * text-transform, tracking, ring, shadow, backdrop-blur, height, min-width).
 *
 * Permitted className additions:
 *   - Positioning: absolute, relative, z-*
 *   - Margin: m*-*
 *   - Extra padding: px-*, py-*, p-* (explicit layout override)
 *   - cursor-*
 *   - data-testid (attribute, not a class)
 *   - Animation utilities: animate-*, zoom-*, duration-*, ease-*
 *   - flex layout: flex, items-*, justify-*, gap-*
 *
 * This guard ships BLOCKING because every call site was fixed in this same PR
 * — the backlog is zero.
 *
 * Source-scan technique (same harness as status-map-flicker.test.ts): node-only
 * Vitest environment, no jsdom/React. Source-inspection is the strongest feasible
 * guard for cross-file structural contracts.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");

// ── Collect all *.tsx files except node_modules, .next, __tests__ ────────────

function walkTsx(dir: string, result: string[] = []): string[] {
  const SKIP_DIRS = new Set(["node_modules", ".next", "__tests__", ".git"]);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(fullPath, result);
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      result.push(fullPath);
    }
  }
  return result;
}

const allTsxFiles = walkTsx(root);

// ── Extract Badge className strings from source ───────────────────────────────
//
// We look for:
//   <Badge ... className="..." ...>
//   <Badge ... className={'...'} ...>
//   <Badge ... className={`...`} ...>
//   <Badge ... className={cn(...)} ...>
//
// Strategy: find every "<Badge" block up to the first ">", then extract the
// className value(s) from within that block. We use a best-effort approach
// (not a full AST) adequate for source-inspection of the controlled call sites.
//
// Returns an array of { file, classValue } tuples.

interface BadgeClassOccurrence {
  file: string;
  classValue: string;
  line: number;
}

function extractBadgeClassNames(src: string, filePath: string): BadgeClassOccurrence[] {
  const results: BadgeClassOccurrence[] = [];

  // Match <Badge ... className=...> blocks.
  // We look for <Badge followed by attributes until we hit the first unescaped >.
  // This regex is intentionally simple — it matches the common patterns in the codebase.
  const badgeBlockRegex = /<Badge\b([^>]*(?:>(?!\/Badge)[^>]*)?)(?=>|\/>)/g;

  // Simpler: just find <Badge... segments and look for className within them.
  // We find each opening <Badge tag (up to the first >) and scan for className=.
  const openTagRegex = /<Badge\b([\s\S]*?)(?=\n\s*>|\s*>|\s*\/>)/g;

  let match: RegExpExecArray | null;
  while ((match = openTagRegex.exec(src)) !== null) {
    const tagContent = match[1];

    // Find className= in the tag content
    // Handles: className="...", className={'...'}, className={`...`}, className={cn(...)}
    const classNamePatterns = [
      /className="([^"]*)"/, // className="..."
      /className='([^']*)'/, // className='...'
      /className=\{`([^`]*)`\}/, // className={`...`}
      /className=\{"([^"]*)"\}/, // className={"..."}
      /className=\{cn\(([\s\S]*?)\)\}/, // className={cn(...)}
      /className=\{([\s\S]*?)\}/, // className={expr}
    ];

    for (const pattern of classNamePatterns) {
      const classMatch = tagContent.match(pattern);
      if (classMatch) {
        const lineNum = src.slice(0, match.index).split("\n").length;
        results.push({
          file: filePath,
          classValue: classMatch[1],
          line: lineNum,
        });
        break; // Only extract the first className match per tag
      }
    }
  }

  return results;
}

// ── Forbidden token patterns ─────────────────────────────────────────────────
//
// These patterns match className values that are NOT permitted on a <Badge>.
// They correspond exactly to the DS-badge-norm "Forbidden className additions" table
// in design.md.
//
// IMPORTANT: we distinguish "color classes" (bg-{token}, text-{semantic-token},
// border-{token}) from "size/layout" classes (text-xs, text-sm, text-base).
// We do NOT flag text-xs/sm/base/lg because those are size utilities; we only
// flag semantic color tokens (foreground, muted-foreground, primary, etc).

const SEMANTIC_COLOR_TOKENS = [
  "foreground",
  "muted-foreground",
  "muted",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "destructive",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "accent",
  "card",
  "card-foreground",
  "background",
  "border",
  "ring",
  "input",
  "popover",
  "popover-foreground",
];

// Build regex patterns for forbidden color overrides
const COLOR_TOKEN_PATTERN = SEMANTIC_COLOR_TOKENS.join("|");
const BG_COLOR_PATTERN = new RegExp(`\\bbg-(${COLOR_TOKEN_PATTERN})(?:[/\\s]|$)`);
const TEXT_COLOR_PATTERN = new RegExp(`\\btext-(${COLOR_TOKEN_PATTERN})(?:[/\\s]|$)`);
const BORDER_COLOR_PATTERN = new RegExp(`\\bborder-(${COLOR_TOKEN_PATTERN})(?:[/\\s]|$)`);

// Other forbidden patterns (not color-specific)
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: BG_COLOR_PATTERN,                                   description: "bg-{color} override" },
  { pattern: TEXT_COLOR_PATTERN,                                 description: "text-{color} override" },
  { pattern: BORDER_COLOR_PATTERN,                               description: "border-{color} override" },
  { pattern: /\brounded-full\b/,                                description: "rounded-full (use shape='pill')" },
  { pattern: /\brounded-lg\b/,                                  description: "rounded-lg override" },
  { pattern: /\brounded-md\b/,                                  description: "rounded-md override" },
  { pattern: /\brounded-2xl\b/,                                 description: "rounded-2xl override" },
  { pattern: /\brounded-3xl\b/,                                 description: "rounded-3xl override" },
  { pattern: /\bfont-bold\b/,                                   description: "font-bold override" },
  { pattern: /\bfont-semibold\b/,                               description: "font-semibold override" },
  { pattern: /\buppercase\b/,                                   description: "uppercase text-transform" },
  { pattern: /\blowercase\b/,                                   description: "lowercase text-transform" },
  { pattern: /\btracking-/,                                     description: "tracking-* letter-spacing" },
  { pattern: /\bring-/,                                         description: "ring-* override (shadow/ring)" },
  { pattern: /\bshadow-/,                                       description: "shadow-* override" },
  { pattern: /\bbackdrop-blur/,                                 description: "backdrop-blur (use variant='overlay')" },
  { pattern: /\bh-6\b|\bh-7\b|\bh-8\b/,                       description: "h-6/h-7/h-8 height override" },
  { pattern: /\bmin-w-/,                                        description: "min-w-* override (use shape='pill')" },
];

// ── Preview exempt: /app/preview/* is the kitchen-sink — not a production call site ──
// We exclude it from the guard since it intentionally demos all variants without constraints.
const EXEMPT_FILES = [
  path.join(root, "app", "preview"),
];

function isExempt(filePath: string): boolean {
  return EXEMPT_FILES.some((exemptDir) => filePath.startsWith(exemptDir));
}

// ── Collect all violations ────────────────────────────────────────────────────

const allViolations: Array<{ file: string; line: number; classValue: string; description: string }> = [];

for (const filePath of allTsxFiles) {
  if (isExempt(filePath)) continue;

  const src = fs.readFileSync(filePath, "utf-8");

  // Only process files that actually import Badge — skip others for speed
  if (!src.includes("Badge") && !src.includes("badge")) continue;

  const badgeClasses = extractBadgeClassNames(src, filePath);

  for (const { file, classValue, line } of badgeClasses) {
    for (const { pattern, description } of FORBIDDEN_PATTERNS) {
      if (pattern.test(classValue)) {
        allViolations.push({ file, line, classValue: classValue.slice(0, 120), description });
      }
    }
  }
}

// ── Report helper ─────────────────────────────────────────────────────────────

function relPath(abs: string): string {
  return abs.replace(root + "/", "");
}

// ── Guard tests ───────────────────────────────────────────────────────────────

describe("[DS-badge-norm] Badge className usage guard — no forbidden overrides", () => {
  it("no Badge className contains a bg-{color} override", () => {
    const violations = allViolations.filter((v) => v.description === "bg-{color} override");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `bg-{color} violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains a text-{color} override", () => {
    const violations = allViolations.filter((v) => v.description === "text-{color} override");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `text-{color} violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains a border-{color} override", () => {
    const violations = allViolations.filter((v) => v.description === "border-{color} override");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `border-{color} violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains rounded-full (use shape='pill' instead)", () => {
    const violations = allViolations.filter((v) => v.description.startsWith("rounded-full"));
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `rounded-full violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains rounded-lg / rounded-md / rounded-2xl / rounded-3xl", () => {
    const violations = allViolations.filter((v) =>
      ["rounded-lg override", "rounded-md override", "rounded-2xl override", "rounded-3xl override"].includes(v.description)
    );
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `radius overrides:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains font-bold or font-semibold", () => {
    const violations = allViolations.filter((v) =>
      ["font-bold override", "font-semibold override"].includes(v.description)
    );
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `font-weight overrides:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains uppercase or lowercase", () => {
    const violations = allViolations.filter((v) =>
      ["uppercase text-transform", "lowercase text-transform"].includes(v.description)
    );
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `text-transform violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains tracking-* (letter-spacing override)", () => {
    const violations = allViolations.filter((v) => v.description === "tracking-* letter-spacing");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `tracking violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains ring-* (use variant for focus/ring, not className)", () => {
    const violations = allViolations.filter((v) => v.description === "ring-* override (shadow/ring)");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `ring violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains shadow-* override", () => {
    const violations = allViolations.filter((v) => v.description === "shadow-* override");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `shadow violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains backdrop-blur (use variant='overlay' instead)", () => {
    const violations = allViolations.filter((v) =>
      v.description === "backdrop-blur (use variant='overlay')"
    );
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `backdrop-blur violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains h-6/h-7/h-8 height override", () => {
    const violations = allViolations.filter((v) => v.description === "h-6/h-7/h-8 height override");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `height override violations:\n${report}`).toHaveLength(0);
  });

  it("no Badge className contains min-w-* (use shape='pill' instead)", () => {
    const violations = allViolations.filter((v) => v.description === "min-w-* override (use shape='pill')");
    const report = violations
      .map((v) => `  ${relPath(v.file)}:${v.line} — '${v.classValue}'`)
      .join("\n");
    expect(violations, `min-w violations:\n${report}`).toHaveLength(0);
  });

  // ── Structural checks on the badge component itself ───────────────────────

  it("badge.tsx exports the shape='pill' variant (DS-badge-norm A)", () => {
    const badgeSrc = fs.readFileSync(path.join(root, "components/ui/badge.tsx"), "utf-8");
    expect(badgeSrc).toMatch(/\bpill\s*:\s*["'`]rounded-full/);
  });

  it("badge.tsx exports the overlay variant (DS-badge-norm B)", () => {
    const badgeSrc = fs.readFileSync(path.join(root, "components/ui/badge.tsx"), "utf-8");
    expect(badgeSrc).toMatch(/\boverlay\s*:/);
    expect(badgeSrc).toMatch(/bg-card\/85/);
    expect(badgeSrc).toMatch(/backdrop-blur-sm/);
  });

  it("badge.tsx has shape in defaultVariants (DS-badge-norm A)", () => {
    const badgeSrc = fs.readFileSync(path.join(root, "components/ui/badge.tsx"), "utf-8");
    expect(badgeSrc).toMatch(/defaultVariants[\s\S]{0,200}?shape\s*:\s*["']default["']/);
  });

  it("badge.tsx overlay variant uses NO hand-written dark: overrides (token-only)", () => {
    const badgeSrc = fs.readFileSync(path.join(root, "components/ui/badge.tsx"), "utf-8");
    // Extract the overlay variant line
    const overlayLine = badgeSrc.match(/overlay\s*:\s*["'`]([\s\S]*?)["'`]/)?.[1] ?? "";
    expect(overlayLine).not.toMatch(/\bdark:/);
  });

  // ── i18n: HOST label and onboardingChip keys present in locales ──────────

  it("locales/translations.json EN has nav.hostLabel = 'Host'", () => {
    const translations = JSON.parse(
      fs.readFileSync(path.join(root, "locales/translations.json"), "utf-8")
    );
    expect(translations.en.nav.hostLabel).toBe("Host");
  });

  it("locales/translations.json TH has nav.hostLabel = 'โฮสต์'", () => {
    const translations = JSON.parse(
      fs.readFileSync(path.join(root, "locales/translations.json"), "utf-8")
    );
    expect(translations.th.nav.hostLabel).toBe("โฮสต์");
  });

  it("locales/translations.json EN has host.onboardingChip = 'Host onboarding'", () => {
    const translations = JSON.parse(
      fs.readFileSync(path.join(root, "locales/translations.json"), "utf-8")
    );
    expect(translations.en.host.onboardingChip).toBe("Host onboarding");
  });

  it("locales/translations.json TH has host.onboardingChip = 'เริ่มต้นโฮสต์'", () => {
    const translations = JSON.parse(
      fs.readFileSync(path.join(root, "locales/translations.json"), "utf-8")
    );
    expect(translations.th.host.onboardingChip).toBe("เริ่มต้นโฮสต์");
  });

  // ── HOST label no longer hardcoded ───────────────────────────────────────

  it("Navbar.tsx does not hardcode 'HOST' as badge text", () => {
    const navbarSrc = fs.readFileSync(path.join(root, "components/Navbar.tsx"), "utf-8");
    // The string "HOST" must not appear as JSX text inside a Badge
    expect(navbarSrc).not.toMatch(/>HOST</);
  });

  it("dashboard/layout-client.tsx does not hardcode 'HOST' as badge text", () => {
    const layoutSrc = fs.readFileSync(
      path.join(root, "app/dashboard/layout-client.tsx"),
      "utf-8"
    );
    expect(layoutSrc).not.toMatch(/>HOST</);
  });

  // ── host/page.tsx uses i18n key for onboarding chip ──────────────────────

  it("app/host/page.tsx does not hardcode 'Host onboarding' as badge text", () => {
    const hostSrc = fs.readFileSync(path.join(root, "app/host/page.tsx"), "utf-8");
    expect(hostSrc).not.toMatch(/Host onboarding/);
  });

  // ── dashboard/page.tsx status label is i18n, not raw enum ────────────────

  it("app/dashboard/page.tsx does not render booking.status as raw enum in Badge", () => {
    const dashSrc = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf-8");
    // Must NOT have the old pattern: >{booking.status}<
    expect(dashSrc).not.toMatch(/>\s*\{booking\.status\}\s*</);
  });

  it("app/dashboard/bookings/page.tsx does not render booking.status as raw enum in Badge", () => {
    const dashBookSrc = fs.readFileSync(
      path.join(root, "app/dashboard/bookings/page.tsx"),
      "utf-8"
    );
    expect(dashBookSrc).not.toMatch(/>\s*\{booking\.status\}\s*</);
  });

  // ── No debug console.log in layout-client.tsx ────────────────────────────

  it("app/dashboard/layout-client.tsx has no console.log debug statements", () => {
    const layoutSrc = fs.readFileSync(
      path.join(root, "app/dashboard/layout-client.tsx"),
      "utf-8"
    );
    expect(layoutSrc).not.toMatch(/console\.log/);
  });
});
