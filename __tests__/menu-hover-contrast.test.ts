/**
 * Menu & select hover-contrast regression (light mode).
 *
 * Layer: unit (static source / fs inspection, execSync — vitest env 'node').
 *
 * Bug: dropdown / select call sites overrode the design-system's built-in
 * `focus:bg-accent` highlight with `focus:bg-muted`. In light mode `--muted`
 * (oklch 0.963) is ~indistinguishable from the white popover (`--popover:
 * oklch(1 0 0)`), so the hover/keyboard highlight was nearly invisible — and
 * item text (still the primitive's near-white `accent-foreground`) washed out
 * against it too.
 *
 * Fix: drop the overrides so the DropdownMenuItem / SelectItem primitives'
 * default `focus:bg-accent focus:text-accent-foreground` (solid brand-teal +
 * near-white text, AA contrast) takes over. The rich Command / LocationPicker
 * combobox row — whose inner content uses hard-coded dark text + coloured
 * icons — uses a readable `bg-accent/15` tint instead of a solid fill.
 *
 * AC coverage:
 *   AC-prim-1   DropdownMenuItem primitive default keeps focus:bg-accent + focus:text-accent-foreground
 *   AC-prim-2   SelectItem primitive default keeps focus:bg-accent + focus:text-accent-foreground
 *   AC-nav-1    Navbar account-menu no longer uses focus:bg-muted
 *   AC-nav-2    Navbar keeps the intentional Host Dashboard (primary/10) + Sign out (destructive/10) treatments
 *   AC-dash-1   DashboardHeader menu no longer uses focus:bg-muted
 *   AC-sel-1    SearchModal SelectItems no longer use focus:bg-muted
 *   AC-sel-2    CampgroundDetailClient SelectItem no longer uses focus:bg-muted
 *   AC-sel-3    SortDropdown SelectItem no longer uses focus:bg-muted
 *   AC-cmd-1    Command primitive uses data-selected:bg-accent (not data-selected:bg-muted)
 *   AC-cmd-2    LocationPicker row uses hover:bg-accent (not hover:bg-muted)
 *   AC-token    all changed call sites stay token-only (npm run check:palette exits 0)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// ─────────────────────────────────────────────────────────────
// AC-prim-1/2: the primitives still define the AA-contrast accent highlight
// (removing a call-site override is only a fix because this is the default)
// ─────────────────────────────────────────────────────────────

describe("AC-prim-1: DropdownMenuItem primitive defaults to the accent highlight", () => {
  const ddSrc = src("components/ui/dropdown-menu.tsx");
  it("keeps focus:bg-accent focus:text-accent-foreground as the item default", () => {
    expect(ddSrc).toMatch(/focus:bg-accent/);
    expect(ddSrc).toMatch(/focus:text-accent-foreground/);
  });
});

describe("AC-prim-2: SelectItem primitive defaults to the accent highlight", () => {
  const selSrc = src("components/ui/select.tsx");
  it("keeps focus:bg-accent focus:text-accent-foreground as the item default", () => {
    expect(selSrc).toMatch(/focus:bg-accent/);
    expect(selSrc).toMatch(/focus:text-accent-foreground/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-nav-1/2: Navbar account menu
// ─────────────────────────────────────────────────────────────

describe("AC-nav-1: Navbar account menu no longer uses the low-contrast focus:bg-muted", () => {
  const navSrc = src("components/Navbar.tsx");
  it("contains no focus:bg-muted override on its dropdown items", () => {
    expect(navSrc).not.toMatch(/focus:bg-muted/);
  });
});

describe("AC-nav-2: Navbar keeps only the intentional per-item focus overrides", () => {
  const navSrc = src("components/Navbar.tsx");
  // CAM-224 A1: Host Dashboard no longer overrides focus — inherits canonical focus:bg-accent from the primitive.
  it("Host Dashboard item does NOT override focus:bg-primary/10 (canonical focus:bg-accent applies)", () => {
    expect(navSrc).not.toMatch(/Host Dashboard[\s\S]{0,300}focus:bg-primary\/10/);
  });
  it("Sign out keeps its focus:bg-destructive/10 tint (intentional destructive variant)", () => {
    expect(navSrc).toMatch(/focus:bg-destructive\/10/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-dash-1: DashboardHeader account menu
// ─────────────────────────────────────────────────────────────

describe("AC-dash-1: DashboardHeader menu no longer uses focus:bg-muted", () => {
  const dashSrc = src("components/DashboardHeader.tsx");
  it("contains no focus:bg-muted override on its dropdown item", () => {
    expect(dashSrc).not.toMatch(/focus:bg-muted/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-sel-1/2/3: Select menus
// ─────────────────────────────────────────────────────────────

describe("AC-sel-1: SearchModal selects no longer use focus:bg-muted", () => {
  it("SearchModal.tsx contains no focus:bg-muted SelectItem override", () => {
    expect(src("components/SearchModal.tsx")).not.toMatch(/focus:bg-muted/);
  });
});

describe("AC-sel-2: CampgroundDetailClient select no longer uses focus:bg-muted", () => {
  it("CampgroundDetailClient.tsx contains no focus:bg-muted SelectItem override", () => {
    expect(src("components/CampgroundDetailClient.tsx")).not.toMatch(/focus:bg-muted/);
  });
});

describe("AC-sel-3: SortDropdown select no longer uses focus:bg-muted", () => {
  it("SortDropdown.tsx contains no focus:bg-muted SelectItem override", () => {
    expect(src("components/SortDropdown.tsx")).not.toMatch(/focus:bg-muted/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-cmd-1/2: Command combobox (rich rows → readable accent tint)
// ─────────────────────────────────────────────────────────────

describe("AC-cmd-1: Command primitive uses an accent tint for the selected row", () => {
  const cmdSrc = src("components/ui/command.tsx");
  it("no longer highlights with data-selected:bg-muted", () => {
    expect(cmdSrc).not.toMatch(/data-selected:bg-muted/);
  });
  it("uses data-selected:bg-accent for the selected row", () => {
    expect(cmdSrc).toMatch(/data-selected:bg-accent/);
  });
});

describe("AC-cmd-2: LocationPicker row uses an accent tint on hover", () => {
  const lpSrc = src("components/LocationPicker.tsx");
  it("no longer hovers with the low-contrast hover:bg-muted", () => {
    expect(lpSrc).not.toMatch(/hover:bg-muted/);
  });
  it("uses hover:bg-accent for the hovered row", () => {
    expect(lpSrc).toMatch(/hover:bg-accent/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-toggle: theme-mode toggle (sun/monitor/moon) selected + hover states
// (same bg-muted bug — selected mode was nearly invisible in light mode)
// ─────────────────────────────────────────────────────────────

describe("AC-toggle: ThemeToggle selected/hover use the accent treatment", () => {
  const tgSrc = src("components/ThemeToggle.tsx");
  it("no longer uses bg-muted for selected or hover", () => {
    expect(tgSrc).not.toMatch(/bg-muted/);
  });
  it("selected mode uses the solid accent fill (bg-accent + text-accent-foreground)", () => {
    expect(tgSrc).toMatch(/bg-accent text-accent-foreground/);
  });
  it("hover on an unselected mode uses an accent tint", () => {
    expect(tgSrc).toMatch(/hover:bg-accent\/15/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-tabs: Tabs default-variant active segment (same bg-muted-family bug —
// active tab was white-on-near-white in light mode). Found by post-merge audit.
// ─────────────────────────────────────────────────────────────

describe("AC-tabs: Tabs default-variant active segment uses the accent treatment", () => {
  const tabsSrc = src("components/ui/tabs.tsx");
  it("no longer paints the default active tab white (data-active:bg-background removed)", () => {
    expect(tabsSrc).not.toMatch(/data-active:bg-background/);
  });
  it("default-variant active uses bg-accent + text-accent-foreground (scoped to the default variant)", () => {
    expect(tabsSrc).toMatch(/group-data-\[variant=default\]\/tabs-list:data-active:bg-accent/);
    expect(tabsSrc).toMatch(/group-data-\[variant=default\]\/tabs-list:data-active:text-accent-foreground/);
  });
  it("preserves the line variant: keeps base data-active:text-foreground + line-variant transparent bg", () => {
    expect(tabsSrc).toMatch(/data-active:text-foreground/);
    expect(tabsSrc).toMatch(/group-data-\[variant=line\]\/tabs-list:data-active:bg-transparent/);
  });
});

describe("AC-tabs: NotificationCenter no longer needs a per-site shadow hack", () => {
  it("AddMemberDialog dropped the compensating data-[state=active]:shadow-sm (primitive now visible)", () => {
    expect(src("components/settings/AddMemberDialog.tsx")).not.toMatch(/data-\[state=active\]:shadow-sm/);
  });
});

// CAM-559: LocationPicker was rebuilt as three cascading province/district/
// sub-district comboboxes, replacing the old flat single-search list. The old
// row paired a primary district name with a secondary "in this province"
// subtitle line (`text-xs text-foreground/70`) — that concept genuinely no
// longer exists: each cascading level is already scoped by the parent the
// host just picked, so a row needs no secondary context line at all. Rather
// than drop this AC's coverage, it is restated as the INVARIANT it always
// protected — no low-contrast `text-muted-foreground` text riding the
// `hover:bg-accent/15` tinted row (the exact bug class this guard exists to
// catch) — which still holds, and holds MORE strongly: every row's own label
// now renders at full-strength `text-foreground` (better contrast than the
// old `/70` subtitle ever had), not a diluted subtitle tone.
describe("AC-loc-subtitle: LocationPicker's tinted hover row carries no low-contrast text (restated for the CAM-559 cascading rebuild)", () => {
  const lpSrc = src("components/LocationPicker.tsx");

  it("still uses the accent/15 tint on every combobox row (AC-cmd-2 precondition unchanged)", () => {
    expect(lpSrc).toMatch(/hover:bg-accent\/15/);
  });

  it("no CommandItem row pairs the tinted hover with the lower-contrast text-muted-foreground (the bug class this guard exists to catch)", () => {
    // Look inside every <CommandItem ...>...</CommandItem> block for the
    // co-occurrence this AC was written to prevent: a hover:bg-accent/15
    // trigger class combined with muted-foreground body text.
    const itemBlocks = lpSrc.match(/<CommandItem[\s\S]*?<\/CommandItem>/g) || [];
    expect(itemBlocks.length).toBeGreaterThan(0);
    for (const block of itemBlocks) {
      expect(block).not.toMatch(/text-muted-foreground/);
    }
  });

  it("each row's label renders at full-strength text-foreground (single-line rows — no diluted subtitle tone needed post-redesign)", () => {
    expect(lpSrc).toMatch(/text-sm font-medium text-foreground/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-token: the fix stays token-only (no hex / numbered palette introduced)
// ─────────────────────────────────────────────────────────────

describe("AC-token: palette guard stays green after the change", () => {
  it("npm run check:palette exits 0 (token-only)", () => {
    let stdout = "";
    let exitCode = 0;
    try {
      stdout = execSync("node scripts/check-palette.mjs", { cwd: root, encoding: "utf-8" });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      stdout = err.stdout ?? "";
    }
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/PASS.*0 violations/i);
  });
});
