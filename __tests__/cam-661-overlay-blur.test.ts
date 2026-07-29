/**
 * CAM-661 — every modal dims and blurs the page, in both themes
 *
 * Bug: `bg-foreground/15` on Dialog/Sheet/AlertDialog overlays inverted with
 * the theme (`--foreground` is near-black in light, near-white in dark), so
 * a modal in dark mode showed a WHITE film over the page instead of a dark
 * veil. Dialog additionally had no backdrop-blur at all.
 *
 * Fix: a theme-invariant `--overlay` token (registered as `bg-overlay`),
 * used identically (`bg-overlay/25 ... backdrop-blur-sm`) across all three
 * overlay components; `--foreground` is never used for a scrim again.
 *
 * Radius note: CAM-235 removed Dialog's blur entirely for modal open/close
 * GPU cost (its AC-5/AC-7). CAM-661 restores it at `-sm` (NOT `-md`, which
 * is strictly more GPU work) — the exact radius `sheet`/`alert-dialog` kept
 * through CAM-235 with no complaint, i.e. the proven-affordable ceiling.
 * See the updated AC-7 in cam-235-auth-modal-fixes.test.ts for the sibling
 * pin this supersedes.
 *
 * Layer: source-inspection (static parse of real production files) —
 * project-established pattern (cam-220/cam-229/cam-537 etc).
 *
 * Prove-It: before the fix, `bg-foreground/15` was present in all three
 * files and `bg-overlay` was absent everywhere (including globals.css) —
 * these assertions FAIL against the pre-fix source and PASS after.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const dialogSrc = readFileSync(
  join(process.cwd(), "components/ui/dialog.tsx"),
  "utf-8"
);
const sheetSrc = readFileSync(
  join(process.cwd(), "components/ui/sheet.tsx"),
  "utf-8"
);
const alertDialogSrc = readFileSync(
  join(process.cwd(), "components/ui/alert-dialog.tsx"),
  "utf-8"
);
const globalsCss = readFileSync(
  join(process.cwd(), "app/globals.css"),
  "utf-8"
);
const designMd = readFileSync(join(process.cwd(), "DESIGN.md"), "utf-8");

describe("CAM-661 — overlay token + blur", () => {
  it("[unit] globals.css declares --overlay exactly once in :root (no .dark twin)", () => {
    const matches = globalsCss.match(/--overlay:\s*oklch/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("[unit] globals.css registers --color-overlay so bg-overlay resolves", () => {
    expect(globalsCss).toMatch(/--color-overlay:\s*var\(--overlay\)/);
  });

  it("[unit] DialogOverlay uses bg-overlay and gains backdrop-blur-sm", () => {
    expect(dialogSrc).toMatch(/bg-overlay\/25/);
    expect(dialogSrc).toMatch(/backdrop-blur-sm/);
  });

  it("[unit] SheetOverlay uses bg-overlay and backdrop-blur-sm", () => {
    expect(sheetSrc).toMatch(/bg-overlay\/25/);
    expect(sheetSrc).toMatch(/backdrop-blur-sm/);
  });

  it("[unit] AlertDialogOverlay uses bg-overlay and backdrop-blur-sm", () => {
    expect(alertDialogSrc).toMatch(/bg-overlay\/25/);
    expect(alertDialogSrc).toMatch(/backdrop-blur-sm/);
  });

  it("[unit] no overlay component uses backdrop-blur-md (wrong direction vs CAM-235's GPU provenance)", () => {
    for (const src of [dialogSrc, sheetSrc, alertDialogSrc]) {
      expect(src).not.toMatch(/backdrop-blur-md/);
    }
  });

  it("[unit] all three overlay files carry the identical blur token (backdrop-blur-sm)", () => {
    const countBlurSm = (src: string) =>
      (src.match(/supports-backdrop-filter:backdrop-blur-sm/g) ?? []).length;
    expect(countBlurSm(dialogSrc)).toBe(1);
    expect(countBlurSm(sheetSrc)).toBe(1);
    expect(countBlurSm(alertDialogSrc)).toBe(1);
  });

  it("[unit] none of the three overlay components still use bg-foreground/15 (the theme-inverting bug)", () => {
    for (const src of [dialogSrc, sheetSrc, alertDialogSrc]) {
      expect(src).not.toMatch(/bg-foreground\/15/);
    }
  });

  it("[unit] the three overlay class strings are identical across components", () => {
    const extractOverlayClasses = (src: string) => {
      const m = src.match(/"fixed inset-0[^"]*"/);
      return m ? m[0].replace(/\bisolate\s/, "") : null;
    };
    const d = extractOverlayClasses(dialogSrc);
    const s = extractOverlayClasses(sheetSrc);
    const a = extractOverlayClasses(alertDialogSrc);
    expect(d).not.toBeNull();
    expect(d).toBe(s);
    expect(s).toBe(a);
  });

  it("[unit] DESIGN.md documents the bg-overlay rule, citing CAM-661", () => {
    expect(designMd).toMatch(/bg-overlay/);
    expect(designMd).toMatch(/CAM-661/);
  });
});
