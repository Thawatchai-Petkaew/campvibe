/**
 * DS-1 — Dropdown/Select/Menu grammar + FilterChip (CAM-121)
 * PR #61, branch feature/ds1-dropdown-grammar
 *
 * Layer: unit (static source inspection — vitest env is 'node').
 * Mirrors the approach in __tests__/f2-listing-surface.test.ts.
 *
 * AC→test map:
 *  AC-select-1    SelectContent has rounded-2xl
 *  AC-select-2    SelectItem has rounded-xl + font-normal
 *  AC-select-3    SelectTrigger has rounded-full + h-11 via data-[size=default]:h-11
 *  AC-select-4    SelectViewport has p-1.5 (content-padding parity with DropdownMenuContent) [CAM-232]
 *  AC-dropdown-1  DropdownMenuContent has rounded-2xl
 *  AC-dropdown-2  DropdownMenuItem has rounded-xl + font-normal
 *  AC-dropdown-3  DropdownMenuContent has NO border-none
 *  AC-dropdown-4  DropdownMenuContent has p-1.5 (shared content grammar) [CAM-232]
 *  AC-popover-1   PopoverContent has rounded-2xl
 *  AC-command-1   Command root has rounded-2xl
 *  AC-command-2   CommandItem has rounded-xl + font-normal
 *  AC-command-3   CommandDialog keeps rounded-4xl! (intentional override)
 *  AC-chip-1      FilterChip has all 3 variants (pill | card | icon-card)
 *  AC-chip-2      FilterChip pill h-11 (44px tap target)
 *  AC-chip-3      FilterChip icon-card h-24 (≥44px)
 *  AC-chip-4      FilterChip has aria-pressed on all variants
 *  AC-chip-5      FilterChip has focus-visible ring (ring-2 ring-ring)
 *  AC-chip-6      FilterChip is token-only (no hex values, no hardcoded px sizes that imply palette)
 *  AC-chip-7      FilterChip selected pill uses bg-foreground + text-background tokens
 *  AC-gate-1      No rounded-3xl in Select/Popover/DropdownMenu content (primitives)
 *  AC-gate-2      No rounded-lg on DropdownMenuItem primitive
 *  AC-gate-3      No font-semibold or font-bold on DropdownMenuItem primitive
 *  AC-gate-4      No h-10 on SelectTrigger primitive (uses data-[size=default]:h-11)
 *  AC-gate-5      No focus:ring-0 on SelectTrigger in the Select primitive
 *  AC-gate-6      No border-none in DropdownMenuContent primitive
 *  AC-consumer-1  SortDropdown (Select consumer): no rounded-3xl/rounded-lg override on content
 *  AC-consumer-2  Navbar (DropdownMenu consumer): no rounded-3xl/rounded-lg override on DropdownMenuContent
 *  AC-consumer-3  DashboardHeader (DropdownMenu consumer): no rounded-3xl/rounded-lg override
 *  AC-consumer-4  LocationPicker (Popover+Command consumer): no rounded-3xl override on PopoverContent
 *  AC-consumer-5  FilterModal uses FilterChip (not inline button/span) for pill/card/icon-card sections
 *  AC-consumer-6  FilterModal facility checkboxes still use Checkbox component (not FilterChip)
 *  AC-consumer-7  FilterModal selection logic (toggleFilter) and selectedFilters state unchanged
 *  AC-consumer-8  FilterModal i18n clearAll renders t.filter?.clearAll (not hardcoded)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const selectSrc = src("components/ui/select.tsx");
const dropdownSrc = src("components/ui/dropdown-menu.tsx");
const popoverSrc = src("components/ui/popover.tsx");
const commandSrc = src("components/ui/command.tsx");
const filterChipSrc = src("components/ui/filter-chip.tsx");

// Consumers
const filterModalSrc = src("components/FilterModal.tsx");
const sortDropdownSrc = src("components/SortDropdown.tsx");
const navbarSrc = src("components/Navbar.tsx");
const dashboardHeaderSrc = src("components/DashboardHeader.tsx");
const locationPickerSrc = src("components/LocationPicker.tsx");

// ─────────────────────────────────────────────────────────────
// Select primitive grammar
// ─────────────────────────────────────────────────────────────
describe("select--primitive: grammar (AC-select-1/2/3)", () => {
  it("AC-select-1: SelectContent has rounded-2xl", () => {
    expect(selectSrc).toMatch(/rounded-2xl/);
  });

  it("AC-select-2: SelectItem has rounded-xl", () => {
    // The SelectItem className must contain rounded-xl
    const itemMatch = selectSrc.match(/SelectPrimitive\.Item[\s\S]*?className[\s\S]*?rounded-xl/);
    expect(itemMatch).not.toBeNull();
  });

  it("AC-select-2: SelectItem has font-normal (not font-semibold/font-bold)", () => {
    // Extract the SelectItem className block and confirm font-normal
    expect(selectSrc).toMatch(/font-normal/);
    // Confirm the primitive does NOT apply font-semibold or font-bold on the item itself
    // (consumers may use it inside, but the primitive class string should be font-normal)
    const itemClassBlock = selectSrc.match(/"relative flex w-full[^"]*"/);
    expect(itemClassBlock).not.toBeNull();
    expect(itemClassBlock![0]).toMatch(/font-normal/);
    expect(itemClassBlock![0]).not.toMatch(/font-semibold/);
    expect(itemClassBlock![0]).not.toMatch(/font-bold/);
  });

  it("AC-select-3: SelectTrigger has rounded-full", () => {
    expect(selectSrc).toMatch(/rounded-full/);
  });

  it("AC-select-3: SelectTrigger uses data-[size=default]:h-11 (not bare h-10 or h-11)", () => {
    expect(selectSrc).toMatch(/data-\[size=default\]:h-11/);
  });

  // CAM-232 DD-1 — content-padding parity: SelectViewport must have p-1.5 so the hover pill
  // floats with the same inset as DropdownMenuContent (which carries p-1.5 on its Content node).
  it("AC-select-4: SelectViewport has p-1.5 (content-padding parity with DropdownMenuContent)", () => {
    // SelectPrimitive.Viewport className must contain p-1.5
    const viewportMatch = selectSrc.match(/SelectPrimitive\.Viewport[\s\S]*?className=\{cn\(\s*"([^"]*)"/)
    expect(viewportMatch).not.toBeNull();
    expect(viewportMatch![1]).toMatch(/\bp-1\.5\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// DropdownMenu primitive grammar
// ─────────────────────────────────────────────────────────────
describe("dropdown--primitive: grammar (AC-dropdown-1/2/3)", () => {
  it("AC-dropdown-1: DropdownMenuContent has rounded-2xl", () => {
    expect(dropdownSrc).toMatch(/rounded-2xl/);
  });

  it("AC-dropdown-2: DropdownMenuItem class string has rounded-xl", () => {
    const itemMatch = dropdownSrc.match(/"group\/dropdown-menu-item[^"]*rounded-xl[^"]*"/);
    expect(itemMatch).not.toBeNull();
  });

  it("AC-dropdown-2: DropdownMenuItem class string has font-normal", () => {
    const itemMatch = dropdownSrc.match(/"group\/dropdown-menu-item[^"]*font-normal[^"]*"/);
    expect(itemMatch).not.toBeNull();
  });

  it("AC-dropdown-3: DropdownMenuContent class string has NO border-none", () => {
    // Capture the DropdownMenuContent className block
    const contentMatch = dropdownSrc.match(/"z-50 max-h-[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).not.toMatch(/border-none/);
  });

  // CAM-232 DD-1 — shared content grammar: DropdownMenuContent must retain p-1.5
  // (the reference side of the parity — both Select and DropdownMenu must carry this padding).
  it("AC-dropdown-4: DropdownMenuContent class string has p-1.5 (shared content grammar)", () => {
    const contentMatch = dropdownSrc.match(/"z-50 max-h-[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).toMatch(/\bp-1\.5\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// Popover primitive grammar
// ─────────────────────────────────────────────────────────────
describe("popover--primitive: grammar (AC-popover-1)", () => {
  it("AC-popover-1: PopoverContent has rounded-2xl", () => {
    expect(popoverSrc).toMatch(/rounded-2xl/);
  });

  it("AC-popover-1: PopoverContent does NOT have rounded-3xl", () => {
    // Capture the PopoverContent className string
    const contentMatch = popoverSrc.match(/"z-50 flex[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).not.toMatch(/rounded-3xl/);
  });
});

// ─────────────────────────────────────────────────────────────
// Command primitive grammar
// ─────────────────────────────────────────────────────────────
describe("command--primitive: grammar (AC-command-1/2/3)", () => {
  it("AC-command-1: Command root has rounded-2xl", () => {
    const commandMatch = commandSrc.match(/"flex size-full[^"]*rounded-2xl[^"]*"/);
    expect(commandMatch).not.toBeNull();
  });

  it("AC-command-2: CommandItem has rounded-xl", () => {
    const itemMatch = commandSrc.match(/"group\/command-item[^"]*rounded-xl[^"]*"/);
    expect(itemMatch).not.toBeNull();
  });

  it("AC-command-2: CommandItem has font-normal", () => {
    const itemMatch = commandSrc.match(/"group\/command-item[^"]*font-normal[^"]*"/);
    expect(itemMatch).not.toBeNull();
  });

  it("AC-command-3: CommandDialog keeps rounded-4xl! intentional override (not rounded-2xl)", () => {
    // CommandDialog wraps DialogContent with rounded-4xl! as an intentional exception for the palette
    expect(commandSrc).toMatch(/rounded-4xl!/);
  });
});

// ─────────────────────────────────────────────────────────────
// 7 gate checks — absence of forbidden patterns
// ─────────────────────────────────────────────────────────────
describe("gate--primitives: 7 forbidden patterns (AC-gate-1 through AC-gate-6)", () => {
  it("AC-gate-1: SelectContent has no rounded-3xl", () => {
    const contentMatch = selectSrc.match(/"relative z-50[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).not.toMatch(/rounded-3xl/);
  });

  it("AC-gate-1: PopoverContent has no rounded-3xl", () => {
    const contentMatch = popoverSrc.match(/"z-50 flex[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).not.toMatch(/rounded-3xl/);
  });

  it("AC-gate-1: DropdownMenuContent has no rounded-3xl", () => {
    const contentMatch = dropdownSrc.match(/"z-50 max-h-[^"]*"/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![0]).not.toMatch(/rounded-3xl/);
  });

  it("AC-gate-2: DropdownMenuItem has no rounded-lg", () => {
    const itemMatch = dropdownSrc.match(/"group\/dropdown-menu-item[^"]*"/);
    expect(itemMatch).not.toBeNull();
    expect(itemMatch![0]).not.toMatch(/rounded-lg/);
  });

  it("AC-gate-3: DropdownMenuItem has no font-semibold", () => {
    const itemMatch = dropdownSrc.match(/"group\/dropdown-menu-item[^"]*"/);
    expect(itemMatch).not.toBeNull();
    expect(itemMatch![0]).not.toMatch(/font-semibold/);
  });

  it("AC-gate-3: DropdownMenuItem has no font-bold", () => {
    const itemMatch = dropdownSrc.match(/"group\/dropdown-menu-item[^"]*"/);
    expect(itemMatch).not.toBeNull();
    expect(itemMatch![0]).not.toMatch(/font-bold/);
  });

  it("AC-gate-4: SelectTrigger primitive does not use bare h-10", () => {
    // h-10 should not appear in the SelectTrigger className (uses data-size instead)
    const triggerMatch = selectSrc.match(/"flex w-fit[^"]*"/);
    expect(triggerMatch).not.toBeNull();
    expect(triggerMatch![0]).not.toMatch(/\bh-10\b/);
  });

  it("AC-gate-5: SelectTrigger primitive has no focus:ring-0", () => {
    expect(selectSrc).not.toMatch(/focus:ring-0/);
  });

  it("AC-gate-6: DropdownMenuContent primitive has no border-none", () => {
    expect(dropdownSrc).not.toMatch(/border-none/);
  });
});

// ─────────────────────────────────────────────────────────────
// FilterChip component assertions
// ─────────────────────────────────────────────────────────────
describe("chip--filter: 3 variants + a11y + tokens (AC-chip-1 through AC-chip-7)", () => {
  it("AC-chip-1: FilterChip exports function FilterChip", () => {
    expect(filterChipSrc).toMatch(/export function FilterChip/);
  });

  it("AC-chip-1: FilterChip type includes 'pill' variant", () => {
    expect(filterChipSrc).toMatch(/["']pill["']/);
  });

  it("AC-chip-1: FilterChip type includes 'card' variant", () => {
    expect(filterChipSrc).toMatch(/["']card["']/);
  });

  it("AC-chip-1: FilterChip type includes 'icon-card' variant", () => {
    expect(filterChipSrc).toMatch(/["']icon-card["']/);
  });

  it("AC-chip-2: FilterChip pill variant has h-11 (44px tap target)", () => {
    // pill variant has h-11 on its button
    const pillBlock = filterChipSrc.match(/variant === ["']pill["'][\s\S]*?<\/button>/);
    expect(pillBlock).not.toBeNull();
    expect(pillBlock![0]).toMatch(/\bh-11\b/);
  });

  it("AC-chip-3: FilterChip icon-card variant has h-24 (≥44px)", () => {
    // icon-card has h-24 which is 96px
    const iconCardBlock = filterChipSrc.match(/\/\/ icon-card variant[\s\S]*?<\/button>/);
    expect(iconCardBlock).not.toBeNull();
    expect(iconCardBlock![0]).toMatch(/\bh-24\b/);
  });

  it("AC-chip-4: all 3 variants have aria-pressed attribute", () => {
    // aria-pressed appears at least 3 times (once per variant)
    const matches = filterChipSrc.match(/aria-pressed=/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("AC-chip-5: all variants have focus-visible:ring-2 (accessible focus)", () => {
    const matches = filterChipSrc.match(/focus-visible:ring-2/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("AC-chip-5: all variants have focus-visible:ring-ring (token, not hardcoded color)", () => {
    const matches = filterChipSrc.match(/focus-visible:ring-ring/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("AC-chip-6: FilterChip has no hex color values (token-only)", () => {
    expect(filterChipSrc).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("AC-chip-6: FilterChip has no dark: color overrides (theme flips automatically)", () => {
    expect(filterChipSrc).not.toMatch(/dark:bg-|dark:text-|dark:border-/);
  });

  it("AC-chip-7: FilterChip pill selected state uses bg-foreground token", () => {
    expect(filterChipSrc).toMatch(/bg-foreground\b/);
  });

  it("AC-chip-7: FilterChip pill selected state uses text-background token", () => {
    expect(filterChipSrc).toMatch(/text-background\b/);
  });

  it("AC-chip-7: FilterChip pill unselected state uses text-foreground token", () => {
    expect(filterChipSrc).toMatch(/text-foreground\b/);
  });
});

// ─────────────────────────────────────────────────────────────
// Consumer: no override residue
// ─────────────────────────────────────────────────────────────
describe("consumer--sort-dropdown: no grammar override residue (AC-consumer-1)", () => {
  it("AC-consumer-1: SortDropdown does not override SelectContent with rounded-3xl", () => {
    // Check SelectContent usage in SortDropdown
    expect(sortDropdownSrc).not.toMatch(/SelectContent[^>]*rounded-3xl/);
  });

  it("AC-consumer-1: SortDropdown does not override SelectContent with rounded-lg", () => {
    expect(sortDropdownSrc).not.toMatch(/SelectContent[^>]*rounded-lg/);
  });
});

describe("consumer--navbar: no grammar override residue (AC-consumer-2)", () => {
  it("AC-consumer-2: Navbar does not add rounded-3xl to DropdownMenuContent", () => {
    expect(navbarSrc).not.toMatch(/DropdownMenuContent[^>]*rounded-3xl/);
  });

  it("AC-consumer-2: Navbar does not add rounded-lg to DropdownMenuContent", () => {
    expect(navbarSrc).not.toMatch(/DropdownMenuContent[^>]*rounded-lg/);
  });

  it("AC-consumer-2: Navbar does not add border-none to DropdownMenuContent", () => {
    expect(navbarSrc).not.toMatch(/DropdownMenuContent[^>]*border-none/);
  });
});

describe("consumer--dashboard-header: no grammar override residue (AC-consumer-3)", () => {
  it("AC-consumer-3: DashboardHeader does not add rounded-3xl to DropdownMenuContent", () => {
    expect(dashboardHeaderSrc).not.toMatch(/DropdownMenuContent[^>]*rounded-3xl/);
  });

  it("AC-consumer-3: DashboardHeader does not add rounded-lg to DropdownMenuContent", () => {
    expect(dashboardHeaderSrc).not.toMatch(/DropdownMenuContent[^>]*rounded-lg/);
  });
});

describe("consumer--location-picker: no grammar override residue (AC-consumer-4)", () => {
  it("AC-consumer-4: LocationPicker PopoverContent does not override with rounded-3xl", () => {
    expect(locationPickerSrc).not.toMatch(/PopoverContent[^>]*rounded-3xl/);
  });

  it("AC-consumer-4: LocationPicker PopoverContent does not override with rounded-lg", () => {
    expect(locationPickerSrc).not.toMatch(/PopoverContent[^>]*rounded-lg/);
  });
});

// ─────────────────────────────────────────────────────────────
// FilterModal: chip usage + logic preservation
// ─────────────────────────────────────────────────────────────
describe("modal--filter: FilterChip usage + logic intact (AC-consumer-5/6/7/8)", () => {
  it("AC-consumer-5: FilterModal imports FilterChip", () => {
    expect(filterModalSrc).toMatch(/import.*FilterChip.*from/);
  });

  it("AC-consumer-5: FilterModal uses FilterChip for pill section (Activity)", () => {
    // Activity section uses variant="pill"
    expect(filterModalSrc).toMatch(/variant=["']pill["']/);
  });

  it("AC-consumer-5: FilterModal uses FilterChip for card section (Campground type/Terrain)", () => {
    // Campground type / Terrain sections use variant="card"
    expect(filterModalSrc).toMatch(/variant=["']card["']/);
  });

  it("AC-consumer-5: FilterModal uses FilterChip for icon-card section (Access type)", () => {
    // Access type section uses variant="icon-card"
    expect(filterModalSrc).toMatch(/variant=["']icon-card["']/);
  });

  it("AC-consumer-6: FilterModal facility sections still use Checkbox component (not FilterChip)", () => {
    // Facility sections (Internal/External/Equipment) use Checkbox
    expect(filterModalSrc).toMatch(/import.*Checkbox.*from/);
    expect(filterModalSrc).toMatch(/<Checkbox\b/);
  });

  it("AC-consumer-7: FilterModal still has toggleFilter function (selection logic unchanged)", () => {
    expect(filterModalSrc).toMatch(/const toggleFilter/);
  });

  it("AC-consumer-7: FilterModal still uses selectedFilters state", () => {
    expect(filterModalSrc).toMatch(/selectedFilters/);
  });

  it("AC-consumer-7: FilterModal onToggle wires to toggleFilter", () => {
    // FilterChip receives onToggle={() => toggleFilter(...)}
    expect(filterModalSrc).toMatch(/onToggle=\{.*toggleFilter/);
  });

  it("AC-consumer-8: FilterModal clearAll button renders t.filter?.clearAll (i18n, not hardcoded)", () => {
    expect(filterModalSrc).toMatch(/t\.filter\?\.clearAll/);
  });

  it("AC-consumer-8: FilterModal does not have hardcoded >Clear all< or >Clear All< in JSX", () => {
    expect(filterModalSrc).not.toMatch(/>Clear all</);
    expect(filterModalSrc).not.toMatch(/>Clear All</);
  });
});
