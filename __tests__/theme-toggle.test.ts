/**
 * CAM-105 — F0 Theme Infra: ThemeToggle unit tests.
 *
 * Layer: unit (pure logic, no DOM renderer needed).
 * The vitest environment is 'node'; @testing-library/react is not installed.
 * Instead we validate the static shape of THEME_OPTIONS, the i18n key
 * contract, and confirm the hydration-guard pattern is present in source.
 *
 * AC coverage:
 *   AC-ThemeToggle-1  3 options with correct values, icons, and testIds
 *   AC-ThemeToggle-2  labelKey maps → correct aria-label strings in both locales (no hardcoded copy)
 *   AC-ThemeToggle-3  role="group" + themeToggleGroup key present in both locales
 *   AC-ThemeToggle-4  hydration guard (mounted flag) present in component source
 *   AC-ThemeToggle-5  tap target ≥ 44px class present on each button definition
 *   AC-i18n-1         all 11 new i18n keys exist in both en + th
 *   AC-i18n-2         no em-dash (—) separator inside Thai copy
 *   AC-providers-1    ThemeProvider props: attribute=class, defaultTheme=system, enableSystem, storageKey
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

// ─────────────────────────────────────────────────────────────
// AC-ThemeToggle-1 / AC-ThemeToggle-2 / AC-ThemeToggle-5
// Validate THEME_OPTIONS shape by inspecting the source
// ─────────────────────────────────────────────────────────────
describe("btn--theme-toggle: THEME_OPTIONS shape", () => {
    const toggleSrc = src("components/ThemeToggle.tsx");

    it("AC-ThemeToggle-1: defines exactly 3 theme options: light, system, dark", () => {
        expect(toggleSrc).toMatch(/value:\s*["']light["']/);
        expect(toggleSrc).toMatch(/value:\s*["']system["']/);
        expect(toggleSrc).toMatch(/value:\s*["']dark["']/);
    });

    it("AC-ThemeToggle-1: each option has a testId matching btn--theme-<value>", () => {
        expect(toggleSrc).toMatch(/testId:\s*["']btn--theme-light["']/);
        expect(toggleSrc).toMatch(/testId:\s*["']btn--theme-system["']/);
        expect(toggleSrc).toMatch(/testId:\s*["']btn--theme-dark["']/);
    });

    it("AC-ThemeToggle-2: labelKey references i18n keys (not hardcoded copy)", () => {
        // labelKey must be one of themeLight | themeSystem | themeDark
        expect(toggleSrc).toMatch(/labelKey:\s*["']themeLight["']/);
        expect(toggleSrc).toMatch(/labelKey:\s*["']themeSystem["']/);
        expect(toggleSrc).toMatch(/labelKey:\s*["']themeDark["']/);
        // No hardcoded English label strings as aria-label values
        expect(toggleSrc).not.toMatch(/aria-label=["']Light["']/);
        expect(toggleSrc).not.toMatch(/aria-label=["']System["']/);
        expect(toggleSrc).not.toMatch(/aria-label=["']Dark["']/);
    });

    it("AC-ThemeToggle-5: button has min-h-[44px] min-w-[44px] (tap ≥ 44px)", () => {
        expect(toggleSrc).toMatch(/min-h-\[44px\]/);
        expect(toggleSrc).toMatch(/min-w-\[44px\]/);
    });

    it("AC-ThemeToggle-1: clicking light calls setTheme('light') — onClick wires value correctly", () => {
        // The component maps each option value to onClick={() => setTheme(value)}
        // Verify the pattern exists in source (not hardcoded per-button)
        expect(toggleSrc).toMatch(/onClick=\{.*setTheme\(value\)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-ThemeToggle-3  role="group" + aria-label wired to i18n key
// ─────────────────────────────────────────────────────────────
describe("btn--theme-toggle: accessibility attributes", () => {
    const toggleSrc = src("components/ThemeToggle.tsx");

    it("AC-ThemeToggle-3: outer div has role=\"group\"", () => {
        expect(toggleSrc).toMatch(/role=["']group["']/);
    });

    it("AC-ThemeToggle-3: aria-label on group uses t.nav.themeToggleGroup (not hardcoded)", () => {
        expect(toggleSrc).toMatch(/aria-label=\{t\.nav\.themeToggleGroup\}/);
    });

    it("AC-ThemeToggle-3: aria-pressed is set based on isSelected state", () => {
        expect(toggleSrc).toMatch(/aria-pressed=\{isSelected\}/);
    });

    it("AC-ThemeToggle-3: focus-visible ring tokens used (not hardcoded colors)", () => {
        expect(toggleSrc).toMatch(/focus-visible:ring-2/);
        expect(toggleSrc).toMatch(/focus-visible:ring-ring/);
        expect(toggleSrc).toMatch(/focus-visible:ring-offset-2/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-ThemeToggle-4  Hydration guard (mounted flag)
// ─────────────────────────────────────────────────────────────
describe("btn--theme-toggle: hydration guard", () => {
    const toggleSrc = src("components/ThemeToggle.tsx");

    it("AC-ThemeToggle-4: uses useState(false) for mounted flag", () => {
        expect(toggleSrc).toMatch(/useState\(false\)/);
    });

    it("AC-ThemeToggle-4: sets mounted=true in useEffect (no deps = only on mount)", () => {
        expect(toggleSrc).toMatch(/useEffect\(\s*\(\)\s*=>\s*setMounted\(true\)/);
    });

    it("AC-ThemeToggle-4: isSelected is gated on mounted (mounted && theme === value)", () => {
        expect(toggleSrc).toMatch(/mounted\s*&&\s*theme\s*===\s*value/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-1  All 11 new keys present in both en + th
// ─────────────────────────────────────────────────────────────
describe("i18n: new F0 keys present in both locales", () => {
    const navKeys: Array<keyof typeof translations.en.nav> = [
        "themeToggleGroup",
        "themeLight",
        "themeSystem",
        "themeDark",
    ];

    const previewKeys: Array<keyof typeof translations.en.preview> = [
        "title",
        "colorsSection",
        "typographySection",
        "buttonsSection",
        "formsSection",
        "statesSection",
        "iconsSection",
    ];

    navKeys.forEach((key) => {
        it(`AC-i18n-1: nav.${key} exists and is non-empty in EN`, () => {
            expect(translations.en.nav[key]).toBeTruthy();
        });
        it(`AC-i18n-1: nav.${key} exists and is non-empty in TH`, () => {
            expect(translations.th.nav[key]).toBeTruthy();
        });
    });

    previewKeys.forEach((key) => {
        it(`AC-i18n-1: preview.${key} exists and is non-empty in EN`, () => {
            expect(translations.en.preview[key]).toBeTruthy();
        });
        it(`AC-i18n-1: preview.${key} exists and is non-empty in TH`, () => {
            expect(translations.th.preview[key]).toBeTruthy();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-2  No em-dash separator (—) inside Thai copy for F0 keys
// ─────────────────────────────────────────────────────────────
describe("i18n: no em-dash in Thai F0 copy", () => {
    const thNavThemeValues = [
        translations.th.nav.themeToggleGroup,
        translations.th.nav.themeLight,
        translations.th.nav.themeSystem,
        translations.th.nav.themeDark,
    ];
    const thPreviewValues = Object.values(translations.th.preview);

    it("AC-i18n-2: Thai nav theme keys contain no em-dash separator", () => {
        thNavThemeValues.forEach((v) => {
            expect(v).not.toMatch(/—/);
        });
    });

    it("AC-i18n-2: Thai preview keys contain no em-dash separator", () => {
        thPreviewValues.forEach((v) => {
            expect(v).not.toMatch(/—/);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-providers-1  ThemeProvider wired correctly in Providers.tsx
// ─────────────────────────────────────────────────────────────
describe("ThemeProvider: Providers.tsx wiring", () => {
    const provSrc = src("components/Providers.tsx");

    it("AC-providers-1: ThemeProvider is the outermost wrapper", () => {
        // ThemeProvider must wrap SessionProvider
        const themeIdx = provSrc.indexOf("<ThemeProvider");
        const sessionIdx = provSrc.indexOf("<SessionProvider");
        expect(themeIdx).toBeGreaterThan(-1);
        expect(sessionIdx).toBeGreaterThan(themeIdx);
    });

    it("AC-providers-1: attribute=\"class\"", () => {
        expect(provSrc).toMatch(/attribute=["']class["']/);
    });

    it("AC-providers-1: defaultTheme=\"system\"", () => {
        expect(provSrc).toMatch(/defaultTheme=["']system["']/);
    });

    it("AC-providers-1: enableSystem prop present", () => {
        expect(provSrc).toMatch(/enableSystem/);
    });

    it("AC-providers-1: storageKey=\"campvibe_theme\"", () => {
        expect(provSrc).toMatch(/storageKey=["']campvibe_theme["']/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-layout-1  html suppressHydrationWarning in layout.tsx
// ─────────────────────────────────────────────────────────────
describe("layout.tsx: html element", () => {
    const layoutSrc = src("app/layout.tsx");

    it("AC-layout-1: <html> element has suppressHydrationWarning", () => {
        // The html opening tag must carry suppressHydrationWarning
        const htmlTagMatch = layoutSrc.match(/<html[^>]+>/);
        expect(htmlTagMatch).not.toBeNull();
        expect(htmlTagMatch![0]).toContain("suppressHydrationWarning");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-preview-1  /preview metadata.robots index:false
// ─────────────────────────────────────────────────────────────
describe("/preview: robots noindex", () => {
    const previewPageSrc = src("app/preview/page.tsx");

    it("AC-preview-1: robots.index is false", () => {
        expect(previewPageSrc).toMatch(/index:\s*false/);
    });

    it("AC-preview-1: renders PreviewClient component", () => {
        expect(previewPageSrc).toMatch(/PreviewClient/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-navbar-1  ThemeToggle is placed in Navbar with onSelect preventDefault
// ─────────────────────────────────────────────────────────────
describe("Navbar: ThemeToggle integration", () => {
    const navbarSrc = src("components/Navbar.tsx");

    it("AC-navbar-1: ThemeToggle is imported in Navbar", () => {
        expect(navbarSrc).toMatch(/import.*ThemeToggle/);
    });

    it("AC-navbar-1: DropdownMenuItem wrapping ThemeToggle uses onSelect + preventDefault", () => {
        // Both authenticated and unauthenticated branches should use this pattern
        const matches = navbarSrc.match(/onSelect=\{.*e\.preventDefault\(\)/g);
        expect(matches).not.toBeNull();
        // At least 2 occurrences: one for logged-in, one for logged-out menu
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
});
