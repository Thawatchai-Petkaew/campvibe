/**
 * CAM-108 — F3 Detail Surface: source-inspection tests.
 *
 * Layer: unit (static source analysis, fs.readFileSync — vitest env is 'node').
 * Style: mirrors __tests__/f2-listing-surface.test.ts pattern.
 *
 * AC coverage:
 *   AC-token-1     No forbidden palette tokens in CampgroundDetailClient
 *   AC-token-2     No forbidden palette tokens in AmenitiesModal
 *   AC-token-3     No forbidden palette tokens in MapComponent
 *   AC-token-4     ImageGallery bg-black/95 has exemption comment co-located
 *   AC-token-5     ImageGallery text-white / hover:bg-white/* / ring-white / ring-offset-black/95 are
 *                  scrim-only (all on elements inside the scrim, not raw bg-white)
 *   AC-token-6     MapComponent uses var(--primary)/var(--primary-foreground)/var(--popover) — no raw hex/rgba
 *   AC-a11y-1      ImageGallery wrapper has role="dialog" aria-modal aria-label
 *   AC-a11y-2      ImageGallery close button has aria-label + p-3 (≥44px) + focus ring
 *   AC-a11y-3      ImageGallery prev/next buttons have aria-label + p-3 + focus ring
 *   AC-a11y-4      ImageGallery thumbnails have aria-label
 *   AC-a11y-5      ImageGallery counter has aria-live="polite"
 *   AC-a11y-6      ImageGallery keyboard handler wired via useEffect (Escape + ArrowLeft/ArrowRight)
 *   AC-a11y-7      Reserve button has aria-busy when loading
 *   AC-dark-1      Star uses fill-foreground (dark-mode safe, not fill-black or fill-yellow)
 *   AC-dark-2      Mobile counter uses bg-foreground/60 text-background
 *   AC-dark-3      MapComponent popup uses var(--popover) (readable in dark)
 *   AC-dark-4      Booking widget is sticky md / stacks mobile (sticky top-*)
 *   AC-map-1       MapComponent price uses formatCurrency (no bare "$")
 *   AC-i18n-1      gallery.{viewerTitle,closeViewer,previousImage,nextImage,imageOf,openGallery}
 *                  present in both en + th
 *   AC-i18n-2      newCampground.reserving present in both en + th
 *   AC-i18n-3      booking.selectDatesFirst present in both en + th
 *   AC-i18n-4      gallery.imageOf contains {n} and {total} in both locales
 *   AC-i18n-5      No em-dash in Thai gallery / newCampground / booking copy
 *   AC-i18n-6      No hardcoded English copy in ImageGallery (all text via t.gallery.*)
 *   AC-defect-D1   gallery.openGallery i18n key is UNUSED in components
 *                  (defect: "Show all photos" buttons use t.newCampground.showAllPhotos/allPhotos
 *                   instead of the purpose-built t.gallery.openGallery key)
 *   AC-defect-D2   Mobile counter is hardcoded "1 / {images.length}" — not using t.gallery.imageOf
 *   AC-defect-D3   Hero grid images use hardcoded alt text ("hero-mobile","main","sub 1-4")
 *                  instead of descriptive i18n strings
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

const gallerySrc = src("components/ImageGallery.tsx");
const mapSrc = src("components/MapComponent.tsx");
const amenitiesSrc = src("components/AmenitiesModal.tsx");
const detailSrc = src("components/CampgroundDetailClient.tsx");

const ALL_FOUR = [gallerySrc, mapSrc, amenitiesSrc, detailSrc];
const FILE_NAMES = [
    "ImageGallery.tsx",
    "MapComponent.tsx",
    "AmenitiesModal.tsx",
    "CampgroundDetailClient.tsx",
];

// ─────────────────────────────────────────────────────────────
// AC-token-1/2/3  Forbidden palette tokens (non-ImageGallery files are fully clean)
// ─────────────────────────────────────────────────────────────
describe("token-compliance: forbidden palette tokens in non-gallery files", () => {
    const FORBIDDEN: Array<[string, RegExp]> = [
        ["text-black", /\btext-black\b/],
        ["fill-black", /\bfill-black\b/],
        ["bg-gray-*", /\bbg-gray-\d/],
        ["text-gray-*", /\btext-gray-\d/],
        ["border-gray-*", /\bborder-gray-\d/],
        ["bg-white", /\bbg-white\b/],
        ["hex color", /#[0-9a-fA-F]{3,6}\b/],
        ["rgba()", /rgba\(/],
        ["dark:bg-*", /dark:bg-/],
        ["dark:text-*", /dark:text-/],
        ["dark:ring-*", /dark:ring-/],
        ["dark:border-*", /dark:border-/],
    ];

    // MapComponent and AmenitiesModal must be fully clean (no exemptions)
    [mapSrc, amenitiesSrc].forEach((fileSrc, i) => {
        const fileName = ["MapComponent.tsx", "AmenitiesModal.tsx"][i];
        FORBIDDEN.forEach(([label, pattern]) => {
            it(`AC-token-${i + 2}: ${fileName} has no ${label}`, () => {
                expect(fileSrc).not.toMatch(pattern);
            });
        });
    });

    // CampgroundDetailClient must also be fully clean
    FORBIDDEN.forEach(([label, pattern]) => {
        it(`AC-token-1: CampgroundDetailClient.tsx has no ${label}`, () => {
            expect(detailSrc).not.toMatch(pattern);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-4  ImageGallery bg-black/95 has the required exemption comment
// ─────────────────────────────────────────────────────────────
describe("token-compliance: ImageGallery scrim exemption", () => {
    it("AC-token-4: bg-black/95 is present (lightbox scrim)", () => {
        expect(gallerySrc).toMatch(/bg-black\/95/);
    });

    it("AC-token-4: exemption comment is co-located with the scrim div (within 5 source lines)", () => {
        // The comment and the bg-black/95 className must appear close together in source
        expect(gallerySrc).toMatch(/photo-viewer scrim.*\n[\s\S]{0,300}bg-black\/95/);
    });

    it("AC-token-4: exemption comment references DESIGN.md F3 exception", () => {
        expect(gallerySrc).toMatch(/exempt per DESIGN\.md F3/);
    });

    it("AC-token-4: ImageGallery has no raw bg-white (allowed: hover:bg-white/* over scrim only)", () => {
        // bg-white as a standalone class (not bg-white/anything) must not appear
        expect(gallerySrc).not.toMatch(/\bbg-white\b(?!\/)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-5  ImageGallery white tokens are scrim-only (over-scrim overlay)
// ─────────────────────────────────────────────────────────────
describe("token-compliance: ImageGallery white tokens are scrim-only", () => {
    it("AC-token-5: text-white appears (over scrim — counter, buttons)", () => {
        expect(gallerySrc).toMatch(/\btext-white\b/);
    });

    it("AC-token-5: hover:bg-white/* is fractional opacity (scrim-safe)", () => {
        // Only hover:bg-white/N form allowed — not bare hover:bg-white
        const matches = gallerySrc.match(/hover:bg-white(?:\/\d+)?/g) ?? [];
        matches.forEach((cls) => {
            expect(cls).toMatch(/hover:bg-white\/\d+/);
        });
    });

    it("AC-token-5: ring-offset-black/95 is fractional (scrim-safe)", () => {
        // ring-offset-black/95 is the exempted form
        expect(gallerySrc).toMatch(/ring-offset-black\/95/);
        // bare ring-offset-black must not appear
        expect(gallerySrc).not.toMatch(/\bring-offset-black\b(?!\/)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-token-6  MapComponent uses CSS custom properties — no raw hex / rgba
// ─────────────────────────────────────────────────────────────
describe("token-compliance: MapComponent uses var() / color-mix() — no raw hex or rgba", () => {
    it("AC-token-6: pin SVG fill uses var(--primary)", () => {
        expect(mapSrc).toMatch(/fill="var\(--primary\)"/);
    });

    it("AC-token-6: pin SVG inner circle uses var(--primary-foreground)", () => {
        expect(mapSrc).toMatch(/fill="var\(--primary-foreground\)"/);
    });

    it("AC-token-6: popup background uses var(--popover)", () => {
        expect(mapSrc).toMatch(/var\(--popover\)/);
    });

    it("AC-token-6: popup text uses var(--popover-foreground)", () => {
        expect(mapSrc).toMatch(/var\(--popover-foreground\)/);
    });

    it("AC-token-6: shadow uses color-mix(...) — not a raw hex or rgba", () => {
        expect(mapSrc).toMatch(/color-mix\(/);
        expect(mapSrc).not.toMatch(/rgba\(/);
        expect(mapSrc).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-1  ImageGallery dialog wrapper: role + aria-modal + aria-label
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery viewer wrapper", () => {
    it("AC-a11y-1: wrapper has role=\"dialog\"", () => {
        expect(gallerySrc).toMatch(/role="dialog"/);
    });

    it("AC-a11y-1: wrapper has aria-modal=\"true\"", () => {
        expect(gallerySrc).toMatch(/aria-modal="true"/);
    });

    it("AC-a11y-1: wrapper aria-label is driven by i18n (t.gallery.viewerTitle)", () => {
        expect(gallerySrc).toMatch(/aria-label=\{t\.gallery\.viewerTitle\}/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-2  ImageGallery close button: aria-label + ≥44px + focus ring
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery close button", () => {
    it("AC-a11y-2: close button has aria-label={t.gallery.closeViewer}", () => {
        expect(gallerySrc).toMatch(/aria-label=\{t\.gallery\.closeViewer\}/);
    });

    it("AC-a11y-2: close button has p-3 (≥44px hit target)", () => {
        // The close button must have p-3 to ensure the tap target is at least 44px
        expect(gallerySrc).toMatch(/closeViewer[\s\S]{0,200}p-3/);
    });

    it("AC-a11y-2: close button has focus:ring-2 (keyboard focus ring)", () => {
        expect(gallerySrc).toMatch(/focus:ring-2/);
    });

    it("AC-a11y-2: close button has focus:ring-white (ring color over scrim)", () => {
        expect(gallerySrc).toMatch(/focus:ring-white/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-3  ImageGallery prev/next: aria-label + p-3 + focus ring
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery prev/next buttons", () => {
    it("AC-a11y-3: previous button has aria-label={t.gallery.previousImage}", () => {
        expect(gallerySrc).toMatch(/aria-label=\{t\.gallery\.previousImage\}/);
    });

    it("AC-a11y-3: next button has aria-label={t.gallery.nextImage}", () => {
        expect(gallerySrc).toMatch(/aria-label=\{t\.gallery\.nextImage\}/);
    });

    it("AC-a11y-3: previous button has p-3 (≥44px hit target)", () => {
        expect(gallerySrc).toMatch(/previousImage[\s\S]{0,200}p-3/);
    });

    it("AC-a11y-3: next button has p-3 (≥44px hit target)", () => {
        expect(gallerySrc).toMatch(/nextImage[\s\S]{0,200}p-3/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-4  ImageGallery thumbnails: aria-label per thumbnail
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery thumbnails", () => {
    it("AC-a11y-4: thumbnail buttons have aria-label using t.gallery.imageOf template", () => {
        expect(gallerySrc).toMatch(/t\.gallery\.imageOf\.replace/);
    });

    it("AC-a11y-4: thumbnail aria-label replaces {n} placeholder", () => {
        expect(gallerySrc).toMatch(/replace\(['"]\{n\}['"]/);
    });

    it("AC-a11y-4: thumbnail aria-label replaces {total} placeholder", () => {
        expect(gallerySrc).toMatch(/replace\(['"]\{total\}['"]/);
    });

    it("AC-a11y-4: active thumbnail has aria-current attribute", () => {
        expect(gallerySrc).toMatch(/aria-current/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-5  ImageGallery counter: aria-live
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery counter announcements", () => {
    it("AC-a11y-5: counter container has aria-live=\"polite\"", () => {
        expect(gallerySrc).toMatch(/aria-live="polite"/);
    });

    it("AC-a11y-5: counter container has aria-atomic=\"true\"", () => {
        expect(gallerySrc).toMatch(/aria-atomic="true"/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-6  Keyboard navigation via useEffect
// ─────────────────────────────────────────────────────────────
describe("a11y: ImageGallery keyboard navigation", () => {
    it("AC-a11y-6: useEffect wires keydown listener", () => {
        expect(gallerySrc).toMatch(/addEventListener\("keydown"/);
    });

    it("AC-a11y-6: Escape key closes the viewer", () => {
        expect(gallerySrc).toMatch(/e\.key === "Escape"/);
    });

    it("AC-a11y-6: ArrowLeft key navigates to previous image", () => {
        expect(gallerySrc).toMatch(/e\.key === "ArrowLeft"/);
    });

    it("AC-a11y-6: ArrowRight key navigates to next image", () => {
        expect(gallerySrc).toMatch(/e\.key === "ArrowRight"/);
    });

    it("AC-a11y-6: keydown listener is cleaned up on unmount (removeEventListener)", () => {
        expect(gallerySrc).toMatch(/removeEventListener\("keydown"/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-a11y-7  Reserve button: aria-busy during loading
// ─────────────────────────────────────────────────────────────
describe("a11y: Reserve button aria-busy", () => {
    it("AC-a11y-7: Reserve button has aria-busy={isReserving}", () => {
        expect(detailSrc).toMatch(/aria-busy=\{isReserving\}/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-1  Star uses fill-foreground (dark-mode safe)
// ─────────────────────────────────────────────────────────────
describe("dark-mode: star rating uses semantic fill token", () => {
    it("AC-dark-1: CampgroundDetailClient star uses fill-foreground (not fill-black or fill-yellow)", () => {
        expect(detailSrc).toMatch(/fill-foreground/);
        expect(detailSrc).not.toMatch(/\bfill-black\b/);
        expect(detailSrc).not.toMatch(/fill-yellow/);
    });

    it("AC-dark-1: MapComponent star popup uses fill-foreground", () => {
        expect(mapSrc).toMatch(/fill-foreground/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-2  Mobile counter uses bg-foreground/60 text-background
// ─────────────────────────────────────────────────────────────
describe("dark-mode: mobile image counter tokens", () => {
    it("AC-dark-2: mobile counter overlay uses bg-foreground/60 (dark-mode safe)", () => {
        expect(detailSrc).toMatch(/bg-foreground\/60/);
    });

    it("AC-dark-2: mobile counter text uses text-background (dark-mode safe)", () => {
        expect(detailSrc).toMatch(/text-background/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-3  MapComponent popup uses var(--popover)
// ─────────────────────────────────────────────────────────────
describe("dark-mode: map popup readable in dark mode", () => {
    it("AC-dark-3: popup wrapper background uses var(--popover) CSS variable", () => {
        expect(mapSrc).toMatch(/background:\s*var\(--popover\)/);
    });

    it("AC-dark-3: popup text uses var(--popover-foreground) CSS variable", () => {
        expect(mapSrc).toMatch(/color:\s*var\(--popover-foreground\)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-dark-4  Booking widget: sticky on md, stacks on mobile
// ─────────────────────────────────────────────────────────────
describe("responsive: booking widget layout", () => {
    it("AC-dark-4: booking widget div has sticky class (md desktop)", () => {
        expect(detailSrc).toMatch(/\bsticky\b/);
    });

    it("AC-dark-4: booking widget is in md:col-span-1 grid column (right sidebar)", () => {
        expect(detailSrc).toMatch(/md:col-span-1/);
    });

    it("AC-dark-4: gallery hero grid has md:grid (desktop only split)", () => {
        expect(detailSrc).toMatch(/hidden md:grid/);
    });

    it("AC-dark-4: mobile hero is md:hidden (collapses to single on mobile)", () => {
        expect(detailSrc).toMatch(/md:hidden/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-map-1  MapComponent price uses formatCurrency (no bare "$")
// ─────────────────────────────────────────────────────────────
describe("map: price format", () => {
    it("AC-map-1: price is rendered via formatCurrency (not bare $)", () => {
        expect(mapSrc).toMatch(/formatCurrency\(campground\.priceLow\)/);
    });

    it("AC-map-1: MapComponent has no bare dollar sign in JSX/template", () => {
        // A bare "$ " or >"$" pattern would indicate hardcoded USD symbol
        expect(mapSrc).not.toMatch(/>\s*\$\s*</);
        expect(mapSrc).not.toMatch(/[`"']\$/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-1  gallery.* keys in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: gallery keys present in both locales", () => {
    const galleryKeys = ["viewerTitle", "closeViewer", "previousImage", "nextImage", "imageOf", "openGallery"] as const;

    galleryKeys.forEach((key) => {
        it(`AC-i18n-1: gallery.${key} is non-empty in EN`, () => {
            expect(translations.en.gallery[key]).toBeTruthy();
        });

        it(`AC-i18n-1: gallery.${key} is non-empty in TH`, () => {
            expect(translations.th.gallery[key]).toBeTruthy();
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-2  newCampground.reserving in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: newCampground.reserving in both locales", () => {
    it("AC-i18n-2: newCampground.reserving is non-empty in EN", () => {
        expect(translations.en.newCampground.reserving).toBeTruthy();
    });

    it("AC-i18n-2: newCampground.reserving is non-empty in TH", () => {
        expect(translations.th.newCampground.reserving).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-3  booking.selectDatesFirst in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: booking.selectDatesFirst in both locales", () => {
    it("AC-i18n-3: booking.selectDatesFirst is non-empty in EN", () => {
        expect(translations.en.booking.selectDatesFirst).toBeTruthy();
    });

    it("AC-i18n-3: booking.selectDatesFirst is non-empty in TH", () => {
        expect(translations.th.booking.selectDatesFirst).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-4  gallery.imageOf has {n} and {total} in both locales
// ─────────────────────────────────────────────────────────────
describe("i18n: gallery.imageOf template placeholders", () => {
    it("AC-i18n-4: EN gallery.imageOf contains {n} placeholder", () => {
        expect(translations.en.gallery.imageOf).toContain("{n}");
    });

    it("AC-i18n-4: EN gallery.imageOf contains {total} placeholder", () => {
        expect(translations.en.gallery.imageOf).toContain("{total}");
    });

    it("AC-i18n-4: TH gallery.imageOf contains {n} placeholder", () => {
        expect(translations.th.gallery.imageOf).toContain("{n}");
    });

    it("AC-i18n-4: TH gallery.imageOf contains {total} placeholder", () => {
        expect(translations.th.gallery.imageOf).toContain("{total}");
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-5  No em-dash in Thai F3 copy groups
// ─────────────────────────────────────────────────────────────
describe("i18n: no em-dash in Thai F3 copy", () => {
    const groups = ["gallery", "newCampground", "booking", "campground"] as const;

    groups.forEach((group) => {
        it(`AC-i18n-5: Thai ${group} values contain no em-dash (—)`, () => {
            const values = Object.values(translations.th[group]) as string[];
            values.forEach((v) => {
                expect(v).not.toMatch(/—/);
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n-6  ImageGallery has no hardcoded English copy
// ─────────────────────────────────────────────────────────────
describe("i18n: ImageGallery viewer has no hardcoded English copy", () => {
    it("AC-i18n-6: viewer title is not hardcoded (must be via t.gallery)", () => {
        expect(gallerySrc).not.toMatch(/"Photo viewer"/);
        expect(gallerySrc).not.toMatch(/"photo viewer"/);
    });

    it("AC-i18n-6: close label is not hardcoded (must be via t.gallery)", () => {
        expect(gallerySrc).not.toMatch(/"Close photo viewer"/);
        expect(gallerySrc).not.toMatch(/"Close"/);
    });

    it("AC-i18n-6: previous label is not hardcoded (must be via t.gallery)", () => {
        expect(gallerySrc).not.toMatch(/"Previous photo"/);
        expect(gallerySrc).not.toMatch(/"Previous"/);
    });

    it("AC-i18n-6: next label is not hardcoded (must be via t.gallery)", () => {
        expect(gallerySrc).not.toMatch(/"Next photo"/);
        expect(gallerySrc).not.toMatch(/"Next"/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-defect-D1  gallery.openGallery i18n key is UNUSED in components
// This test DOCUMENTS and PROVES the defect: the spec-required gallery.openGallery key
// is defined in translations but never consumed. "Show all photos" buttons use
// t.newCampground.showAllPhotos / t.newCampground.allPhotos instead.
// ─────────────────────────────────────────────────────────────
describe("defect-D1: gallery.openGallery i18n key is unused [DEFECT]", () => {
    it("AC-defect-D1: gallery.openGallery key exists in EN locale (it is defined)", () => {
        expect(translations.en.gallery.openGallery).toBeTruthy();
    });

    it("AC-defect-D1: gallery.openGallery key exists in TH locale (it is defined)", () => {
        expect(translations.th.gallery.openGallery).toBeTruthy();
    });

    it("AC-defect-D1 [DEFECT]: CampgroundDetailClient does NOT use t.gallery.openGallery for show-all-photos buttons", () => {
        // The spec requires t.gallery.openGallery for the gallery-open action.
        // Actual code uses t.newCampground.showAllPhotos and t.newCampground.allPhotos.
        // This test asserts the current broken behaviour to document the defect.
        expect(detailSrc).not.toMatch(/t\.gallery\.openGallery/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-defect-D2  Mobile counter is hardcoded, not using i18n imageOf template
// ─────────────────────────────────────────────────────────────
describe("defect-D2: mobile hero counter hardcoded [DEFECT]", () => {
    it("AC-defect-D2 [DEFECT]: CampgroundDetailClient mobile counter uses hardcoded '1 / {images.length}' instead of t.gallery.imageOf", () => {
        // Spec requires the mobile counter to use the same gallery.imageOf i18n template
        // so it reads "1 of 5" in EN and "1 จาก 5" in TH.
        // Current code has the raw string: 1 / {images.length}
        expect(detailSrc).toMatch(/1 \/ \{images\.length\}/);
    });

    it("AC-defect-D2 [DEFECT]: mobile counter does NOT use t.gallery.imageOf", () => {
        // If this ever passes (no hardcoded string found), the defect is fixed
        // but the matching test above would also need to be updated.
        // For now both tests document the defect state.
        const mobileCounterBlock = detailSrc.match(/md:hidden[\s\S]{0,500}?<\/div>/);
        if (mobileCounterBlock) {
            expect(mobileCounterBlock[0]).not.toMatch(/t\.gallery\.imageOf/);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// AC-defect-D3  Hero grid images have hardcoded alt text
// ─────────────────────────────────────────────────────────────
describe("defect-D3: hero grid image alt text hardcoded [DEFECT]", () => {
    it("AC-defect-D3 [DEFECT]: main desktop hero image has hardcoded alt='main'", () => {
        expect(detailSrc).toMatch(/alt="main"/);
    });

    it("AC-defect-D3 [DEFECT]: mobile hero image has hardcoded alt='hero-mobile'", () => {
        expect(detailSrc).toMatch(/alt="hero-mobile"/);
    });

    it("AC-defect-D3 [DEFECT]: sub-grid images have hardcoded alt='sub 1', 'sub 2', etc.", () => {
        expect(detailSrc).toMatch(/alt="sub \d"/);
    });
});
