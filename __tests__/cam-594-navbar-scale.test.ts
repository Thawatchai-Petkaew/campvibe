/**
 * cam-594-navbar-scale.test.ts — CAM-594 (+ CAM-593, merged)
 *
 * Two faults over the same rows, so one story:
 *  - CAM-593: the title row kept `h-20`, the DESKTOP value, because CAM-552
 *    defined the mobile step while the navbar sat outside its file surface.
 *    The mobile search bar's 54px was not a chosen number at all — it was
 *    `py-3` plus whatever the tallest child happened to be.
 *  - CAM-594: at a 150% text scale the same row overflowed the viewport, with
 *    `scrollWidth` a near-constant 452px at BOTH 320px and 390px.
 *
 * These are SOURCE pins for the two things a grep can actually prove: the
 * values come from DESIGN.md §2.0 rather than being hand-picked, and the row
 * carries the wrap + `min-h` shape (a fixed `h-` below `md` would clip the
 * wrapped line). Real geometry — 64px/44px, 0px overflow at 320/390 at BOTH
 * text scales, every tap target >=44px, the CategoryBar sticky offset — is
 * measured in e2e/regression/cam-594-navbar-scale-and-overflow.spec.ts.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const navbarSrc = fs.readFileSync(path.join(root, "components/Navbar.tsx"), "utf-8");
const categoryBarSrc = fs.readFileSync(path.join(root, "components/CategoryBar.tsx"), "utf-8");
const designSrc = fs.readFileSync(path.join(root, "DESIGN.md"), "utf-8");

function classNameOfTestId(src: string, testId: string): string {
  const at = src.indexOf(`data-testid="${testId}"`);
  expect(at, `element with data-testid="${testId}" not found`).toBeGreaterThan(-1);
  const match = src.slice(at).match(/className="([^"]*)"/);
  expect(match, `no className on ${testId}`).not.toBeNull();
  return match![1];
}

const titleRowClass = classNameOfTestId(navbarSrc, "section--navbar-title-row");
const searchBlockClass = classNameOfTestId(navbarSrc, "section--navbar-search-mobile");

// The tappable pill INSIDE the sticky search block (the block is the padding
// wrapper; the pill is the control whose height the owner asked about).
const searchPillClass = (() => {
  const at = navbarSrc.indexOf('data-testid="section--navbar-search-mobile"');
  const pill = navbarSrc.slice(at).match(/onClick=\{\(\) => setIsSearchOpen\(true\)\}\s*\n\s*className="([^"]*)"/);
  expect(pill, "mobile search pill className not found").not.toBeNull();
  return pill![1];
})();

describe("AC-1/BR-1 — the title row takes its height from the §2.0 scale, with a mobile step", () => {
  it("[unit] the row is min-h-16 below md and md:h-20 above it (64/80px)", () => {
    expect(titleRowClass).toMatch(/\bmin-h-16\b/);
    expect(titleRowClass).toMatch(/\bmd:h-20\b/);
  });

  it("[unit] the bare (mobile) h-20 desktop value is gone from the row", () => {
    // The exact defect: `h-20` with no `md:` prefix applied the desktop value
    // at every viewport. A `md:h-20` must not satisfy this.
    expect(titleRowClass).not.toMatch(/(?<!md:)(?<!min-)\bh-20\b/);
  });

  it("[unit] the height is a min-, not a fixed h-, below md — a fixed height clips the wrapped line", () => {
    expect(titleRowClass).not.toMatch(/(?<!md:)(?<!min-)\bh-\d+\b/);
  });
});

describe("AC-2/BR-3 — the row wraps rather than overflowing at an increased text scale", () => {
  it("[unit] the row wraps below md and returns to nowrap at md (desktop unchanged)", () => {
    expect(titleRowClass).toMatch(/\bflex-wrap\b/);
    expect(titleRowClass).toMatch(/\bmd:flex-nowrap\b/);
  });

  it("[unit] the trailing group stays right-aligned on the line it wraps to, desktop restored", () => {
    // justify-between puts a LONE item on a line at flex-start, so without
    // this the account icons would wrap to the left, under the logo.
    const at = navbarSrc.indexOf("{/* User Menu */}");
    expect(at).toBeGreaterThan(-1);
    const group = navbarSrc.slice(at, navbarSrc.indexOf("<LanguageSwitcher", at));
    expect(group).toMatch(/\bms-auto\b/);
    expect(group).toMatch(/\bmd:ms-0\b/);
  });

  it("[unit] BR-3: the fix wraps items, it does not drop any — the mobile-hidden set is unchanged", () => {
    // The wishlist link must carry no mobile-hidden wrapper of its own.
    const wishlistBlock = navbarSrc.slice(
      navbarSrc.indexOf('data-testid="btn--wishlist-nav"') - 260,
      navbarSrc.indexOf('data-testid="btn--wishlist-nav"'),
    );
    expect(wishlistBlock).not.toContain("hidden md:");

    // Exactly three elements are hidden below `md`, all three pre-existing and
    // each for its own stated reason. A FOURTH would mean this story bought
    // its headroom by dropping a control instead of wrapping the row (BR-3).
    const hiddenBelowMd = navbarSrc.match(/\bhidden md:(flex|block)\b/g) ?? [];
    expect(hiddenBelowMd).toHaveLength(3);
    expect(navbarSrc).toContain("hidden md:flex flex-grow"); // desktop centre search bar
    expect(navbarSrc).toContain('<div className="hidden md:flex">'); // CAM-549 language switcher
    expect(navbarSrc).toContain('<Menu className="hidden md:block'); // CAM-558 hamburger glyph
  });
});

