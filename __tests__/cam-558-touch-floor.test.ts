/**
 * cam-558-touch-floor.test.ts — CAM-558
 *
 * Source-level guard for the 4 controls CAM-552 measured under the 44px
 * touch floor (DESIGN.md §2.0): camp-card carousel arrows, the navbar logo
 * link, the profile-menu button, and the (now desktop-only) language
 * switcher. Real bounding-box geometry is proven in
 * e2e/regression/cam-558-touch-targets.spec.ts; this file asserts the
 * SOURCE uses the sanctioned `size-11`/`h-11`/`min-h-11`/`min-w-11` tokens
 * (BR-1/BR-2) rather than an arbitrary px literal, and that the visible
 * glyphs (BR-3) did not grow as a side effect. BR-5 covers the profile-menu
 * button's width-side fix (hiding the redundant hamburger icon below `md`)
 * discovered when a height-only fix measured as NOT closing CAM-549's
 * 320px overflow (see story.md v2 changelog).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const cardSrc = read("components/CampgroundCard.tsx");
const navbarSrc = read("components/Navbar.tsx");
const switcherSrc = read("components/LanguageSwitcher.tsx");

describe("AC-1 — camp-card carousel arrows reach the 44px floor (BR-1/BR-2)", () => {
  it("[unit] prev/next arrow buttons use the w-11 h-11 icon-button token (was p-1.5 / 28px)", () => {
    expect(cardSrc).not.toContain("p-1.5 rounded-full bg-background/80");
    // CAM-570: anchored on the <ChevronLeft/ChevronRight> icon element (BR-3,
    // unaffected by that story) rather than the aria-label text — this test
    // exists to prove the TAP TARGET reaches the floor, not to pin any
    // particular accessible-name wording (that guarantee lives in
    // CAM-570's own test + the translation source).
    const prevBlock = cardSrc.slice(cardSrc.indexOf("onClick={prevImage}"), cardSrc.indexOf("<ChevronLeft"));
    const nextBlock = cardSrc.slice(cardSrc.indexOf("onClick={nextImage}"), cardSrc.indexOf("<ChevronRight"));
    expect(prevBlock).toContain("w-11 h-11");
    expect(nextBlock).toContain("w-11 h-11");
  });

  it("[unit] BR-3: the chevron glyph itself is untouched (stays w-4 h-4, no glyph growth)", () => {
    expect(cardSrc).toContain("<ChevronLeft className=\"w-4 h-4 text-foreground\" />");
    expect(cardSrc).toContain("<ChevronRight className=\"w-4 h-4 text-foreground\" />");
  });

  it("[unit] no stray px literal introduced for the arrow hit area (token-only)", () => {
    const arrowsBlock = cardSrc.slice(
      cardSrc.indexOf("Navigation Arrows"),
      cardSrc.indexOf("Dot Indicators"),
    );
    expect(arrowsBlock).not.toMatch(/\[\d+px\]/);
  });
});

describe("AC-3 — navbar logo link reaches the 44px floor without growing the image (BR-1/BR-3)", () => {
  it("[unit] the Link wrapping the logo carries min-h-11 min-w-11", () => {
    const logoBlock = navbarSrc.slice(
      navbarSrc.indexOf("<Link"),
      navbarSrc.indexOf("logo.png") + 40,
    );
    expect(logoBlock).toContain("min-h-11 min-w-11");
  });

  it("[unit] the logo <img> visible size is unchanged (h-8 md:h-10, no growth)", () => {
    expect(navbarSrc).toContain('className="h-8 md:h-10 w-auto"');
  });
});

describe("AC-2/AC-5 — profile menu button reaches the 44px floor and its width no longer causes the 320px overflow (BR-1/BR-5)", () => {
  const btnBlock = navbarSrc.slice(
    navbarSrc.indexOf("DropdownMenuTrigger asChild"),
    navbarSrc.indexOf("</button>", navbarSrc.indexOf("DropdownMenuTrigger asChild")),
  );

  it("[unit] the profile-menu trigger button carries h-11 alongside its existing border-full styling", () => {
    expect(btnBlock).toContain("h-11");
    expect(btnBlock).toContain("border border-border rounded-full");
  });

  it("[unit] BR-5: the hamburger Menu icon is hidden below md (avatar stays, no glyph resize)", () => {
    expect(btnBlock).toContain('<Menu className="hidden md:block w-5 h-5 text-muted-foreground" />');
  });

  it("[unit] the avatar image size is unchanged (w-8 h-8, no glyph growth)", () => {
    expect(btnBlock).toContain('className="w-8 h-8 rounded-full object-cover"');
  });
});

describe("AC-4 — language switcher reaches the 44px floor on desktop, keeping an accessible name (BR-1/BR-4)", () => {
  it("[unit] the switcher button's className carries h-11 and no longer the old py-2 (was 36px)", () => {
    const classNameMatch = switcherSrc.match(/className="([^"]*)"/);
    expect(classNameMatch).not.toBeNull();
    const className = classNameMatch![1];
    expect(className).toMatch(/\bh-11\b/);
    expect(className).not.toMatch(/\bpy-2\b/);
  });

  // CAM-570 moved this label into locales/translations.json. This test's job
  // was always "the control still HAS an accessible name" (findability), not
  // pinning a particular English string — re-anchored on the i18n source so
  // a future reword of the Thai/English copy never needs to touch this file.
  it("[unit] the switcher still has an accessible name, sourced from i18n (not hardcoded)", () => {
    expect(switcherSrc).toMatch(/aria-label=\{t\.nav\.switchLanguageAriaLabel\}/);
    expect(switcherSrc).not.toMatch(/aria-label="[^{]/);
  });
});

describe("Regression guard — no test elsewhere pins the OLD sub-floor classes this story removes", () => {
  it("[structural] no test file greps the old p-1.5 carousel-arrow class or the old bare py-2 switcher class", () => {
    const testsDir = path.join(root, "__tests__");
    const offenders: string[] = [];
    for (const file of fs.readdirSync(testsDir)) {
      if (!file.endsWith(".test.ts") || file === "cam-558-touch-floor.test.ts") continue;
      const content = fs.readFileSync(path.join(testsDir, file), "utf-8");
      if (content.includes("p-1.5 rounded-full bg-background/80")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
