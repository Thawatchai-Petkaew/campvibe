/**
 * CAM-125 — DS-5 Icon migration tabler→lucide: regression guard.
 *
 * Layer: unit (static source analysis, fs.readFileSync — no DOM renderer).
 *
 * AC coverage:
 *   AC-no-tabler-1   No file under app/ or components/ imports @tabler/icons-react
 *   AC-no-tabler-2   package.json has no @tabler/icons-react dependency
 *   AC-lucide-1      CampgroundCard imports Heart from lucide-react
 *   AC-lucide-2      WishlistPageClient imports Heart from lucide-react
 *   AC-lucide-3      sonner.tsx imports CircleCheck, TriangleAlert, OctagonAlert, Info from lucide-react
 *   AC-lucide-4      select.tsx imports ChevronsUpDown from lucide-react
 *   AC-lucide-5      FilterModal imports X and SlidersHorizontal from lucide-react
 *   AC-lucide-6      Navbar imports from lucide-react (not tabler)
 *   AC-lucide-7      ThemeToggle imports Sun, Laptop, Moon from lucide-react
 *   AC-filled-1      CampgroundCard filled-heart branch uses fill-current (not just outline)
 *   AC-filled-2      The fill-current is on <Heart (not on a container element)
 *   AC-filled-3      WishlistPageClient decorative filled heart uses fill-current
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

// Recursively collect all .ts / .tsx files under a directory
function collectFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath));
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            results.push(fullPath);
        }
    }
    return results;
}

const appFiles = collectFiles(path.join(root, "app"));
const componentFiles = collectFiles(path.join(root, "components"));
const allSourceFiles = [...appFiles, ...componentFiles];

const packageJson = JSON.parse(src("package.json"));

// ─────────────────────────────────────────────────────────────
// AC-no-tabler-1  No @tabler import in any app/ or components/ file
// ─────────────────────────────────────────────────────────────
describe("ds5-icon-lucide: no @tabler/icons-react import anywhere", () => {
    it("AC-no-tabler-1: zero source files import @tabler/icons-react", () => {
        const offenders = allSourceFiles.filter((filePath) => {
            const content = fs.readFileSync(filePath, "utf-8");
            return content.includes("@tabler/icons-react");
        });
        if (offenders.length > 0) {
            console.error("Files still importing @tabler:", offenders.map(f => path.relative(root, f)));
        }
        expect(offenders).toHaveLength(0);
    });

    it("AC-no-tabler-1: app/ directory scanned (non-empty)", () => {
        expect(appFiles.length).toBeGreaterThan(0);
    });

    it("AC-no-tabler-1: components/ directory scanned (non-empty)", () => {
        expect(componentFiles.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-no-tabler-2  package.json has no @tabler dep
// ─────────────────────────────────────────────────────────────
describe("ds5-icon-lucide: package.json has no @tabler dependency", () => {
    it("AC-no-tabler-2: @tabler/icons-react absent from dependencies", () => {
        const deps = packageJson.dependencies ?? {};
        expect(Object.keys(deps)).not.toContain("@tabler/icons-react");
    });

    it("AC-no-tabler-2: @tabler/icons-react absent from devDependencies", () => {
        const devDeps = packageJson.devDependencies ?? {};
        expect(Object.keys(devDeps)).not.toContain("@tabler/icons-react");
    });

    it("AC-no-tabler-2: lucide-react IS present in dependencies", () => {
        const deps = packageJson.dependencies ?? {};
        expect(Object.keys(deps)).toContain("lucide-react");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-1  CampgroundCard — Heart from lucide-react
// ─────────────────────────────────────────────────────────────
describe("card--campground: Heart imported from lucide-react", () => {
    const cardSrc = src("components/CampgroundCard.tsx");

    it("AC-lucide-1: imports Heart from lucide-react", () => {
        expect(cardSrc).toMatch(/import.*\bHeart\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-1: renders <Heart in JSX", () => {
        expect(cardSrc).toMatch(/<Heart\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-2  WishlistPageClient — Heart from lucide-react
// ─────────────────────────────────────────────────────────────
describe("page--wishlist: Heart imported from lucide-react", () => {
    const wishlistSrc = src("components/WishlistPageClient.tsx");

    it("AC-lucide-2: imports Heart from lucide-react", () => {
        expect(wishlistSrc).toMatch(/import.*\bHeart\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-2: renders <Heart in JSX", () => {
        expect(wishlistSrc).toMatch(/<Heart\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-3  sonner.tsx — toast icons from lucide-react
// ─────────────────────────────────────────────────────────────
describe("toast--sonner: all toast icons from lucide-react", () => {
    const sonnerSrc = src("components/ui/sonner.tsx");

    it("AC-lucide-3: imports CircleCheck from lucide-react", () => {
        expect(sonnerSrc).toMatch(/import.*\bCircleCheck\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-3: imports TriangleAlert from lucide-react", () => {
        expect(sonnerSrc).toMatch(/import.*\bTriangleAlert\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-3: imports OctagonAlert from lucide-react", () => {
        expect(sonnerSrc).toMatch(/import.*\bOctagonAlert\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-3: imports Info from lucide-react", () => {
        expect(sonnerSrc).toMatch(/import.*\bInfo\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-3: uses <CircleCheck in JSX (success toast)", () => {
        expect(sonnerSrc).toMatch(/<CircleCheck\b/);
    });

    it("AC-lucide-3: uses <TriangleAlert in JSX (warning toast)", () => {
        expect(sonnerSrc).toMatch(/<TriangleAlert\b/);
    });

    it("AC-lucide-3: uses <OctagonAlert in JSX (error toast)", () => {
        expect(sonnerSrc).toMatch(/<OctagonAlert\b/);
    });

    it("AC-lucide-3: uses <Info in JSX (info toast)", () => {
        expect(sonnerSrc).toMatch(/<Info\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-4  select.tsx — ChevronsUpDown (replaces IconSelector)
// ─────────────────────────────────────────────────────────────
describe("select: ChevronsUpDown from lucide-react (replaces IconSelector)", () => {
    const selectSrc = src("components/ui/select.tsx");

    it("AC-lucide-4: imports ChevronsUpDown from lucide-react", () => {
        expect(selectSrc).toMatch(/import.*\bChevronsUpDown\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-4: uses <ChevronsUpDown in JSX", () => {
        expect(selectSrc).toMatch(/<ChevronsUpDown\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-5  FilterModal — X and SlidersHorizontal (replaces IconAdjustmentsHorizontal)
// CAM-220: X (the close icon) migrated from FilterModal into the shared ModalHeader in
// components/ui/modal-shell.tsx. SlidersHorizontal (the trigger icon) remains in FilterModal.
// The "lucide-only, no-@tabler" intent is preserved; assertions redirect to where each icon lives.
// ─────────────────────────────────────────────────────────────
describe("modal--filter: X and SlidersHorizontal from lucide-react", () => {
    const filterSrc = src("components/FilterModal.tsx");
    const shellSrc = src("components/ui/modal-shell.tsx");

    it("AC-lucide-5: X icon imported from lucide-react (now in modal-shell.tsx, not FilterModal)", () => {
        // CAM-220: X moved to the shared ModalHeader shell. Asserting here preserves the
        // "X is a lucide named import, not a @tabler import" invariant.
        expect(shellSrc).toMatch(/import.*\bX\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-5: imports SlidersHorizontal from lucide-react", () => {
        expect(filterSrc).toMatch(/import.*\bSlidersHorizontal\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-5: uses <SlidersHorizontal in JSX (trigger icon)", () => {
        expect(filterSrc).toMatch(/<SlidersHorizontal\b/);
    });

    it("AC-lucide-5: uses <X in JSX (close button, now in modal-shell.tsx)", () => {
        // CAM-220: <X renders inside ModalHeader in the shell, not inline in FilterModal.
        expect(shellSrc).toMatch(/<X\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-6  Navbar — imports from lucide-react (not tabler)
// ─────────────────────────────────────────────────────────────
describe("section--navbar: icons from lucide-react", () => {
    const navbarSrc = src("components/Navbar.tsx");

    it("AC-lucide-6: imports Menu from lucide-react (replaces IconMenu2)", () => {
        expect(navbarSrc).toMatch(/import.*\bMenu\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-6: no @tabler import in Navbar", () => {
        expect(navbarSrc).not.toContain("@tabler/icons-react");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-lucide-7  ThemeToggle — Sun, Laptop, Moon from lucide-react
// ─────────────────────────────────────────────────────────────
describe("btn--theme-toggle: icons from lucide-react", () => {
    const themeSrc = src("components/ThemeToggle.tsx");

    it("AC-lucide-7: imports Sun from lucide-react", () => {
        expect(themeSrc).toMatch(/import.*\bSun\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-7: imports Laptop from lucide-react (replaces IconDeviceLaptop)", () => {
        expect(themeSrc).toMatch(/import.*\bLaptop\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-7: imports Moon from lucide-react", () => {
        expect(themeSrc).toMatch(/import.*\bMoon\b.*from ["']lucide-react["']/);
    });

    it("AC-lucide-7: no @tabler import in ThemeToggle", () => {
        expect(themeSrc).not.toContain("@tabler/icons-react");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-filled-1/2  CampgroundCard filled-heart must use fill-current on <Heart
// ─────────────────────────────────────────────────────────────
describe("card--campground: filled heart uses fill-current (not just outline)", () => {
    const cardSrc = src("components/CampgroundCard.tsx");

    it("AC-filled-1: fill-current class exists in CampgroundCard (filled state)", () => {
        expect(cardSrc).toMatch(/fill-current/);
    });

    it("AC-filled-2: fill-current appears on <Heart element line (not a container)", () => {
        // The fill-current must be inside a <Heart ... /> element
        expect(cardSrc).toMatch(/<Heart[^>]*fill-current/);
    });

    it("AC-filled-2: saved branch renders filled Heart with text-primary fill-current", () => {
        // Exact pair: teal brand fill for wishlist saved state
        expect(cardSrc).toMatch(/<Heart[^>]*text-primary fill-current/);
    });

    it("AC-filled-2: unsaved branch renders outline Heart (no fill-current on the outline Heart)", () => {
        // The outline Heart should have text-white drop-shadow-sm, no fill-current
        expect(cardSrc).toMatch(/<Heart[^>]*text-white drop-shadow-sm/);
        // And the outline Heart line should NOT contain fill-current
        const outlineMatch = cardSrc.match(/<Heart[^>]*text-white[^>]*>/);
        expect(outlineMatch).not.toBeNull();
        expect(outlineMatch![0]).not.toContain("fill-current");
    });

    it("AC-filled-2: Heart icons are aria-hidden (decorative; a11y label on button)", () => {
        const ariaHiddenMatches = cardSrc.match(/aria-hidden=["']true["']/g);
        expect(ariaHiddenMatches).not.toBeNull();
        // At least the 2 Heart instances must be aria-hidden
        expect(ariaHiddenMatches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-filled-3  WishlistPageClient decorative filled heart
// ─────────────────────────────────────────────────────────────
describe("page--wishlist: decorative filled heart uses fill-current", () => {
    const wishlistSrc = src("components/WishlistPageClient.tsx");

    it("AC-filled-3: wishlist page contains fill-current (decorative heart illustration)", () => {
        expect(wishlistSrc).toMatch(/fill-current/);
    });

    it("AC-filled-3: fill-current is on <Heart element in WishlistPageClient", () => {
        expect(wishlistSrc).toMatch(/<Heart[^>]*fill-current/);
    });
});
