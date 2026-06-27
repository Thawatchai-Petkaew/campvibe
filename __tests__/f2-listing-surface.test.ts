/**
 * CAM-107 — F2 Listing Surface: source-inspection tests.
 *
 * Layer: unit (static source analysis, no DOM renderer — vitest env is 'node').
 * Style: mirrors __tests__/theme-toggle.test.ts (fs.readFileSync inspection).
 *
 * AC coverage:
 *   AC-palette-1    Forbidden palette tokens absent from all 5 target files
 *   AC-palette-2    Only permitted text-white: heart icon in CampgroundCard (not elsewhere)
 *   AC-a11y-1       FilterModal filter buttons carry focus-visible:ring-2 ring-ring
 *   AC-a11y-2       Activity pill min-h-[44px] tap target
 *   AC-a11y-3       FilterModal trigger h-11 (44px), close button w-11 h-11
 *   AC-a11y-4       FilterModal trigger has aria-label driven by i18n (not hardcoded)
 *   AC-a11y-5       Badge count has aria-hidden="true"
 *   AC-a11y-6       ActiveFilters remove button has aria-label from i18n + focus ring
 *   AC-a11y-7       ActiveFilters clearAll button has aria-label from i18n
 *   AC-icons-1      FilterModal uses lucide icons for static UI (X, SlidersHorizontal)
 *   AC-icons-2      ActiveFilters uses lucide X
 *   AC-icons-3      CampgroundCard uses lucide Heart (filled via fill-current)
 *   AC-i18n-1       filter.titleWithCount exists in both en + th locales
 *   AC-i18n-2       activeFilters.removeFilter exists in both en + th locales
 *   AC-i18n-3       activeFilters.clearAll exists in both en + th locales
 *   AC-i18n-4       No em-dash in Thai filter / activeFilters copy
 *   AC-i18n-5       No hardcoded "Clear all" string literal in FilterModal source
 *   AC-grid-1       CampgroundGrid has sm:2 / md:3 / lg:4 / xl:5 responsive cols
 *   AC-scroll-1     FilterModal content area uses overflow-y-auto + flex-1 (mobile scroll)
 *   AC-chip-1       Selected Activity pill uses foreground tokens (dark-mode safe)
 *   AC-searchmodal-1 SearchModal close is w-11 h-11 with focus-visible ring (defect gate)
 *   AC-searchmodal-2 SearchModal search action button uses text-primary-foreground, not text-white
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const filterModalSrc = src("components/FilterModal.tsx");
// DS-1: FilterChip primitive extracted from FilterModal — chip token assertions check both files.
const filterChipSrc = src("components/ui/filter-chip.tsx");
const campgroundCardSrc = src("components/CampgroundCard.tsx");
const activeFiltersSrc = src("components/ActiveFilters.tsx");
const searchModalSrc = src("components/SearchModal.tsx");
const buttonSrc = src("components/ui/button.tsx");
const pageSrc = src("app/page.tsx");
const campgroundGridSrc = src("components/CampgroundGrid.tsx");
// CAM-220: the shared close button (X icon, aria-label, size-11 tap target) moved into
// ModalHeader in modal-shell.tsx. Assertions that pinned inline consumer patterns redirect here.
const modalShellSrc = src("components/ui/modal-shell.tsx");

const ALL_FIVE = [filterModalSrc, campgroundCardSrc, activeFiltersSrc, searchModalSrc, pageSrc];

// ─────────────────────────────────────────────────────────────
// AC-palette-1  Forbidden palette tokens
// ─────────────────────────────────────────────────────────────
describe("modal--filter + card--campground: forbidden palette tokens", () => {
    const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
        ["text-black", /\btext-black\b/],
        ["fill-black", /\bfill-black\b/],
        ["bg-gray-*", /\bbg-gray-\d/],
        ["text-gray-*", /\btext-gray-\d/],
        ["border-gray-*", /\bborder-gray-\d/],
        ["bg-white", /\bbg-white\b/],
        ["border-black", /\bborder-black\b/],
        ["border-white", /\bborder-white\b/],
        ["hex color", /#[0-9a-fA-F]{3,6}\b/],
        ["dark:bg-*", /dark:bg-/],
        ["dark:text-*", /dark:text-/],
        ["dark:ring-*", /dark:ring-/],
        ["dark:border-*", /dark:border-/],
    ];

    const FILE_NAMES = [
        "FilterModal.tsx",
        "CampgroundCard.tsx",
        "ActiveFilters.tsx",
        "SearchModal.tsx",
        "app/page.tsx",
    ];

    FORBIDDEN_PATTERNS.forEach(([label, pattern]) => {
        ALL_FIVE.forEach((fileSrc, idx) => {
            it(`AC-palette-1: ${FILE_NAMES[idx]} has no ${label}`, () => {
                expect(fileSrc).not.toMatch(pattern);
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-palette-2  Only allowed text-white: heart icon in CampgroundCard
// ─────────────────────────────────────────────────────────────
describe("palette: text-white scope", () => {
    it("AC-palette-2: CampgroundCard has exactly one text-white (heart icon over image)", () => {
        const matches = campgroundCardSrc.match(/\btext-white\b/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(1);
    });

    it("AC-palette-2: the text-white in CampgroundCard is on Heart (lucide, not on a container or text element)", () => {
        // The allowed text-white must appear on the Heart lucide icon line
        expect(campgroundCardSrc).toMatch(/<Heart[^>]*text-white/);
    });

    it("AC-palette-2: FilterModal has no text-white", () => {
        expect(filterModalSrc).not.toMatch(/\btext-white\b/);
    });

    it("AC-palette-2: ActiveFilters has no text-white", () => {
        expect(activeFiltersSrc).not.toMatch(/\btext-white\b/);
    });

    // Defect gate: SearchModal search button must NOT use text-white
    it("AC-palette-2 [DEFECT D1]: SearchModal search action button should use text-primary-foreground, not text-white", () => {
        // This test CATCHES the defect: text-white on the Search button in SearchModal
        expect(searchModalSrc).not.toMatch(/\btext-white\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-1  FilterModal filter buttons: focus-visible ring
// ─────────────────────────────────────────────────────────────
describe("modal--filter: a11y focus rings on filter buttons", () => {
    it("AC-a11y-1: filter buttons have focus-visible:outline-none", () => {
        expect(filterChipSrc).toMatch(/focus-visible:outline-none/);
    });

    it("AC-a11y-1: filter buttons have focus-visible:ring-2", () => {
        expect(filterChipSrc).toMatch(/focus-visible:ring-2/);
    });

    it("AC-a11y-1: filter buttons have focus-visible:ring-ring (token, not hardcoded color)", () => {
        expect(filterChipSrc).toMatch(/focus-visible:ring-ring/);
    });

    it("AC-a11y-1: filter buttons have focus-visible:ring-offset-2", () => {
        expect(filterChipSrc).toMatch(/focus-visible:ring-offset-2/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-2  Activity pill tap target ≥ 44px
// ─────────────────────────────────────────────────────────────
describe("modal--filter: Activity pill tap target", () => {
    it("AC-a11y-2: Activity pill has min-h-[44px] class (or h-11 = 44px in FilterChip primitive)", () => {
        // DS-1: pill tap-target baked into FilterChip primitive (h-11 = 44px); FilterModal delegates to it.
        const hasInModal = /min-h-\[44px\]/.test(filterModalSrc);
        const hasInChip = /h-11\b/.test(filterChipSrc);
        expect(hasInModal || hasInChip).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-3  FilterModal trigger h-11, close w-11 h-11
// ─────────────────────────────────────────────────────────────
describe("modal--filter: tap targets on trigger and close", () => {
    it("AC-a11y-3: FilterModal trigger button has h-11 (44px height)", () => {
        // The DialogTrigger Button should carry h-11
        expect(filterModalSrc).toMatch(/\bh-11\b/);
    });

    it("AC-a11y-3: modal close button is size-11 (44px square) via size=\"icon\" in modal-shell.tsx", () => {
        // CAM-220: the close Button migrated from FilterModal into the shared ModalHeader.
        // Button size="icon" resolves to size-11 (44×44px). The intent (44px tap target) is
        // preserved; assertion redirected to where the button now lives.
        expect(modalShellSrc).toMatch(/size=["']icon["']/);
        // Also confirm Button primitive still maps "icon" to size-11
        expect(buttonSrc).toMatch(/\bsize-11\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-4  FilterModal trigger aria-label (i18n, with count)
// ─────────────────────────────────────────────────────────────
describe("modal--filter: trigger aria-label", () => {
    it("AC-a11y-4: trigger has aria-label={triggerAriaLabel} (dynamic i18n value)", () => {
        expect(filterModalSrc).toMatch(/aria-label=\{triggerAriaLabel\}/);
    });

    it("AC-a11y-4: triggerAriaLabel uses filter.titleWithCount i18n key when count > 0", () => {
        expect(filterModalSrc).toMatch(/t\.filter\?\.titleWithCount/);
    });

    it("AC-a11y-4: triggerAriaLabel replaces {{count}} placeholder with the active count", () => {
        expect(filterModalSrc).toMatch(/replace\(['"]{{count}}['"]/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-5  Badge count has aria-hidden
// ─────────────────────────────────────────────────────────────
describe("modal--filter: badge count aria-hidden", () => {
    it("AC-a11y-5: activeFilterCount badge span has aria-hidden=\"true\"", () => {
        expect(filterModalSrc).toMatch(/aria-hidden=["']true["']/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-6  ActiveFilters remove button aria-label + focus ring
// ─────────────────────────────────────────────────────────────
describe("section--active-filters: remove button a11y", () => {
    it("AC-a11y-6: remove button has aria-label using t.activeFilters.removeFilter", () => {
        expect(activeFiltersSrc).toMatch(/t\.activeFilters\?\.removeFilter/);
    });

    it("AC-a11y-6: remove button aria-label replaces {{label}} placeholder", () => {
        expect(activeFiltersSrc).toMatch(/replace\(['"]{{label}}['"]/);
    });

    it("AC-a11y-6: remove button has focus-visible:ring-2", () => {
        expect(activeFiltersSrc).toMatch(/focus-visible:ring-2/);
    });

    it("AC-a11y-6: remove button has focus-visible:ring-ring (design token)", () => {
        expect(activeFiltersSrc).toMatch(/focus-visible:ring-ring/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-7  ActiveFilters clearAll button aria-label
// ─────────────────────────────────────────────────────────────
describe("section--active-filters: clearAll button a11y", () => {
    it("AC-a11y-7: clearAll button has aria-label using t.activeFilters.clearAll", () => {
        expect(activeFiltersSrc).toMatch(/aria-label=\{t\.activeFilters\?\.clearAll/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-icons-1  FilterModal uses lucide icons for static UI controls
// ─────────────────────────────────────────────────────────────
describe("modal--filter: lucide icons for static UI", () => {
    it("AC-icons-1: X icon imported from lucide-react (now in modal-shell.tsx after CAM-220)", () => {
        // CAM-220: X (the close icon) migrated from FilterModal into the shared ModalHeader in
        // modal-shell.tsx. The lucide-only invariant (no @tabler) is preserved; assertion redirected.
        expect(modalShellSrc).toMatch(/import.*\bX\b.*from ["']lucide-react["']/);
    });

    it("AC-icons-1: imports SlidersHorizontal from lucide-react", () => {
        expect(filterModalSrc).toMatch(/import.*SlidersHorizontal.*from ["']lucide-react["']/);
    });

    it("AC-icons-1: uses X in JSX — close button (now in modal-shell.tsx after CAM-220)", () => {
        // CAM-220: <X renders inside ModalHeader in modal-shell.tsx, not inline in FilterModal.
        expect(modalShellSrc).toMatch(/<X\b/);
    });

    it("AC-icons-1: uses SlidersHorizontal in JSX (trigger button)", () => {
        expect(filterModalSrc).toMatch(/<SlidersHorizontal\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-icons-2  ActiveFilters uses lucide X
// ─────────────────────────────────────────────────────────────
describe("section--active-filters: lucide icon", () => {
    it("AC-icons-2: imports X from lucide-react", () => {
        expect(activeFiltersSrc).toMatch(/import.*\bX\b.*from ["']lucide-react["']/);
    });

    it("AC-icons-2: uses <X in JSX", () => {
        expect(activeFiltersSrc).toMatch(/<X\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-icons-3  CampgroundCard uses lucide Heart (filled via fill-current)
// ─────────────────────────────────────────────────────────────
describe("card--campground: lucide heart icons", () => {
    it("AC-icons-3: imports Heart from lucide-react", () => {
        expect(campgroundCardSrc).toMatch(/import.*\bHeart\b.*from ["']lucide-react["']/);
    });

    it("AC-icons-3: filled heart uses fill-current class", () => {
        expect(campgroundCardSrc).toMatch(/fill-current/);
    });

    it("AC-icons-3: heart icons are aria-hidden (decorative, label is on button)", () => {
        // Both Heart instances must have aria-hidden="true"
        const hiddenMatches = campgroundCardSrc.match(/aria-hidden=["']true["']/g);
        expect(hiddenMatches).not.toBeNull();
        expect(hiddenMatches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-1/2/3  Required F2 i18n keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: F2 required keys in both locales", () => {
    it("AC-i18n-1: filter.titleWithCount exists and is non-empty in EN", () => {
        expect(translations.en.filter.titleWithCount).toBeTruthy();
    });

    it("AC-i18n-1: filter.titleWithCount exists and is non-empty in TH", () => {
        expect(translations.th.filter.titleWithCount).toBeTruthy();
    });

    it("AC-i18n-1: filter.titleWithCount contains {{count}} placeholder in EN", () => {
        expect(translations.en.filter.titleWithCount).toContain("{{count}}");
    });

    it("AC-i18n-1: filter.titleWithCount contains {{count}} placeholder in TH", () => {
        expect(translations.th.filter.titleWithCount).toContain("{{count}}");
    });

    it("AC-i18n-2: activeFilters.removeFilter exists and is non-empty in EN", () => {
        expect(translations.en.activeFilters.removeFilter).toBeTruthy();
    });

    it("AC-i18n-2: activeFilters.removeFilter exists and is non-empty in TH", () => {
        expect(translations.th.activeFilters.removeFilter).toBeTruthy();
    });

    it("AC-i18n-2: activeFilters.removeFilter contains {{label}} placeholder in EN", () => {
        expect(translations.en.activeFilters.removeFilter).toContain("{{label}}");
    });

    it("AC-i18n-2: activeFilters.removeFilter contains {{label}} placeholder in TH", () => {
        expect(translations.th.activeFilters.removeFilter).toContain("{{label}}");
    });

    it("AC-i18n-3: activeFilters.clearAll exists and is non-empty in EN", () => {
        expect(translations.en.activeFilters.clearAll).toBeTruthy();
    });

    it("AC-i18n-3: activeFilters.clearAll exists and is non-empty in TH", () => {
        expect(translations.th.activeFilters.clearAll).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-4  No em-dash in Thai filter / activeFilters copy
// ─────────────────────────────────────────────────────────────
describe("i18n: no em-dash in Thai F2 copy", () => {
    const thFilterValues = Object.values(translations.th.filter) as string[];
    const thActiveFilterValues = Object.values(translations.th.activeFilters) as string[];

    it("AC-i18n-4: Thai filter keys contain no em-dash separator", () => {
        thFilterValues.forEach((v) => {
            expect(v).not.toMatch(/—/);
        });
    });

    it("AC-i18n-4: Thai activeFilters keys contain no em-dash separator", () => {
        thActiveFilterValues.forEach((v) => {
            expect(v).not.toMatch(/—/);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-5  No hardcoded "Clear all" string literal in FilterModal
// ─────────────────────────────────────────────────────────────
describe("modal--filter: no hardcoded Clear all text", () => {
    it("AC-i18n-5: FilterModal does not contain hardcoded 'Clear all' string literal in JSX", () => {
        // Should render via t.filter.clearAll — a hardcoded literal in JSX would look like >Clear all< or "Clear all"
        // The clearAll button renders {t.filter?.clearAll}
        expect(filterModalSrc).not.toMatch(/>Clear all</);
        expect(filterModalSrc).not.toMatch(/>Clear All</);
    });

    it("AC-i18n-5: FilterModal clear all button renders t.filter.clearAll (i18n key)", () => {
        expect(filterModalSrc).toMatch(/t\.filter\?\.clearAll/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-grid-1  CampgroundGrid responsive breakpoints
// ─────────────────────────────────────────────────────────────
describe("section--campground-grid: responsive columns", () => {
    it("AC-grid-1: base 1 col (mobile first)", () => {
        expect(campgroundGridSrc).toMatch(/grid-cols-1/);
    });

    it("AC-grid-1: sm:grid-cols-2", () => {
        expect(campgroundGridSrc).toMatch(/sm:grid-cols-2/);
    });

    it("AC-grid-1: md:grid-cols-3", () => {
        expect(campgroundGridSrc).toMatch(/md:grid-cols-3/);
    });

    it("AC-grid-1: lg:grid-cols-4", () => {
        expect(campgroundGridSrc).toMatch(/lg:grid-cols-4/);
    });

    it("AC-grid-1: xl:grid-cols-5", () => {
        expect(campgroundGridSrc).toMatch(/xl:grid-cols-5/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-scroll-1  FilterModal mobile scroll
// ─────────────────────────────────────────────────────────────
describe("modal--filter: mobile scroll", () => {
    it("AC-scroll-1: content area has overflow-y-auto (enables vertical scroll)", () => {
        expect(filterModalSrc).toMatch(/overflow-y-auto/);
    });

    it("AC-scroll-1: content area has flex-1 (fills available height below header)", () => {
        expect(filterModalSrc).toMatch(/flex-1/);
    });

    it("AC-scroll-1: dialog content has max-h-[85vh] (caps height on mobile)", () => {
        expect(filterModalSrc).toMatch(/max-h-\[85vh\]/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-chip-1  Selected filter chips use foreground tokens (dark-mode safe)
// ─────────────────────────────────────────────────────────────
describe("modal--filter: selected chip dark-mode safety", () => {
    it("AC-chip-1: selected Activity pill uses bg-foreground (not bg-black or hardcoded dark)", () => {
        // DS-1: token baked into FilterChip primitive; FilterModal delegates to it.
        expect(filterModalSrc + filterChipSrc).toMatch(/bg-foreground\b/);
    });

    it("AC-chip-1: selected Activity pill uses text-background (not text-white or hardcoded light)", () => {
        // DS-1: token baked into FilterChip primitive; FilterModal delegates to it.
        expect(filterModalSrc + filterChipSrc).toMatch(/text-background\b/);
    });

    it("AC-chip-1: unselected Activity pill uses text-foreground (visible on both themes)", () => {
        expect(filterModalSrc + filterChipSrc).toMatch(/text-foreground\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-searchmodal-1  SearchModal close button: w-11 h-11 + focus ring
// (Defect gate — these tests are expected to FAIL until SearchModal is fixed)
// ─────────────────────────────────────────────────────────────
describe("modal--search: close button size and focus ring [DEFECT D2, D3 — fixed by CAM-220]", () => {
    it("AC-searchmodal-1 [DEFECT D2 fixed]: close button is size-11 (44px) via shared ModalHeader shell", () => {
        // CAM-220: the close button migrated from SearchModal inline markup into the shared
        // ModalHeader in modal-shell.tsx. It now uses Button size="icon" (= size-11 = 44px).
        // The old top-4 positioning (source of the padding asymmetry) is replaced by
        // top-1/2 -translate-y-1/2 (vertically centered). Assertion redirected to the shell.
        // size="icon" appears before data-testid on the Button opening tag, so we assert
        // the shell contains the close button (via data-testid) AND size="icon" on that Button.
        expect(modalShellSrc).toMatch(/data-testid="btn--modal-close"/);
        expect(modalShellSrc).toMatch(/size=["']icon["'][^>]*data-testid="btn--modal-close"|data-testid="btn--modal-close"[^>]*size=["']icon["']|size=["']icon["'][\s\S]{0,200}data-testid="btn--modal-close"/);
    });

    it("AC-searchmodal-1 [DEFECT D3 fixed]: close button has focus ring via Button primitive (DS-2)", () => {
        // The focus ring (focus-visible:ring-3 ring-ring/30) comes from the Button primitive, not
        // an inline override — this was always the case with DS-2; now the button is in the shell.
        const closeBtnBlock = modalShellSrc.match(/data-testid="btn--modal-close"[\s\S]{0,200}?<\/Button>/);
        expect(closeBtnBlock).not.toBeNull();
        expect(buttonSrc).toMatch(/focus-visible:ring-ring/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-searchmodal-2  SearchModal search action: text-primary-foreground, not text-white
// (Defect gate — expected to FAIL until SearchModal is fixed)
// ─────────────────────────────────────────────────────────────
describe("modal--search: search action button palette [DEFECT D1]", () => {
    it("AC-searchmodal-2 [DEFECT D1]: SearchModal search button should use text-primary-foreground not text-white", () => {
        // text-white is only allowed on the heart icon in CampgroundCard
        expect(searchModalSrc).not.toMatch(/\btext-white\b/);
    });
});
