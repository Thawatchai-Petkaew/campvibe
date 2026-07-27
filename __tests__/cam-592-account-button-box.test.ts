/**
 * cam-592-account-button-box.test.ts — CAM-592
 *
 * CAM-590 computed a padding to reach a target size (`px-1.5` = 6px, a
 * half-step off the 4px rhythm; 6+32+6+2px border = a 46px box nobody
 * chose). CAM-592 sizes the box FROM the scale instead: `h-11 w-11` = a
 * 44x44 square with the 32px avatar centred by flex.
 *
 * These guards deliberately pin the BOX, never a padding value. That is the
 * teeth: a future change cannot reintroduce a computed padding and satisfy
 * these assertions by arriving at the same total, because there is no
 * padding number here to satisfy — the square and the ABSENCE of bare
 * horizontal padding are both asserted.
 *
 * Real bounding-box geometry (44x44 exactly, gaps 6/6, the 320px
 * scrollWidth check, desktop unchanged, and all of it re-checked at 150%
 * root font-size) is proven in e2e/regression/cam-590-avatar-centring.spec.ts.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const navbarSrc = fs.readFileSync(path.join(root, "components/Navbar.tsx"), "utf-8");
const designSrc = fs.readFileSync(path.join(root, "DESIGN.md"), "utf-8");

const btnBlock = navbarSrc.slice(
  navbarSrc.indexOf("DropdownMenuTrigger asChild"),
  navbarSrc.indexOf("</button>", navbarSrc.indexOf("DropdownMenuTrigger asChild")),
);

function accountButtonClassName(): string {
  const match = btnBlock.match(/<button className="([^"]*)"/);
  expect(match, "account-menu trigger <button className> not found").not.toBeNull();
  return match![1];
}

describe("AC-1/BR-1 — the avatar-only trigger is a square sized from the scale", () => {
  it("[unit] the box is pinned h-11 w-11 (44x44), both operands on the scale", () => {
    const className = accountButtonClassName();
    expect(className).toMatch(/\bh-11\b/);
    expect(className).toMatch(/\bw-11\b/);
  });

  it("[unit] the content is centred by flex, not positioned by padding", () => {
    const className = accountButtonClassName();
    expect(className).toContain("flex");
    expect(className).toContain("items-center");
    expect(className).toContain("justify-center");
  });

  it("[unit] the 32px avatar is unchanged — the BOX was resized, not the glyph", () => {
    expect(btnBlock).toContain('className="w-8 h-8 rounded-full object-cover"');
    expect(btnBlock).toContain('<User className="w-6 h-6 text-muted-foreground" />');
  });
});

describe("EC-4/BR-1 — a computed padding cannot come back below `md`", () => {
  it("[unit] no bare (non-md:) horizontal padding utility participates in the width", () => {
    const className = accountButtonClassName();
    // px-*, pl-*, pr-* — every horizontal padding shape, symmetric or not.
    // `md:`-prefixed ones are the desktop shape and are asserted present below.
    expect(className).not.toMatch(/(?<!md:)\bpx-[\d.]+\b/);
    expect(className).not.toMatch(/(?<!md:)\bpl-[\d.]+\b/);
    expect(className).not.toMatch(/(?<!md:)\bpr-[\d.]+\b/);
    // The all-sides shorthand would silently reintroduce horizontal padding too.
    expect(className).not.toMatch(/(?<!md:)\bp-[\d.]+\b/);
  });

  it("[unit] the specific values from the two previous attempts are both gone below md", () => {
    const className = accountButtonClassName();
    expect(className).not.toMatch(/(?<!md:)\bpx-1\.5\b/); // CAM-590's computed 6px
    expect(className).not.toContain("p-1 pl-3"); // CAM-558-era asymmetric pair
  });
});

describe("AC-4/BR-2 — the desktop shape (hamburger + avatar) is untouched", () => {
  it("[unit] width returns to content-driven at md:, with the original asymmetric padding", () => {
    const className = accountButtonClassName();
    expect(className).toContain("md:w-auto");
    expect(className).toContain("md:justify-start");
    expect(className).toContain("md:pl-3");
    expect(className).toContain("md:pr-1");
    expect(className).toContain("gap-2");
    expect(className).toContain("py-1");
  });

  it("[unit] the hamburger still renders only at md: and above, unresized (CAM-558 BR-5)", () => {
    expect(btnBlock).toContain('<Menu className="hidden md:block w-5 h-5 text-muted-foreground" />');
  });

  it("[unit] the button keeps its border/rounded-full styling (the 44px height is CAM-558's)", () => {
    expect(btnBlock).toContain("border border-border rounded-full");
  });
});

describe("Regression guard — CAM-558's and CAM-570's neighbouring work is unchanged", () => {
  it("[unit] CAM-558: the logo link keeps its own 44px tap target, image unresized", () => {
    const logoBlock = navbarSrc.slice(navbarSrc.indexOf("<Link"), navbarSrc.indexOf("logo.png") + 40);
    expect(logoBlock).toContain("min-h-11 min-w-11");
    expect(navbarSrc).toContain('className="h-8 md:h-10 w-auto"');
  });

  it("[unit] CAM-558: the language switcher stays desktop-only, unresized here", () => {
    expect(navbarSrc).toContain('<div className="hidden md:flex">\n                            <LanguageSwitcher />');
  });

  it("[unit] CAM-558: the wishlist link on this same row still uses the w-11 h-11 box", () => {
    const wishlistBlock = navbarSrc.slice(
      navbarSrc.indexOf('data-testid="btn--wishlist-nav"'),
      navbarSrc.indexOf("</Link>", navbarSrc.indexOf('data-testid="btn--wishlist-nav"')),
    );
    expect(wishlistBlock).toContain("w-11 h-11");
  });

  // CAM-570 moved the navbar's aria-labels into locales/translations.json.
  // This story resizes the trigger this label sits on, so the label staying
  // i18n-sourced (not reverted to a hardcoded string) is the neighbouring
  // deliverable worth guarding here. The language switcher's own label lives
  // in components/LanguageSwitcher.tsx and is already guarded by
  // __tests__/cam-558-touch-floor.test.ts against that file's source.
  it("[unit] CAM-570: the account menu's label still comes from i18n, not a hardcoded string", () => {
    expect(navbarSrc).toMatch(/aria-label=\{t\.nav\.accountMenuAriaLabel\}/);
    expect(btnBlock).not.toMatch(/aria-label="[^"]+"/);
  });
});

describe("AC-5/BR-4 — DESIGN.md §2.0 states the sizing method outright", () => {
  it("[unit] the size-from-scale / centre-the-content rule is present in §2.0", () => {
    const scaleSection = designSrc.slice(
      designSrc.indexOf("### §2.0 Responsive scale"),
      designSrc.indexOf("### Radius"),
    );
    expect(scaleSection.length).toBeGreaterThan(0);
    expect(scaleSection).toContain("Size from the scale; centre the content.");
    expect(scaleSection).toMatch(/never compute a padding to reach a target size/);
  });

  it("[unit] the rule sits ahead of the control-height table, where a height is actually chosen", () => {
    const ruleIndex = designSrc.indexOf("Size from the scale; centre the content.");
    const tableIndex = designSrc.indexOf("**Control height**");
    expect(ruleIndex).toBeGreaterThan(-1);
    expect(tableIndex).toBeGreaterThan(-1);
    expect(ruleIndex).toBeLessThan(tableIndex);
  });
});
