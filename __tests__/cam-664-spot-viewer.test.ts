/**
 * cam-664-spot-viewer.test.ts — CAM-664 (S2)
 *
 * Replaces the old `<ul>` of full-width per-spot cards (~200px/pitch, so a
 * 16-pitch camp was ~3,200px of page) with ONE fixed-height viewport + a
 * selectable strip, and adds a mobile sticky booking bar.
 *
 * Layer: source-inspection (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — same precedent as cam-353/cam-354's own component tests for
 * this exact page) PLUS pure-logic tests for the two DOM-free helpers
 * (`viewTypeLabel`, the roving-tabindex modular arithmetic mirrored from
 * the shipped `handleKeyDown`).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation (defensive fallback) — applied per unit below.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import translations from "../locales/translations.json";
import { getTranslations } from "../locales/translations";
import { viewTypeLabel } from "@/components/spot-viewer/types";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const spotStripSrc = src("components/spot-viewer/SpotStrip.tsx");
const spotViewportSrc = src("components/spot-viewer/SpotViewport.tsx");
const spotDetailLineSrc = src("components/spot-viewer/SpotDetailLine.tsx");
const spotViewerSrc = src("components/spot-viewer/SpotViewer.tsx");
const stickyActionBarSrc = src("components/ui/sticky-action-bar.tsx");
const detailClientSrc = src("components/CampgroundDetailClient.tsx");

// ---------------------------------------------------------------------------
// viewTypeLabel — pure logic (GENERAL/null both mean "no particular view";
// reuses spotManagement.viewType* keys, never a private duplicate — CAM-643).
// ---------------------------------------------------------------------------
describe("viewTypeLabel — GENERAL/null both read the same 'no particular view' label", () => {
  const th = getTranslations("th");
  const en = getTranslations("en");

  it("[null/empty] null and undefined both resolve to the GENERAL label", () => {
    expect(viewTypeLabel(th, null)).toBe(th.spotManagement.viewTypeGeneral);
    expect(viewTypeLabel(th, undefined)).toBe(th.spotManagement.viewTypeGeneral);
  });

  it('[normal] the literal enum member "GENERAL" resolves to the same label as null', () => {
    expect(viewTypeLabel(th, "GENERAL")).toBe(viewTypeLabel(th, null));
  });

  it("[normal] each of the 5 named views maps to its own spotManagement.viewType* key, both locales", () => {
    const cases: Array<[string, string]> = [
      ["RIVER", "viewTypeRiver"],
      ["MOUNTAIN", "viewTypeMountain"],
      ["LAKE", "viewTypeLake"],
      ["FOREST", "viewTypeForest"],
      ["BEACH", "viewTypeBeach"],
    ];
    for (const [viewType, key] of cases) {
      expect(viewTypeLabel(th, viewType)).toBe((th.spotManagement as Record<string, string>)[key]);
      expect(viewTypeLabel(en, viewType)).toBe((en.spotManagement as Record<string, string>)[key]);
    }
  });

  it("[error/validation defensive] an unknown viewType string never throws — falls back to the raw value", () => {
    expect(() => viewTypeLabel(th, "NOT_A_REAL_VIEW_TYPE")).not.toThrow();
    expect(viewTypeLabel(th, "NOT_A_REAL_VIEW_TYPE")).toBe("NOT_A_REAL_VIEW_TYPE");
  });
});

// ---------------------------------------------------------------------------
// SpotStrip — tab grammar + manual-activation roving tabindex (WAI-ARIA APG).
// ---------------------------------------------------------------------------
describe("SpotStrip — tab grammar (role=tablist/tab), not chip grammar", () => {
  it('[normal] the strip is a real tablist with an accessible name, horizontal orientation', () => {
    expect(spotStripSrc).toContain('role="tablist"');
    expect(spotStripSrc).toContain("aria-label={t.campground.spotStripLabel}");
    expect(spotStripSrc).toContain('aria-orientation="horizontal"');
  });

  it("[normal] each card is role=tab with aria-selected + aria-controls the shared panel", () => {
    expect(spotStripSrc).toContain('role="tab"');
    expect(spotStripSrc).toContain("aria-selected={selected}");
    expect(spotStripSrc).toContain("aria-controls={panelId}");
  });

  it("[normal] layout follows the CategoryBar precedent: overflow-x-auto no-scrollbar + shrink-0 cards, never a wrapping row", () => {
    expect(spotStripSrc).toContain("overflow-x-auto no-scrollbar");
    expect(spotStripSrc).toContain("shrink-0");
    expect(spotStripSrc).not.toContain("flex-wrap");
  });

  it("[a11y] selection is shown by a solid border-primary + tint, never by dimming the unselected siblings with opacity", () => {
    expect(spotStripSrc).toContain('selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground"');
    expect(spotStripSrc).not.toMatch(/opacity-(40|50|60|70)/);
  });
});

describe("SpotStrip — roving tabindex, manual activation (Enter/Space activates, arrows only move focus)", () => {
  // Mirrors the exact modular arithmetic shipped in handleKeyDown — asserted
  // behaviorally here, then cross-checked against the real source text below.
  const nextIndex = (index: number, length: number) => (index + 1) % length;
  const prevIndex = (index: number, length: number) => (index - 1 + length) % length;

  it("[normal] ArrowRight from the middle of 5 tabs moves to the next index", () => {
    expect(nextIndex(1, 5)).toBe(2);
  });

  it("[boundary] ArrowRight from the LAST tab wraps around to the first", () => {
    expect(nextIndex(4, 5)).toBe(0);
  });

  it("[normal] ArrowLeft from the middle moves to the previous index", () => {
    expect(prevIndex(2, 5)).toBe(1);
  });

  it("[boundary] ArrowLeft from the FIRST tab wraps around to the last", () => {
    expect(prevIndex(0, 5)).toBe(4);
  });

  it("[source-inspection] the shipped handleKeyDown uses this exact wrap-around arithmetic for ArrowRight/ArrowLeft", () => {
    expect(spotStripSrc).toContain("focusTabAt((index + 1) % spots.length);");
    expect(spotStripSrc).toContain("focusTabAt((index - 1 + spots.length) % spots.length);");
  });

  it("[normal] Home jumps to index 0, End jumps to the last index", () => {
    expect(spotStripSrc).toContain("focusTabAt(0);");
    expect(spotStripSrc).toContain("focusTabAt(spots.length - 1);");
    expect(spotStripSrc).toContain('case "Home":');
    expect(spotStripSrc).toContain('case "End":');
  });

  it('[normal] Enter and Space ACTIVATE the focused tab (call onSelect) — the only keys that select', () => {
    expect(spotStripSrc).toContain('case "Enter":');
    expect(spotStripSrc).toContain('case " ":');
    expect(spotStripSrc).toContain("onSelect(spots[index].id);");
  });

  it("[a11y] roving tabindex: only the FOCUSED tab is 0, every other tab is -1 (never all 0, never all -1)", () => {
    expect(spotStripSrc).toContain('tabIndex={focusedSpotId === spot.id ? 0 : -1}');
  });

  it("[regression] arrow-key focus movement never calls onSelect directly — manual activation, not selection-follows-focus", () => {
    const focusTabAtBody = spotStripSrc.slice(
      spotStripSrc.indexOf("const focusTabAt = (index: number) => {"),
      spotStripSrc.indexOf("const handleKeyDown")
    );
    expect(focusTabAtBody).not.toContain("onSelect(");
  });

  it("[normal] a real (click) selection change resyncs focusedSpotId via useEffect, so Tab-key entry lands on the selected tab", () => {
    expect(spotStripSrc).toContain("useEffect(() => {\n        setFocusedSpotId(selectedSpotId);\n    }, [selectedSpotId]);");
  });
});

describe("SpotStrip — card content (image, name, zone, price+unit, view icon+capacity, <=4 facility icons +N)", () => {
  it("[normal] price + its OWN unit is moved wholesale (byte-identical expression) from the old per-spot block", () => {
    expect(spotStripSrc).toContain("const isFree = Number(spot.pricePerNight) === 0;");
    expect(spotStripSrc).toContain("{isFree ? t.common.free : formatCurrency(Number(spot.pricePerNight))}");
    expect(spotStripSrc).toContain("priceUnitWord(t, spot.priceUnit)");
  });

  it("[boundary] the card shows at most 4 facility icons, with a +N badge for the rest", () => {
    expect(spotStripSrc).toContain("const MAX_CARD_FACILITY_ICONS = 4;");
    expect(spotStripSrc).toContain("facilityCodes.slice(0, MAX_CARD_FACILITY_ICONS)");
    expect(spotStripSrc).toContain("hiddenFacilityCount > 0");
    expect(spotStripSrc).toContain('spotMoreFacilitiesAriaLabel.replace("{N}", String(hiddenFacilityCount))');
  });

  it("[a11y] icon-only content (view type, each facility) is wrapped with role=img + aria-label, glyph aria-hidden", () => {
    expect(spotStripSrc).toContain('role="img" aria-label={viewTypeLabel(t, spot.viewType)}');
    expect(spotStripSrc).toContain('role="img" aria-label={t.filter[code as keyof typeof t.filter] || code}');
  });

  it("[normal] the strip card reuses the shared ImageWithFallback (empty/error states come free)", () => {
    expect(spotStripSrc).toContain("<ImageWithFallback");
    expect(spotStripSrc).toContain("src={displayImage?.url}");
  });
});

// ---------------------------------------------------------------------------
// SpotViewport — fixed aspect ratio (CLS=0), empty state, expand control.
// ---------------------------------------------------------------------------
describe("SpotViewport — fixed aspect ratio reserves height before any image (CLS=0)", () => {
  it("[normal] mobile 3/2, desktop 16/9 per DESIGN.md §2.0 (bare = mobile, md: = desktop)", () => {
    expect(spotViewportSrc).toContain("aspect-[3/2] md:aspect-[16/9]");
  });

  it("[a11y] the viewport is the shared tabpanel: role=tabpanel, aria-labelledby the active tab, focusable", () => {
    expect(spotViewportSrc).toContain('role="tabpanel"');
    expect(spotViewportSrc).toContain("aria-labelledby={activeTabId}");
    expect(spotViewportSrc).toContain("tabIndex={0}");
  });

  it("[null/empty] the DOMINANT case: no display image -> no expand control at all (not a disabled button)", () => {
    expect(spotViewportSrc).toContain("{displayImage && (");
    // The empty state itself is ImageWithFallback's own built-in slot (DESIGN.md
    // CAM-539) — no bespoke <ImageIcon /> usage duplicated in this file.
    expect(spotViewportSrc).not.toContain("<ImageIcon");
  });

  it("[normal] the expand control spans the whole box (a real button, not a disabled/dead affordance)", () => {
    expect(spotViewportSrc).toContain('type="button"');
    expect(spotViewportSrc).toContain("onClick={onExpand}");
    expect(spotViewportSrc).toContain('aria-label={expandAriaLabel}');
  });
});

// ---------------------------------------------------------------------------
// SpotDetailLine — the full fact sheet (words beside every icon, not truncated).
// ---------------------------------------------------------------------------
describe("SpotDetailLine — full-width fact sheet: every facility gets a word (no 4-icon cap)", () => {
  it("[regression] unlike the strip card, the detail line has no MAX_CARD_FACILITY_ICONS-style cap", () => {
    expect(spotDetailLineSrc).not.toContain("MAX_CARD_FACILITY_ICONS");
    expect(spotDetailLineSrc).not.toContain(".slice(0,");
  });

  it("[normal] every rendered fact pairs an icon with a translated word", () => {
    expect(spotDetailLineSrc).toContain("viewTypeLabel(t, spot.viewType)");
    expect(spotDetailLineSrc).toContain('t.campground.spotCapacityLabel.replace("{N}", String(spot.maxCampers))');
    expect(spotDetailLineSrc).toContain("t.filter[code as keyof typeof t.filter] || code");
  });

  it("[normal] Spot.environment renders as plain quoted words, never icon-mapped", () => {
    expect(spotDetailLineSrc).toContain("{spot.environment && (");
    expect(spotDetailLineSrc).toContain("spot.environment");
    // No facility/view icon lookup is keyed by the environment field itself.
    expect(spotDetailLineSrc).not.toMatch(/getFacilityIcon\(spot\.environment/);
  });
});

// ---------------------------------------------------------------------------
// SpotViewer — orchestrator: owns selectedSpotId, routes expand to the
// page's existing openPanorama/openSpotGallery (PanoramaViewer untouched).
// ---------------------------------------------------------------------------
describe("SpotViewer — selectedSpotId is UI state only; routes to the page's existing viewers", () => {
  it("[normal] selection starts on the first spot", () => {
    expect(spotViewerSrc).toContain('useState(spots[0]?.id ?? "");');
  });

  it("[null/empty boundary] an empty spots array never crashes — renders nothing", () => {
    expect(spotViewerSrc).toContain("if (!selectedSpot) return null;");
  });

  it("[normal] a PANORAMA display image routes to onOpenPanorama with url/alt/trigger element", () => {
    expect(spotViewerSrc).toContain('if (displayImage.kind === "PANORAMA") {');
    expect(spotViewerSrc).toContain("onOpenPanorama(displayImage.url, displayImage.alt || t.panorama.title, e.currentTarget);");
  });

  it("[normal] a PHOTO display image routes to onOpenGallery at the image's own index (not always 0)", () => {
    expect(spotViewerSrc).toContain("const index = Math.max(0, urls.indexOf(displayImage.url));");
    expect(spotViewerSrc).toContain("onOpenGallery(urls, index);");
  });

  it("[regression] never imports/renders PanoramaViewer directly — that stays CampgroundDetailClient's own dynamic-imported instance", () => {
    expect(spotViewerSrc).not.toContain("<PanoramaViewer");
    expect(spotViewerSrc).not.toMatch(/import .*PanoramaViewer/);
  });
});

// ---------------------------------------------------------------------------
// components/ui/sticky-action-bar.tsx — the reusable mobile bottom bar.
// ---------------------------------------------------------------------------
describe("StickyActionBar — mobile-only, safe-area aware, inline button loading (not a page-level spinner)", () => {
  it("[normal] hidden at md: and up, fixed to the bottom, above regular content but below the AI-chat launcher's z-50", () => {
    expect(stickyActionBarSrc).toContain("md:hidden fixed inset-x-0 bottom-0 z-40");
  });

  it("[normal] safe-area bottom padding matches the pre-existing SearchModal/AiChatPanel idiom", () => {
    expect(stickyActionBarSrc).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
  });

  it("[normal] the action uses the same inline Loader2 idiom as the desktop Reserve button, not the page-level LoadingSpinner", () => {
    expect(stickyActionBarSrc).toContain('import { Loader2 } from "lucide-react";');
    expect(stickyActionBarSrc).not.toMatch(/import .*LoadingSpinner/);
    expect(stickyActionBarSrc).toContain('<Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />');
  });

  it("[normal] disabled covers both the caller's own disabled prop AND the loading state (never clickable while loading)", () => {
    expect(stickyActionBarSrc).toContain("disabled={disabled || loading}");
    expect(stickyActionBarSrc).toContain("aria-busy={loading}");
  });

  it("[normal] reuses the shared Button primitive (size lg) — no hand-rolled control", () => {
    expect(stickyActionBarSrc).toContain('import { Button } from "@/components/ui/button";');
    expect(stickyActionBarSrc).toContain('size="lg"');
  });
});

// ---------------------------------------------------------------------------
// components/CampgroundDetailClient.tsx — wiring (source-inspection, same
// precedent as cam-353/cam-354's own assertions against this exact file).
// ---------------------------------------------------------------------------
describe("CampgroundDetailClient.tsx — wires SpotViewer + StickyActionBar (CAM-664)", () => {
  it('[normal] imports SpotViewer + StickyActionBar from their new homes', () => {
    expect(detailClientSrc).toContain('import { SpotViewer } from "@/components/spot-viewer/SpotViewer";');
    expect(detailClientSrc).toContain('import { StickyActionBar } from "@/components/ui/sticky-action-bar";');
  });

  it("[normal] SpotViewer receives the unchanged spots array + the page's own openSpotGallery/openPanorama", () => {
    expect(detailClientSrc).toContain("<SpotViewer");
    expect(detailClientSrc).toContain("spots={spots}");
    expect(detailClientSrc).toContain("onOpenGallery={openSpotGallery}");
    expect(detailClientSrc).toContain("onOpenPanorama={openPanorama}");
  });

  it("[normal] StickyActionBar reuses the SAME handleReserve/isReserving/isFullyBooked the desktop Reserve button uses — CAM-666 scope boundary respected (no new booking logic)", () => {
    expect(detailClientSrc).toContain("<StickyActionBar");
    expect(detailClientSrc).toContain("onAction={handleReserve}");
    expect(detailClientSrc).toContain("disabled={isFullyBooked}");
    expect(detailClientSrc).toContain("loading={isReserving}");
    expect(detailClientSrc).toContain("actionLabel={t.common.reserve}");
  });

  it("[normal] the page container reserves bottom clearance on mobile so the fixed bar never covers the last content", () => {
    expect(detailClientSrc).toContain('className="container mx-auto px-6 pt-6 pb-24 md:pb-0"');
  });

  it("[regression] the old per-spot Badge/MoveHorizontal imports are gone from this file — they moved with the markup to SpotViewport.tsx", () => {
    expect(detailClientSrc).not.toContain('import { Badge } from "@/components/ui/badge";');
    expect(detailClientSrc).not.toMatch(/MoveHorizontal/);
  });

  it("[regression] the old <ul data-testid=\"list--campground-spots\"> is gone — one SpotViewer replaces it", () => {
    expect(detailClientSrc).not.toContain('data-testid="list--campground-spots"');
  });
});

// ---------------------------------------------------------------------------
// i18n — locales/translations.json (both en + th), new CAM-664 keys.
// ---------------------------------------------------------------------------
describe("i18n: campground.spotStripLabel / spotMoreFacilitiesAriaLabel (CAM-664)", () => {
  it("[normal] both new keys exist with non-empty strings in en + th", () => {
    for (const lang of ["en", "th"] as const) {
      expect(typeof translations[lang].campground.spotStripLabel).toBe("string");
      expect(translations[lang].campground.spotStripLabel.length).toBeGreaterThan(0);
      expect(typeof translations[lang].campground.spotMoreFacilitiesAriaLabel).toBe("string");
      expect(translations[lang].campground.spotMoreFacilitiesAriaLabel.length).toBeGreaterThan(0);
    }
  });

  it("[normal] the {N} placeholder survives verbatim in both locales", () => {
    expect(translations.en.campground.spotMoreFacilitiesAriaLabel).toContain("{N}");
    expect(translations.th.campground.spotMoreFacilitiesAriaLabel).toContain("{N}");
  });

  it("[i18n rule] no em-dash (—) in the new Thai copy", () => {
    expect(translations.th.campground.spotStripLabel).not.toContain("—");
    expect(translations.th.campground.spotMoreFacilitiesAriaLabel).not.toContain("—");
  });

  it("[AC] th.spotStripLabel is verbatim the intended Thai copy", () => {
    expect(translations.th.campground.spotStripLabel).toBe("เลือกจุดกางเต็นท์");
  });
});