describe("AC-1/AC-4/BR-2 — the search bar is sized from the scale and lands on the touch floor", () => {
  it("[unit] the pill is h-11 — simultaneously the 44px floor and the §2.0 `md` control height", () => {
    expect(searchPillClass).toMatch(/\bh-11\b/);
  });

  it("[unit] no vertical padding is left to compute the pill's height from", () => {
    // The 54px was `py-3` + the tallest child. Pinning the box and centring
    // the content is the CAM-592 rule; there must be no py-/p- left to drift.
    expect(searchPillClass).not.toMatch(/\bpy-[\d.]+\b/);
    expect(searchPillClass).not.toMatch(/(?<!\w)p-[\d.]+\b/);
    expect(searchPillClass).toContain("items-center");
  });

  it("[unit] EC-4: the label truncates on one line instead of growing the fixed box", () => {
    const at = navbarSrc.indexOf("{t.search.anywhere}");
    expect(at).toBeGreaterThan(-1);
    const span = navbarSrc.slice(navbarSrc.lastIndexOf("<span", at), at);
    expect(span).toContain("truncate");
    // min-w-0 is load-bearing: a flex item's default min-width:auto refuses to
    // shrink below its text, so `truncate` would never engage without it.
    expect(span).toContain("min-w-0");
  });

  it("[unit] the sticky block's own padding steps to py-2 (was pt-3 pb-3)", () => {
    expect(searchBlockClass).toMatch(/\bpy-2\b/);
    expect(searchBlockClass).not.toMatch(/\bpt-3\b/);
    expect(searchBlockClass).not.toMatch(/\bpb-3\b/);
  });
});

describe("AC-3/AC-5/BR-4/EC-3 — the CategoryBar sticky trap is defused by construction", () => {
  it("[unit] the desktop row height stays 80px, which is what md:top-20 offsets against", () => {
    // CAM-549's defect: the strip's sticky offset assumed an 80px navbar. The
    // offset lives in app/page.tsx (outside this story's surface), so the ONLY
    // safe way to change the header is to change it below md, where the strip
    // is not sticky at all, and leave md:h-20 exactly as it was.
    expect(titleRowClass).toContain("md:h-20");
    const pageSrc = fs.readFileSync(path.join(root, "app/page.tsx"), "utf-8");
    expect(pageSrc).toContain("md:sticky md:top-20");
  });

  it("[unit] CategoryBar.tsx itself is untouched by this story (CAM-552/CAM-560 geometry)", () => {
    expect(categoryBarSrc).toContain("pt-3 pb-0 md:pt-4 flex items-center gap-6 md:gap-8");
    expect(categoryBarSrc).toContain("min-w-[56px] md:min-w-[64px] shrink-0 pb-2 md:pb-3");
  });
});

