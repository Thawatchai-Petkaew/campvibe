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
  // CAM-592 re-anchored this assertion. It originally pinned `px-1.5` — the
  // 6px padding CAM-590 COMPUTED to reach a symmetric box. CAM-592 replaced
  // that method with a scale-sized 44x44 square (`h-11 w-11`) + centred
  // content, so mobile symmetry is now structural and no horizontal padding
  // exists to pin. The test's job is unchanged (mobile is symmetric); only
  // the canonical mechanism it reads moved, so it is re-anchored, not
  // weakened — the box assertion is stricter than the padding one it
  // replaces. Full box geometry lives in __tests__/cam-592-*.
  it("[unit] the button's mobile geometry is symmetric by construction — a centred square, with no bare horizontal padding", () => {
    const buttonClassMatch = btnBlock.match(/<button className="([^"]*)"/);
    expect(buttonClassMatch).not.toBeNull();
    const className = buttonClassMatch![1];
    expect(className).toContain("justify-center");
    expect(className).toMatch(/\bh-11\b/);
    expect(className).toMatch(/\bw-11\b/);
    expect(className).toContain("py-1");
    // No bare (non-`md:`) horizontal padding of ANY kind may size this box —
    // symmetric or not. A bare `pl-3`/`pr-1` would reintroduce CAM-590's
    // asymmetry; a bare `px-*` would reintroduce CAM-592's computed padding.
    expect(className).not.toMatch(/(?<!md:)\bpl-3\b/);
    expect(className).not.toMatch(/(?<!md:)\bpr-1\b/);
    expect(className).not.toMatch(/(?<!md:)\bpx-[\d.]+\b/);
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
