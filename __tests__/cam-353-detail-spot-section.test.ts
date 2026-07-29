/**
 * cam-353-detail-spot-section.test.ts — CAM-353
 *
 * Camper-facing spot section on the camp detail page: per-spot name/zone/
 * capacity/price + per-spot photo gallery (panorama badge), gated to
 * PER-SPOT-mode camps with >=1 live spot.
 *
 * AC coverage matrix (ticket CAM-353, every row -> at least one test):
 *   AC-1  PER-SPOT camp with >=1 live spot -> spot section renders, headed
 *         `จุดกางเต็นท์ในแคมป์นี้`, server-rendered from the existing payload.
 *   AC-2  A spot's name/zone/`รองรับได้ {N} คน`/price render from its own fields.
 *   AC-3  A spot's photos render lazily, ordered; tapping opens the shared viewer.
 *   AC-4  A PANORAMA-kind photo shows the `พาโนรามา` badge; still a regular image.
 *   AC-5  WHOLE-CAMP camp OR 0 live spots -> the section is entirely absent.
 *   AC-6  A spot with no photos -> row renders (name/zone/capacity/price), no gallery.
 *
 * Layers:
 *   - lib/catalog-cache.ts (BR-2) -> source-inspection (unstable_cache wrappers
 *     throw outside a request/build context — same precedent as
 *     cam-195-cache-catalog.test.ts, which tests this exact file the same way).
 *   - components/CampgroundDetailClient.tsx -> source-inspection (no isolated
 *     test harness; >10 mocked module boundaries to mount — same precedent as
 *     cam-268-price-fee-cancellation-policy.test.ts / f3-detail-surface.test.ts
 *     for this exact file).
 *   - BR-1 gate truth table -> pure-logic executed test (independent of the
 *     source text) PLUS a source-inspection assertion that the shipped
 *     conditional matches the same boolean expression.
 *   - app/api/campsites/[id]/spots/route.ts + [spotId]/route.ts (BR-8) ->
 *     source-inspection for the revalidateTag wiring.
 *   - locales/translations.json -> i18n presence + Thai-copy-verbatim + no-em-dash.
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary · error/validation (where applicable per layer)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import translations from '../locales/translations.json';
import { campCardSelect } from '@/lib/read-models/camp-card';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// BR-2 — lib/catalog-cache.ts include shape (source-inspection; unstable_cache
// wrappers cannot be invoked outside a request/build context).
// ---------------------------------------------------------------------------
describe('lib/catalog-cache.ts — getCampBySlug spots include (BR-2, CAM-353)', () => {
  const catalogCacheSrc = src('lib/catalog-cache.ts');

  // Isolate the getCampBySlug wrapper body from the rest of the file so
  // assertions can't accidentally match getDefaultCatalog or unrelated code.
  // CAM-357: getCampBySlug changed from `export const getCampBySlug = unstable_cache(...)`
  // to `export async function getCampBySlug(slug) { ... }` (the unstable_cache wrapper is
  // now built INSIDE the function so its `tags` can carry the real per-slug cache tag) —
  // update the start marker to match; the assertions below are unchanged (still true of
  // the new body).
  const getCampBySlugBody = catalogCacheSrc.slice(
    catalogCacheSrc.indexOf('export async function getCampBySlug'),
    catalogCacheSrc.indexOf('export const getDefaultCatalog')
  );

  it('[AC-1/AC-3] spots include is no longer the bare `spots: true` (must carry images)', () => {
    // Trailing comma anchors to the real object-literal property (the removed
    // code), not the doc-comment prose that quotes "spots: true" in backticks.
    expect(getCampBySlugBody).not.toMatch(/spots:\s*true,/);
  });

  it('[AC-3, EC-1] spots include carries a full `include: { images }` (not an enumerating select) so Image.kind rides through', () => {
    // Isolate the spots: {...} sub-block specifically (not the top-level images: {...} sibling).
    const spotsBlockMatch = getCampBySlugBody.match(/spots:\s*\{[\s\S]*?\n\s{8}\},/);
    expect(spotsBlockMatch).not.toBeNull();
    const spotsBlock = spotsBlockMatch![0];
    expect(spotsBlock).toMatch(/include:\s*\{\s*images:/);
    // Reject an enumerating select on images (the CAM-342 field-does-not-ride-through trap).
    expect(spotsBlock).not.toMatch(/images:\s*\{\s*select:/);
  });

  it('[AC-3] spot images are ordered by sortOrder asc', () => {
    const spotsBlockMatch = getCampBySlugBody.match(/spots:\s*\{[\s\S]*?\n\s{8}\},/);
    expect(spotsBlockMatch![0]).toMatch(/orderBy:\s*\{\s*sortOrder:\s*'asc'\s*\}/);
  });

  it('[EC-3] spots include excludes soft-deleted rows (where: { deletedAt: null })', () => {
    const spotsBlockMatch = getCampBySlugBody.match(/spots:\s*\{[\s\S]*?\n\s{8}\},/);
    expect(spotsBlockMatch![0]).toMatch(/where:\s*\{\s*deletedAt:\s*null\s*\}/);
  });

  it('[no N+1] getCampBySlug still issues exactly one Prisma call (richer include, not an extra round-trip)', () => {
    const prismaCallCount = (getCampBySlugBody.match(/prisma\.\w+\.\w+\(/g) || []).length;
    expect(prismaCallCount).toBe(1);
    expect(getCampBySlugBody).toContain('prisma.campSite.findFirst');
  });

  it('[regression] canViewCampSite is still not called inside the cache boundary', () => {
    expect(getCampBySlugBody).not.toContain('canViewCampSite');
  });
});

describe('lib/read-models/camp-card.ts — campCardSelect stays untouched (Seams & refs, CAM-353)', () => {
  it('[regression] catalog card select does NOT fetch spots (no over-fetch on the card grid)', () => {
    expect(Object.keys(campCardSelect)).not.toContain('spots');
  });
});

// ---------------------------------------------------------------------------
// BR-1 gate truth table — pure logic + source-inspection cross-check.
// ---------------------------------------------------------------------------
describe('BR-1 render gate — useSpotView AND >=1 live spot (AC-1, AC-5, EC-2, EC-7)', () => {
  // Mirrors the exact boolean algebra shipped in CampgroundDetailClient.tsx;
  // asserted against the real source text in the test below this one.
  const showSpotSection = (useSpotView: unknown, spotCount: number) =>
    !!useSpotView && spotCount > 0;

  it('[AC-1 normal] PER-SPOT camp with 3 live spots -> renders', () => {
    expect(showSpotSection(true, 3)).toBe(true);
  });

  it('[AC-5/EC-7 normal] WHOLE-CAMP camp that still has live spots (mode-switch, CAM-351) -> absent', () => {
    expect(showSpotSection(false, 3)).toBe(false);
  });

  it('[AC-5/EC-2 boundary] PER-SPOT camp with 0 live spots -> absent', () => {
    expect(showSpotSection(true, 0)).toBe(false);
  });

  it('[boundary] WHOLE-CAMP camp with 0 spots -> absent', () => {
    expect(showSpotSection(false, 0)).toBe(false);
  });

  it('[null/empty] useSpotView undefined/null -> absent regardless of spot count', () => {
    expect(showSpotSection(undefined, 5)).toBe(false);
    expect(showSpotSection(null, 5)).toBe(false);
  });

  it('[source-inspection] the shipped gate matches this exact boolean expression', () => {
    const detailSrc = src('components/CampgroundDetailClient.tsx');
    expect(detailSrc).toContain('const showSpotSection = !!campground.useSpotView && spots.length > 0;');
  });
});

// ---------------------------------------------------------------------------
// components/CampgroundDetailClient.tsx — source-inspection
// (mirrors f2/f3-*-surface.test.ts + cam-268's precedent for this exact file)
//
// CAM-664 (S2) restructured the spot section's DOM: the `<ul>` of
// full-width per-spot cards is gone, replaced by one fixed-height viewport
// + a selectable strip (components/spot-viewer/*). These assertions were
// updated to the NEW canonical structure (still asserting the same ACs)
// per the CAM-224/226/229 precedent: a legitimate refactor that moves
// pinned markup means the source-inspection test is updated to the new
// shape, not left red (.claude/rules/qa.md).
// ---------------------------------------------------------------------------
describe('CampgroundDetailClient.tsx — spot section source-inspection (CAM-353, updated CAM-664)', () => {
  const detailSrc = src('components/CampgroundDetailClient.tsx');
  const spotStripSrc = src('components/spot-viewer/SpotStrip.tsx');
  const spotDetailLineSrc = src('components/spot-viewer/SpotDetailLine.tsx');
  const spotViewportSrc = src('components/spot-viewer/SpotViewport.tsx');
  const spotViewerSrc = src('components/spot-viewer/SpotViewer.tsx');
  const spotDisplayImageSrc = src('lib/spot-display-image.ts');

  it('[AC-1] renders the section heading key + a testid on the section', () => {
    expect(detailSrc).toContain('{t.campground.spotsHeading}');
    expect(detailSrc).toContain('data-testid="section--campground-spots"');
  });

  it('[AC-5, EC-2] no empty-scaffold branch — the section is gated by one guard, nothing else renders when absent', () => {
    expect(detailSrc).toContain('{showSpotSection && (');
    // No sibling "no spots yet" fallback branch for the camper-facing section.
    expect(detailSrc).not.toMatch(/showSpotSection\s*\?\s*[\s\S]{0,40}:\s*</);
  });

  it('[AC-2] the strip card reads name, zone, and price from the spot itself', () => {
    expect(spotStripSrc).toContain('{spot.name}');
    expect(spotStripSrc).toContain('{spot.zone}');
    expect(spotStripSrc).toMatch(/formatCurrency\(Number\(spot\.pricePerNight\)\)/);
  });

  it('[AC-2, EC-4] capacity renders only when maxCampers is a number >= 1 (strip + detail line)', () => {
    expect(spotStripSrc).toContain('const hasCapacity = typeof spot.maxCampers === "number" && spot.maxCampers >= 1;');
    expect(spotStripSrc).toContain('{hasCapacity && (');
    expect(spotDetailLineSrc).toContain('t.campground.spotCapacityLabel.replace("{N}", String(spot.maxCampers))');
  });

  it('[EC-6] pricePerNight === 0 shows the free copy, not formatCurrency(0)', () => {
    expect(spotStripSrc).toContain('const isFree = Number(spot.pricePerNight) === 0;');
    expect(spotStripSrc).toContain('{isFree ? t.common.free : formatCurrency(Number(spot.pricePerNight))}');
  });

  it('[AC-4, EC-5] a PANORAMA-kind display image shows the reused panorama badge; PHOTO shows none', () => {
    expect(spotViewportSrc).toContain('displayImage?.kind === "PANORAMA"');
    expect(spotViewportSrc).toContain('{t.spotManagement.panoramaBadge}');
    // Reuses the existing Badge primitive, not a hand-rolled pill.
    expect(spotViewportSrc).toMatch(/<Badge\s*\n?\s*variant="overlay"/);
  });

  it('[AC-6, EC-1] a photo-less spot renders no expand control — ImageWithFallback carries the empty state instead', () => {
    // No display image -> the whole `<button>` (the expand control) is
    // omitted, not a disabled control (DESIGN.md "Empty image slot").
    expect(spotViewportSrc).toContain('{displayImage && (');
    expect(spotViewportSrc).toContain('<ImageWithFallback');
  });

  it('[BR-6/CLS] the viewport reserves its aspect ratio in CSS (no width/height race) and is never priority', () => {
    // CAM-664: a fixed-aspect box (not per-photo width/height props) is what
    // makes switching pitches CLS=0 — the box exists before any image loads.
    expect(spotViewportSrc).toContain('aspect-[3/2] md:aspect-[16/9]');
    expect(spotViewportSrc).not.toContain('priority');
  });

  it('[AC-3] the display image is picked without ever re-sorting the images array (no re-sort/shuffle)', () => {
    // pickSpotDisplayImage only .find()s/indexes the array Prisma already
    // returned in sortOrder order (BR-2 above) — it never re-sorts it.
    expect(spotDisplayImageSrc).not.toContain('.sort(');
  });

  it('[AC-3] reuses the existing shared photo viewer (ImageGallery) — no new viewer component', () => {
    // CampgroundDetailClient still defines + owns openSpotGallery/openPanorama
    // unchanged, now handed to SpotViewer as props instead of called inline.
    expect(detailSrc).toContain('const openSpotGallery = (spotImages: string[], index: number = 0) => {');
    expect(detailSrc).toContain('onOpenGallery={openSpotGallery}');
    expect(detailSrc).toContain('onOpenPanorama={openPanorama}');
    expect(spotViewerSrc).toContain('onOpenGallery(urls, index)');
    // Only one <ImageGallery ...> mount in the whole file (shared instance).
    const galleryMounts = (detailSrc.match(/<ImageGallery/g) || []).length;
    expect(galleryMounts).toBe(1);
  });

  it('[regression] the hero image keeps its own priority prop untouched', () => {
    expect(detailSrc).toContain('priority');
    expect(detailSrc).toMatch(/src=\{images\[0\]\}[\s\S]{0,300}priority/);
  });
});

describe('components/ImageGallery.tsx — untouched props (Seams & refs: reuse only, CAM-353)', () => {
  it('[regression] ImageGalleryProps interface is unchanged (images/isOpen/onClose/initialIndex only)', () => {
    const galleryPropsSrc = src('components/ImageGallery.tsx');
    expect(galleryPropsSrc).toMatch(
      /interface ImageGalleryProps \{\s*images: string\[\];\s*isOpen: boolean;\s*onClose: \(\) => void;\s*initialIndex\?: number;\s*\}/
    );
  });
});

// ---------------------------------------------------------------------------
// i18n — locales/translations.json (both en + th)
// ---------------------------------------------------------------------------
describe('i18n: campground.spotsHeading / spotCapacityLabel (CAM-353)', () => {
  it('[AC-1] th.spotsHeading is verbatim the AC-quoted Thai copy', () => {
    expect(translations.th.campground.spotsHeading).toBe('จุดกางเต็นท์ในแคมป์นี้');
  });

  it('[AC-2, BR-3] th.spotCapacityLabel is verbatim identical to spotManagement.capacityLabel (CAM-352)', () => {
    expect(translations.th.campground.spotCapacityLabel).toBe('รองรับได้ {N} คน');
    expect(translations.th.campground.spotCapacityLabel).toBe(translations.th.spotManagement.capacityLabel);
  });

  it('[normal] both keys exist with non-empty strings in en + th', () => {
    for (const lang of ['en', 'th'] as const) {
      expect(typeof translations[lang].campground.spotsHeading).toBe('string');
      expect(translations[lang].campground.spotsHeading.length).toBeGreaterThan(0);
      expect(typeof translations[lang].campground.spotCapacityLabel).toBe('string');
      expect(translations[lang].campground.spotCapacityLabel.length).toBeGreaterThan(0);
    }
  });

  it('[AC-4, BR-5] spotManagement.panoramaBadge is reused verbatim, not duplicated under campground.*', () => {
    expect(translations.th.spotManagement.panoramaBadge).toBe('พาโนรามา');
    // BR-5 says reuse the existing key directly — assert no parallel campground.panoramaBadge exists.
    expect((translations.th.campground as Record<string, unknown>).panoramaBadge).toBeUndefined();
  });

  it('[i18n rule] no em-dash (—) in the new Thai copy', () => {
    expect(translations.th.campground.spotsHeading).not.toContain('—');
    expect(translations.th.campground.spotCapacityLabel).not.toContain('—');
  });
});

// ---------------------------------------------------------------------------
// BR-8 — revalidateTag wiring on the CAM-352 spot write handlers.
// ---------------------------------------------------------------------------
describe('spot write handlers bust the cached camp-detail read (BR-8, CAM-353)', () => {
  const postRouteSrc = src('app/api/campsites/[id]/spots/route.ts');
  const spotIdRouteSrc = src('app/api/campsites/[id]/spots/[spotId]/route.ts');

  it('[POST] app/api/campsites/[id]/spots/route.ts revalidates by camp id and both slugs', () => {
    expect(postRouteSrc).toContain("import { revalidateTag } from 'next/cache';");
    expect(postRouteSrc).toContain("import { campTag, campSlugTag } from '@/lib/catalog-cache';");
    expect(postRouteSrc).toContain('revalidateTag(campTag(id), {});');
    expect(postRouteSrc).toContain('revalidateTag(campSlugTag(campSite.nameThSlug), {});');
    expect(postRouteSrc).toContain('revalidateTag(campSlugTag(campSite.nameEnSlug), {});');
  });

  it('[PUT] [spotId]/route.ts revalidates by camp id and both slugs on spot edit', () => {
    const putBody = spotIdRouteSrc.slice(
      spotIdRouteSrc.indexOf('export async function PUT'),
      spotIdRouteSrc.indexOf('export async function DELETE')
    );
    expect(putBody).toContain('revalidateTag(campTag(id), {});');
    expect(putBody).toContain('revalidateTag(campSlugTag(campSite.nameThSlug), {});');
    expect(putBody).toContain('revalidateTag(campSlugTag(campSite.nameEnSlug), {});');
  });

  it('[DELETE] [spotId]/route.ts revalidates by camp id and both slugs on spot delete', () => {
    const deleteBody = spotIdRouteSrc.slice(spotIdRouteSrc.indexOf('export async function DELETE'));
    expect(deleteBody).toContain('revalidateTag(campTag(id), {});');
    expect(deleteBody).toContain('revalidateTag(campSlugTag(campSite.nameThSlug), {});');
    expect(deleteBody).toContain('revalidateTag(campSlugTag(campSite.nameEnSlug), {});');
  });

  it('[precedent] the revalidateTag(tag, {}) call signature matches the established write-path convention', () => {
    // Same shape already used by app/api/campsites/[id]/route.ts (PUT/DELETE).
    const campsiteIdRouteSrc = src('app/api/campsites/[id]/route.ts');
    expect(campsiteIdRouteSrc).toContain('revalidateTag(campTag(id), {});');
  });
});