describe("Regression guard — the neighbouring stories' work is unchanged", () => {
  it("[unit] CAM-558: the logo link keeps its 44px tap target and the image is unresized", () => {
    const logoBlock = navbarSrc.slice(navbarSrc.indexOf("<Link"), navbarSrc.indexOf("logo.png") + 40);
    expect(logoBlock).toContain("min-h-11 min-w-11");
    expect(navbarSrc).toContain('className="h-8 md:h-10 w-auto"');
  });

  it("[unit] CAM-590/CAM-592: the account trigger is still a 44x44 square below md", () => {
    const btnBlock = navbarSrc.slice(
      navbarSrc.indexOf("DropdownMenuTrigger asChild"),
      navbarSrc.indexOf("</button>", navbarSrc.indexOf("DropdownMenuTrigger asChild")),
    );
    expect(btnBlock).toContain("h-11 w-11 md:w-auto");
    expect(btnBlock).toContain("justify-center md:justify-start");
  });

  it("[unit] CAM-558: the wishlist link on this same row still uses the w-11 h-11 box", () => {
    const wishlistBlock = navbarSrc.slice(
      navbarSrc.indexOf('data-testid="btn--wishlist-nav"'),
      navbarSrc.indexOf("</Link>", navbarSrc.indexOf('data-testid="btn--wishlist-nav"')),
    );
    expect(wishlistBlock).toContain("w-11 h-11");
  });

  it("[unit] CAM-549: the language switcher stays desktop-only", () => {
    expect(navbarSrc).toContain('<div className="hidden md:flex">\n                            <LanguageSwitcher />');
  });

  it("[unit] CAM-549: the sticky search block is still a SIBLING of <nav>, pinned at top-0", () => {
    expect(searchBlockClass).toContain("md:hidden sticky top-0 z-50");
    expect(navbarSrc.indexOf("</nav>")).toBeLessThan(
      navbarSrc.indexOf('data-testid="section--navbar-search-mobile"'),
    );
  });

  it("[unit] CAM-570: the navbar's aria-labels still come from i18n, not hardcoded strings", () => {
    expect(navbarSrc).toMatch(/aria-label=\{t\.nav\.accountMenuAriaLabel\}/);
    expect(navbarSrc).toMatch(/aria-label=\{t\.wishlist\.navAriaLabel\}/);
  });
});

describe("BR-1 — DESIGN.md §2.0 carries the rows and the rule these values come from", () => {
  const scaleSection = designSrc.slice(
    designSrc.indexOf("### §2.0 Responsive scale"),
    designSrc.indexOf("### Radius"),
  );

  it("[unit] §2.0 lists the header/bar row block and the sticky bar padding-y steps", () => {
    expect(scaleSection).toMatch(/header \/ bar row block.*`min-h-16`.*`md:h-20`/);
    expect(scaleSection).toMatch(/sticky bar block padding-y.*`py-2`.*`md:py-3`/);
  });

  it("[unit] §2.0 states the wrap-don't-overflow rule and names its measurable signature", () => {
    expect(scaleSection).toContain("A no-give row wraps; it never overflows");
    expect(scaleSection).toMatch(/`scrollWidth` stays near-constant regardless of viewport width/);
    expect(scaleSection).toContain("flex-wrap md:flex-nowrap");
  });

  it("[unit] the 44px floor still outranks compaction in §2.0 (unchanged, and this story obeys it)", () => {
    expect(scaleSection).toContain("Touch floor — 44 × 44px at every viewport");
  });
});
