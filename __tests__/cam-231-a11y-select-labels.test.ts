/**
 * A11Y-1 — accessible name on home-surface Select triggers (CAM-231)
 *
 * Layer: unit (static source inspection — vitest env is 'node').
 * Mirrors the approach used in __tests__/ds1-dropdown-grammar.test.ts.
 *
 * AC→test map:
 *  AC-a11y-1   SortDropdown SelectTrigger has aria-label attribute
 *  AC-a11y-2   SortDropdown SelectTrigger aria-label sources from t.sort.sortBy (i18n key)
 *  AC-a11y-3   SortDropdown aria-label is not hardcoded (no string literal in the prop)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const sortDropdownSrc = src("components/SortDropdown.tsx");

describe("a11y--sort-dropdown: SelectTrigger accessible name (AC-a11y-1/2/3)", () => {
  it("AC-a11y-1: SortDropdown SelectTrigger has aria-label attribute", () => {
    expect(sortDropdownSrc).toMatch(/SelectTrigger[\s\S]*?aria-label=/);
  });

  it("AC-a11y-2: SortDropdown SelectTrigger aria-label sources from t.sort.sortBy (i18n key)", () => {
    // aria-label must reference the i18n key t.sort.sortBy, not a hardcoded string
    expect(sortDropdownSrc).toMatch(/aria-label=\{t\.sort\.sortBy\}/);
  });

  it("AC-a11y-3: SortDropdown aria-label is not hardcoded (no bare string literal \"Sort by\" or \"จัดเรียงตาม\")", () => {
    // Ensure no hardcoded Thai or English copy in the aria-label prop
    expect(sortDropdownSrc).not.toMatch(/aria-label=["']Sort by["']/);
    expect(sortDropdownSrc).not.toMatch(/aria-label=["']จัดเรียงตาม["']/);
  });
});

describe("a11y--sort-dropdown: i18n key exists in translations (AC-a11y-2 data contract)", () => {
  const translationsSrc = src("locales/translations.json");

  it("translations.json EN contains sort.sortBy key", () => {
    // The EN section must have a non-empty value for sort.sortBy
    const parsed = JSON.parse(translationsSrc);
    expect(parsed.en?.sort?.sortBy).toBeTruthy();
  });

  it("translations.json TH contains sort.sortBy key", () => {
    // The TH section must have a non-empty value for sort.sortBy
    const parsed = JSON.parse(translationsSrc);
    expect(parsed.th?.sort?.sortBy).toBeTruthy();
  });
});
