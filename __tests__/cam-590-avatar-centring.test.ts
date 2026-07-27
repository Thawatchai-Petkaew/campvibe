/**
 * cam-590-avatar-centring.test.ts — CAM-590
 *
 * Source-level guard for the account-button padding fix. Real bounding-box
 * geometry (the avatar's left/right gap, the ≥44px floor in both
 * dimensions, and the 320px scrollWidth check) is proven in
 * e2e/regression/cam-590-avatar-centring.spec.ts; this file asserts the
 * SOURCE decouples mobile (symmetric) from desktop (unchanged, CAM-558's
 * original asymmetric split) padding, and that none of CAM-558's
 * neighbouring deliverables (logo, language switcher, hidden hamburger) were
 * disturbed.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const navbarSrc = fs.readFileSync(path.join(root, "components/Navbar.tsx"), "utf-8");

const btnBlock = navbarSrc.slice(
  navbarSrc.indexOf("DropdownMenuTrigger asChild"),
  navbarSrc.indexOf("</button>", navbarSrc.indexOf("DropdownMenuTrigger asChild")),
);

describe("AC-1 — mobile padding around the avatar is symmetric (BR-1)", () => {
  it("[unit] the button's base (mobile) padding is px-1.5 (6px each side), not the old asymmetric p-1 pl-3", () => {
    const buttonClassMatch = btnBlock.match(/<button className="([^"]*)"/);
    expect(buttonClassMatch).not.toBeNull();
    const className = buttonClassMatch![1];
    expect(className).toContain("px-1.5");
    expect(className).toContain("py-1");
    // The old bare (non-md:) asymmetric pair must be gone — a bare `pl-3`
    // or `pr-1` outside an `md:` prefix would reintroduce the mobile
    // asymmetry this story fixes.
    expect(className).not.toMatch(/(?<!md:)\bpl-3\b/);
    expect(className).not.toMatch(/(?<!md:)\bpr-1\b/);
    expect(className).not.toContain("p-1 pl-3");
  });

  it("[unit] the avatar wrapper carries a stable testid for geometry measurement", () => {
    expect(btnBlock).toContain('data-testid="section--navbar-account-avatar"');
  });
});

describe("AC-4 — desktop padding is restored byte-for-byte (BR-1)", () => {
  it("[unit] md:pl-3 md:pr-1 reproduce the exact original desktop split (12px left / 4px right)", () => {
    const buttonClassMatch = btnBlock.match(/<button className="([^"]*)"/);
    const className = buttonClassMatch![1];
    expect(className).toContain("md:pl-3");
    expect(className).toContain("md:pr-1");
  });
});

describe("AC-2 — the button's own tap-target height fix (CAM-558) is untouched (BR-2)", () => {
  it("[unit] h-11 and the border/rounded-full styling are unchanged", () => {
    expect(btnBlock).toContain("h-11");
    expect(btnBlock).toContain("border border-border rounded-full");
  });
});

describe("Regression guard — CAM-558's neighbouring deliverables are unchanged", () => {
  it("[unit] the hamburger stays hidden below md, unresized (BR-1 EC-3)", () => {
    expect(btnBlock).toContain('<Menu className="hidden md:block w-5 h-5 text-muted-foreground" />');
  });

  it("[unit] the avatar image / fallback icon sizes are unchanged (no glyph growth)", () => {
    expect(btnBlock).toContain('className="w-8 h-8 rounded-full object-cover"');
    expect(btnBlock).toContain("<User className=\"w-6 h-6 text-muted-foreground\" />");
  });

  it("[unit] the logo link's 44px tap-target fix (CAM-558) is untouched", () => {
    const logoBlock = navbarSrc.slice(navbarSrc.indexOf("<Link"), navbarSrc.indexOf("logo.png") + 40);
    expect(logoBlock).toContain("min-h-11 min-w-11");
    expect(navbarSrc).toContain('className="h-8 md:h-10 w-auto"');
  });

  it("[unit] the language switcher stays desktop-only (hidden md:flex), unresized here", () => {
    expect(navbarSrc).toContain('<div className="hidden md:flex">\n                            <LanguageSwitcher />');
  });
});
