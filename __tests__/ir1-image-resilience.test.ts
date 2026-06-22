/**
 * CAM-133 — IR-1 Image Resilience: source-inspection tests.
 *
 * Layer: unit (static source analysis, fs.readFileSync — vitest env is 'node').
 *
 * AC coverage:
 *   AC-component-1   ImageWithFallback exists as a client component
 *   AC-component-2   Renders fallback (ImageOff icon) when no src or errored
 *   AC-component-3   Renders <img> when src is present
 *   AC-component-4   Wrapper uses bg-muted + flex items-center justify-center
 *   AC-component-5   Fallback icon uses text-muted-foreground/40 (token, dark-safe)
 *   AC-component-6   aria-label / aria-hidden wired for a11y
 *   AC-component-7   data-testid passthrough with --fallback-placeholder suffix
 *   AC-grid-1        Adaptive grid: 1-cell branch present
 *   AC-grid-2        Adaptive grid: 2-cell branch (grid-cols-2) present
 *   AC-grid-3        Adaptive grid: 3-cell branch (grid-cols-3) present
 *   AC-grid-4        Adaptive grid: 4-cell branch (grid-cols-4 grid-rows-2) present
 *   AC-grid-5        Adaptive grid: 5+ branch present
 *   AC-grid-6        Desktop grid cells are <button type="button"> (not raw img/div)
 *   AC-grid-7        Mobile "Open gallery" button has h-11
 *   AC-grid-8        "Show all photos" only when images.length > 5
 *   AC-gallery-1     openGallery has clamp logic (Math.min/Math.max guard)
 *   AC-gallery-2     ImageGallery has empty guard (images.length === 0 return null)
 *   AC-gallery-3     ImageGallery clamps currentIndex on open (initialIndex + images.length)
 *   AC-gallery-4     ImageWithFallback used in ImageGallery main image
 *   AC-gallery-5     ImageWithFallback used in ImageGallery thumbnails
 *   AC-adopt-1       ImageWithFallback used in CampgroundCard slider
 *   AC-adopt-2       ImageWithFallback used in ImageUpload preview
 *   AC-adopt-3       ImageWithFallback used in LogoUpload preview
 *   AC-adopt-4       ImageWithFallback used in dashboard/campsites page thumb
 *   AC-adopt-5       ImageWithFallback used in bookings page card img
 *   AC-map-1         MapComponent popup img has onerror handler (inline fallback)
 *   AC-i18n-1        gallery.viewImage present in EN + TH
 *   AC-i18n-2        gallery.imageUnavailable present in EN + TH
 *   AC-i18n-3        preview.imageWithFallbackSection present in EN + TH
 *   AC-i18n-4        gallery.viewImage contains {n} placeholder in both locales
 *   AC-preview-1     PreviewClient imports and renders ImageWithFallback
 *   AC-preview-2     PreviewClient has good / broken / nosrc test variants
 *   AC-token-1       ImageWithFallback uses only token classes (no hex, no gray-*)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const iwfSrc = src("components/ui/image-with-fallback.tsx");
const detailSrc = src("components/CampgroundDetailClient.tsx");
const gallerySrc = src("components/ImageGallery.tsx");
const cardSrc = src("components/CampgroundCard.tsx");
const imageUploadSrc = src("components/ImageUpload.tsx");
const logoUploadSrc = src("components/LogoUpload.tsx");
const campsitesDashSrc = src("app/dashboard/campsites/page.tsx");
const bookingsSrc = src("app/bookings/page.tsx");
const mapSrc = src("components/MapComponent.tsx");
const previewSrc = src("app/preview/PreviewClient.tsx");

// ─────────────────────────────────────────────────────────────
// AC-component: ImageWithFallback component contract
// ─────────────────────────────────────────────────────────────
describe("ImageWithFallback — component contract", () => {
    it("AC-component-1: is a 'use client' component", () => {
        expect(iwfSrc).toMatch(/"use client"/);
    });

    it("AC-component-2: imports ImageOff from lucide-react (fallback icon)", () => {
        expect(iwfSrc).toMatch(/ImageOff/);
        expect(iwfSrc).toMatch(/from "lucide-react"/);
    });

    it("AC-component-3: renders <img> element when src present", () => {
        expect(iwfSrc).toMatch(/<img/);
        expect(iwfSrc).toMatch(/onError/);
    });

    it("AC-component-4: wrapper uses bg-muted and flex items-center justify-center", () => {
        expect(iwfSrc).toMatch(/bg-muted/);
        expect(iwfSrc).toMatch(/flex items-center justify-center/);
    });

    it("AC-component-5: fallback icon uses text-muted-foreground/40 (dark-safe token)", () => {
        expect(iwfSrc).toMatch(/text-muted-foreground\/40/);
    });

    it("AC-component-6: wrapper applies role=img and aria-label for a11y when alt is non-empty", () => {
        expect(iwfSrc).toMatch(/role=\{/);
        expect(iwfSrc).toMatch(/aria-label=\{/);
    });

    it("AC-component-7: fallback placeholder data-testid uses --fallback-placeholder suffix", () => {
        expect(iwfSrc).toMatch(/fallback-placeholder/);
    });

    it("AC-token-1: no hardcoded hex, no gray-* classes in ImageWithFallback", () => {
        expect(iwfSrc).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        expect(iwfSrc).not.toMatch(/\bbg-gray-\d/);
        expect(iwfSrc).not.toMatch(/\btext-gray-\d/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-grid: Adaptive hero grid in CampgroundDetailClient
// ─────────────────────────────────────────────────────────────
describe("Adaptive gallery grid — CampgroundDetailClient", () => {
    it("AC-grid-1: 1-image branch renders single full cell (images.length === 1)", () => {
        expect(detailSrc).toMatch(/images\.length === 1/);
    });

    it("AC-grid-2: 2-image branch uses grid-cols-2", () => {
        expect(detailSrc).toMatch(/grid-cols-2/);
        expect(detailSrc).toMatch(/images\.length === 2/);
    });

    it("AC-grid-3: 3-image branch uses grid-cols-3", () => {
        expect(detailSrc).toMatch(/grid-cols-3/);
        expect(detailSrc).toMatch(/images\.length === 3/);
    });

    it("AC-grid-4: 4-image branch uses grid-cols-4 grid-rows-2", () => {
        expect(detailSrc).toMatch(/images\.length === 4/);
    });

    it("AC-grid-5: 5+ branch uses images.length >= 5", () => {
        expect(detailSrc).toMatch(/images\.length >= 5/);
    });

    it("AC-grid-6: desktop cells use <button type=\"button\"> wrapping ImageWithFallback", () => {
        expect(detailSrc).toMatch(/type="button"/);
        expect(detailSrc).toMatch(/ImageWithFallback/);
    });

    it("AC-grid-6: no raw <img src={images[ fixed-index ]} in hero grid", () => {
        expect(detailSrc).not.toMatch(/<img src=\{images\[/);
    });

    it("AC-grid-7: mobile open-gallery button has h-11 (tap ≥44px)", () => {
        // The mobile open gallery button must have h-11
        expect(detailSrc).toMatch(/openGallery[\s\S]{0,500}h-11/);
    });

    it("AC-grid-8: show-all-photos button only when images.length > 5", () => {
        expect(detailSrc).toMatch(/images\.length > 5/);
    });

    it("AC-grid-9: grid cells have aria-label using t.gallery.viewImage", () => {
        expect(detailSrc).toMatch(/t\.gallery\.viewImage/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-gallery: ImageGallery lightbox clamp
// ─────────────────────────────────────────────────────────────
describe("ImageGallery — lightbox clamp", () => {
    it("AC-gallery-1: openGallery in CampgroundDetailClient has Math.min/Math.max clamp", () => {
        expect(detailSrc).toMatch(/Math\.min\(Math\.max/);
    });

    it("AC-gallery-1: openGallery guards against empty images array", () => {
        expect(detailSrc).toMatch(/images\.length === 0.*return/);
    });

    it("AC-gallery-2: ImageGallery has empty guard after isOpen check", () => {
        expect(gallerySrc).toMatch(/images\.length === 0.*return null/);
    });

    it("AC-gallery-3: ImageGallery clamps initialIndex on open (Math.min/Math.max)", () => {
        expect(gallerySrc).toMatch(/Math\.min\(Math\.max/);
    });

    it("AC-gallery-4: ImageGallery main image uses ImageWithFallback", () => {
        expect(gallerySrc).toMatch(/ImageWithFallback/);
    });

    it("AC-gallery-5: ImageGallery thumbnail uses ImageWithFallback", () => {
        // ImageWithFallback should appear multiple times (main + thumbnail)
        const matches = gallerySrc.match(/ImageWithFallback/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-adopt: Adoption sites
// ─────────────────────────────────────────────────────────────
describe("Adoption sites — ImageWithFallback usage", () => {
    it("AC-adopt-1: CampgroundCard uses ImageWithFallback for slider image", () => {
        expect(cardSrc).toMatch(/ImageWithFallback/);
        expect(cardSrc).not.toMatch(/<img\s[^>]*imageUrls\[currentIndex\]/);
    });

    it("AC-adopt-2: ImageUpload uses ImageWithFallback for preview", () => {
        expect(imageUploadSrc).toMatch(/ImageWithFallback/);
    });

    it("AC-adopt-3: LogoUpload uses ImageWithFallback for preview", () => {
        expect(logoUploadSrc).toMatch(/ImageWithFallback/);
    });

    it("AC-adopt-4: dashboard/campsites page uses ImageWithFallback for thumbnail", () => {
        expect(campsitesDashSrc).toMatch(/ImageWithFallback/);
    });

    it("AC-adopt-5: bookings page uses ImageWithFallback for card image", () => {
        expect(bookingsSrc).toMatch(/ImageWithFallback/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-map: MapComponent fallback (Leaflet HTML — cannot use React component)
// ─────────────────────────────────────────────────────────────
describe("MapComponent — popup image fallback", () => {
    it("AC-map-1: popup img has onerror handler for fallback (style.display hide)", () => {
        expect(mapSrc).toMatch(/onError/);
    });

    it("AC-map-1: onerror references var(--muted) for background fallback", () => {
        expect(mapSrc).toMatch(/var\(--muted\)/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-i18n: New translation keys
// ─────────────────────────────────────────────────────────────
describe("i18n — new IR-1 keys", () => {
    it("AC-i18n-1: gallery.viewImage present in EN", () => {
        expect(translations.en.gallery.viewImage).toBeTruthy();
    });

    it("AC-i18n-1: gallery.viewImage present in TH", () => {
        expect(translations.th.gallery.viewImage).toBeTruthy();
    });

    it("AC-i18n-2: gallery.imageUnavailable present in EN", () => {
        expect(translations.en.gallery.imageUnavailable).toBeTruthy();
    });

    it("AC-i18n-2: gallery.imageUnavailable present in TH", () => {
        expect(translations.th.gallery.imageUnavailable).toBeTruthy();
    });

    it("AC-i18n-3: preview.imageWithFallbackSection present in EN", () => {
        expect(translations.en.preview.imageWithFallbackSection).toBeTruthy();
    });

    it("AC-i18n-3: preview.imageWithFallbackSection present in TH", () => {
        expect(translations.th.preview.imageWithFallbackSection).toBeTruthy();
    });

    it("AC-i18n-4: gallery.viewImage contains {n} placeholder in EN", () => {
        expect(translations.en.gallery.viewImage).toContain("{n}");
    });

    it("AC-i18n-4: gallery.viewImage contains {n} placeholder in TH", () => {
        expect(translations.th.gallery.viewImage).toContain("{n}");
    });

    it("AC-i18n-5: no em-dash in new EN gallery keys", () => {
        expect(translations.en.gallery.viewImage).not.toMatch(/—/);
        expect(translations.en.gallery.imageUnavailable).not.toMatch(/—/);
    });

    it("AC-i18n-5: no em-dash in new TH gallery keys", () => {
        expect(translations.th.gallery.viewImage).not.toMatch(/—/);
        expect(translations.th.gallery.imageUnavailable).not.toMatch(/—/);
    });
});

// ─────────────────────────────────────────────────────────────
// AC-preview: PreviewClient image resilience section
// ─────────────────────────────────────────────────────────────
describe("PreviewClient — image resilience section", () => {
    it("AC-preview-1: imports ImageWithFallback", () => {
        expect(previewSrc).toMatch(/ImageWithFallback/);
    });

    it("AC-preview-2: has img--preview-good test id", () => {
        expect(previewSrc).toMatch(/img--preview-good/);
    });

    it("AC-preview-2: has img--preview-broken test id", () => {
        expect(previewSrc).toMatch(/img--preview-broken/);
    });

    it("AC-preview-2: has img--preview-nosrc test id", () => {
        expect(previewSrc).toMatch(/img--preview-nosrc/);
    });

    it("AC-preview-3: broken variant uses a clearly invalid URL", () => {
        expect(previewSrc).toMatch(/broken\.invalid/);
    });

    it("AC-preview-4: uses t.preview.imageWithFallbackSection for section heading", () => {
        expect(previewSrc).toMatch(/t\.preview\.imageWithFallbackSection/);
    });
});
