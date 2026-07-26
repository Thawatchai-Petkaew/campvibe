/**
 * cam-570-thai-aria-labels.test.ts — CAM-570
 *
 * Defect: the camp-card image carousel arrows, the navbar account-menu
 * trigger, and the language switcher carried HARDCODED ENGLISH aria-label
 * string literals. A Thai user on a screen reader heard English for those
 * controls while the rest of the page read Thai.
 *
 * Fix: every one of those labels now resolves from `locales/translations.json`
 * (the single i18n source of truth), same as every other user-facing string
 * in this codebase.
 *
 * Source-inspection + translation-source tests (matching repo style: see
 * cam-240-b2-navbar-session.test.ts). The vitest environment is "node" — no
 * DOM renderer.
 *
 * Prove-It notes (mirrors the exact bug class this ticket fixes):
 *   - A test that only checked the Thai side would pass if the fix had
 *     hardcoded THAI instead of English (the same bug, mirrored) — every
 *     assertion below checks BOTH `en` and `th`, and that they are not the
 *     same literal string (a real translation, not one value copy-pasted
 *     into both language slots).
 *   - The source-literal guard FAILS if any of the four labels is
 *     re-hardcoded as a JSX string-literal attribute in the touched files.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";

const root = process.cwd();
const src = (relPath: string) => fs.readFileSync(path.join(root, relPath), "utf-8");

const campCardSrc = src("components/CampgroundCard.tsx");
const navbarSrc = src("components/Navbar.tsx");
const languageSwitcherSrc = src("components/LanguageSwitcher.tsx");

const THAI_SCRIPT = /[ก-๙]/;

// ===========================================================================
// Translation source — both languages resolve, and are genuinely distinct
// (guards against the "hardcoded Thai instead of English" mirror bug).
// ===========================================================================

describe("CAM-570 — translation source carries both languages for every moved label", () => {
  it("[i18n] gallery.previousImage (camp-card left arrow) resolves EN + distinct Thai", () => {
    expect(translations.en.gallery.previousImage).toBe("Previous photo");
    expect(translations.th.gallery.previousImage).toMatch(THAI_SCRIPT);
    expect(translations.th.gallery.previousImage).not.toBe(translations.en.gallery.previousImage);
  });

  it("[i18n] gallery.nextImage (camp-card right arrow) resolves EN + distinct Thai", () => {
    expect(translations.en.gallery.nextImage).toBe("Next photo");
    expect(translations.th.gallery.nextImage).toMatch(THAI_SCRIPT);
    expect(translations.th.gallery.nextImage).not.toBe(translations.en.gallery.nextImage);
  });

  it("[i18n] nav.accountMenuAriaLabel (navbar avatar dropdown trigger) resolves EN + distinct Thai", () => {
    expect(translations.en.nav.accountMenuAriaLabel).toBe("Account menu");
    expect(translations.th.nav.accountMenuAriaLabel).toMatch(THAI_SCRIPT);
    expect(translations.th.nav.accountMenuAriaLabel).not.toBe(translations.en.nav.accountMenuAriaLabel);
  });

  it("[i18n] nav.switchLanguageAriaLabel (language switcher) resolves EN + distinct Thai", () => {
    expect(translations.en.nav.switchLanguageAriaLabel).toBe("Switch language");
    expect(translations.th.nav.switchLanguageAriaLabel).toMatch(THAI_SCRIPT);
    expect(translations.th.nav.switchLanguageAriaLabel).not.toBe(translations.en.nav.switchLanguageAriaLabel);
  });

  // Neither new key is an empty/whitespace placeholder in either language.
  it("[i18n] none of the four moved labels is empty in either language", () => {
    const pairs: Array<[string, string]> = [
      [translations.en.gallery.previousImage, translations.th.gallery.previousImage],
      [translations.en.gallery.nextImage, translations.th.gallery.nextImage],
      [translations.en.nav.accountMenuAriaLabel, translations.th.nav.accountMenuAriaLabel],
      [translations.en.nav.switchLanguageAriaLabel, translations.th.nav.switchLanguageAriaLabel],
    ];
    for (const [en, th] of pairs) {
      expect(en.trim().length).toBeGreaterThan(0);
      expect(th.trim().length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Source wiring — the components read from the translation source, not a
// hardcoded literal.
// ===========================================================================

describe("CAM-570 — CampgroundCard carousel arrows read from the translation source", () => {
  it("[source] previous-image arrow reads t.gallery.previousImage", () => {
    expect(campCardSrc).toContain("aria-label={t.gallery.previousImage}");
  });

  it("[source] next-image arrow reads t.gallery.nextImage", () => {
    expect(campCardSrc).toContain("aria-label={t.gallery.nextImage}");
  });

  // Prove-It: FAILS if either arrow's aria-label is re-hardcoded as a string literal.
  it("[source] no hardcoded English literal survives on the arrow buttons", () => {
    expect(campCardSrc).not.toMatch(/aria-label="Previous image"/);
    expect(campCardSrc).not.toMatch(/aria-label="Next image"/);
  });
});

describe("CAM-570 — Navbar account-menu trigger reads from the translation source", () => {
  it("[source] DropdownMenuTrigger reads t.nav.accountMenuAriaLabel", () => {
    expect(navbarSrc).toContain("aria-label={t.nav.accountMenuAriaLabel}");
  });

  // Prove-It: FAILS if the trigger's aria-label is re-hardcoded as a string literal.
  it("[source] no hardcoded English literal survives on the account-menu trigger", () => {
    expect(navbarSrc).not.toMatch(/aria-label="User menu"/);
  });
});

describe("CAM-570 — LanguageSwitcher reads from the translation source", () => {
  it("[source] useLanguage() destructures t alongside language/setLanguage", () => {
    expect(languageSwitcherSrc).toMatch(/const\s*\{\s*language,\s*setLanguage,\s*t\s*\}\s*=\s*useLanguage\(\)/);
  });

  it("[source] the toggle button reads t.nav.switchLanguageAriaLabel", () => {
    expect(languageSwitcherSrc).toContain("aria-label={t.nav.switchLanguageAriaLabel}");
  });

  // Prove-It: FAILS if the button's aria-label is re-hardcoded as a string literal.
  it("[source] no hardcoded English literal survives on the language toggle", () => {
    expect(languageSwitcherSrc).not.toMatch(/aria-label="Switch language"/);
  });
});

// ===========================================================================
// General sweep guard — no plain string-literal aria-label attribute remains
// anywhere in the three files this story touched (catches ANY hardcoded
// aria-label, not just the four named ones, if one is reintroduced later).
// ===========================================================================

describe("CAM-570 — no string-literal aria-label remains in the touched files", () => {
  const NO_LITERAL_ARIA_LABEL = /aria-label="[^{]/;

  it("[source] CampgroundCard.tsx has zero string-literal aria-label attributes", () => {
    expect(campCardSrc).not.toMatch(NO_LITERAL_ARIA_LABEL);
  });

  it("[source] Navbar.tsx has zero string-literal aria-label attributes", () => {
    expect(navbarSrc).not.toMatch(NO_LITERAL_ARIA_LABEL);
  });

  it("[source] LanguageSwitcher.tsx has zero string-literal aria-label attributes", () => {
    expect(languageSwitcherSrc).not.toMatch(NO_LITERAL_ARIA_LABEL);
  });
});
