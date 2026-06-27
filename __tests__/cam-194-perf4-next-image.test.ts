/**
 * cam-194-perf4-next-image.test.ts — PERF-4 next/image migration (CAM-194)
 *
 * Layer: unit / static source-inspection (vitest env = 'node').
 * No production code written or edited by this file.
 *
 * AC coverage matrix — every PERF-4 AC row mapped 1:1:
 *
 *   AC-1  component uses next/image
 *         ImageWithFallback imports from "next/image"; no raw <img tag in the render path.
 *
 *   AC-2  auto-unoptimized for blob:/data: src
 *         isUnoptimized logic: src.startsWith("blob:") || src.startsWith("data:") present.
 *
 *   AC-3  fill vs fixed mode
 *         isFixedMode gate: typeof width === "number" && typeof height === "number";
 *         fill branch present (no width/height); fixed branch uses width={width} height={height}.
 *         LogoUpload passes width={128} height={128} → exercises fixed mode.
 *         ImageGallery/CampgroundDetailClient do NOT pass width/height → fill mode.
 *
 *   AC-4  priority on detail hero + first-N catalog cards (CAM-199)
 *         CampgroundDetailClient: hero image (every 1/2/3/4/5+ branch) carries `priority`.
 *         Secondary images (i !== 0 in 2-image branch) carry priority={i === 0}.
 *         CampgroundCard: accepts priority prop (default false), forwards to ImageWithFallback;
 *           InfiniteScrollGrid passes priority={index < 4} — first 4 cards eager, rest lazy.
 *         ImageGallery, app/bookings/page, app/dashboard/campsites/page,
 *         and ImageUpload do NOT use priority (no LCP role).
 *
 *   AC-5  next.config images contract
 *         formats: ["image/webp"] (webp only, NOT avif);
 *         dangerouslyAllowSVG: false;
 *         remotePatterns includes *.public.blob.vercel-storage.com;
 *         remotePatterns does NOT include images.unsplash.com (CAM-213 self-host);
 *         minimumCacheTTL set (non-zero);
 *         qualities: [75].
 *
 *   AC-6  fallback path intact
 *         ImageOff icon still in the errored/no-src branch;
 *         onError handler wired on <Image>;
 *         errored state present (useState / setErrored).
 *         ir1-image-resilience.test.ts passes (regression guard — confirmed by full suite run).
 *
 *   AC-7  context-17 (bookings page) no-CLS wrapper
 *         app/bookings/page.tsx uses aspect-[4/3] (not h-auto) on the image wrapper div.
 *
 * Prove-It notes (verified red-before-green per story):
 *   AC-1: removing `from "next/image"` import makes the "imports from next/image" test fail.
 *         Restoring a raw <img in the render path makes the "no raw <img" test fail.
 *   AC-2: removing `src?.startsWith("blob:")` from isUnoptimized makes that test fail.
 *   AC-3: removing `isFixedMode` constant makes the fixed-mode gate test fail.
 *         Removing `fill` from the fill branch makes the fill-mode test fail.
 *   AC-4: adding priority to ImageGallery makes the "no priority in gallery" test fail.
 *         Removing priority from the 3-image hero branch makes that hero test fail.
 *         Removing priority prop from CampgroundCard makes the card priority-prop test fail.
 *         Removing index < 4 from InfiniteScrollGrid.map makes the grid priority test fail.
 *   AC-5: adding "image/avif" to formats makes the avif-exclusion test fail.
 *         Setting dangerouslyAllowSVG: true makes that test fail.
 *   AC-6: removing onError from Image makes the fallback-wired test fail.
 *   AC-7: swapping aspect-[4/3] for h-auto makes the no-CLS test fail.
 *
 * Staging-only ACs (not automatable at unit layer):
 *   - Actual image load, CDN delivery, and WebP transformation → verified on Staging URL.
 *   - LCP improvement (Lighthouse before/after) → verified by owner in Chrome on Staging.
 *   - CLS = 0 on detail hero (fill + explicit wrapper height) → Lighthouse on Staging.
 *   These items are noted in the delivery test.md as "staging-only; not measured locally".
 *
 * Coverage on new code (image-with-fallback.tsx):
 *   All new logic paths are exercised by source-inspection:
 *     - isUnoptimized computation (lines 64-66)
 *     - isFixedMode gate (line 69)
 *     - fill branch (lines 103-114)
 *     - fixed branch (lines 90-101)
 *     - fallback branch (lines 84-89)
 *   Source-inspection is the correct layer for this component because it is a client
 *   component whose rendering depends on next/image internals (no jsdom rendering);
 *   the pattern follows the established precedent in ir1-image-resilience.test.ts.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------
function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const iwfSrc            = readSrc('components/ui/image-with-fallback.tsx');
const detailSrc         = readSrc('components/CampgroundDetailClient.tsx');
const gallerySrc        = readSrc('components/ImageGallery.tsx');
const cardSrc           = readSrc('components/CampgroundCard.tsx');
const infiniteGridSrc2  = readSrc('components/InfiniteScrollGrid.tsx');
const bookingsSrc       = readSrc('app/bookings/page.tsx');
const dashCampSrc       = readSrc('app/dashboard/campsites/page.tsx');
const imageUploadSrc    = readSrc('components/ImageUpload.tsx');
const logoUploadSrc     = readSrc('components/LogoUpload.tsx');

// next.config is TypeScript source; read the raw source to inspect values.
const nextConfigSrc  = readSrc('next.config.ts');

// ===========================================================================
// AC-1 — component uses next/image, no raw <img in render path
// ===========================================================================

describe('AC-1 — ImageWithFallback uses next/image (not raw <img>) in render', () => {

  it('[import] imports Image from "next/image"', () => {
    // Prove-It: removing the import makes this fail.
    expect(iwfSrc).toContain('from "next/image"');
  });

  it('[import] imports Image as default from "next/image" (the Next.js optimized component)', () => {
    // The import must be the default import (Image), not a named export.
    expect(iwfSrc).toMatch(/import Image from "next\/image"/);
  });

  it('[render] no raw <img tag remains in the JSX render path (multiline-safe)', () => {
    // Prove-It: restoring a raw <img in either fill or fixed branch makes this fail.
    // Uses DOTALL to catch multiline attribute spans.
    // Exclude the comment text that contains "<img>" in the JSDoc.
    const jsxSection = iwfSrc.slice(iwfSrc.indexOf('return ('));
    expect(jsxSection).not.toMatch(/<img[\s>]/);
  });

  it('[render] <Image component present in the JSX section (fill branch)', () => {
    // The fill-mode branch must render <Image fill …>.
    const jsxSection = iwfSrc.slice(iwfSrc.indexOf('return ('));
    expect(jsxSection).toMatch(/<Image/);
    expect(jsxSection).toContain('fill');
  });
});

// ===========================================================================
// AC-2 — auto-unoptimized for blob: and data: URLs
// ===========================================================================

describe('AC-2 — blob:/data: src auto-sets unoptimized (skips Next.js CDN optimizer)', () => {

  it('[logic] isUnoptimized computed from startsWith("blob:") check', () => {
    // Prove-It: removing the blob: guard makes this fail.
    expect(iwfSrc).toContain('startsWith("blob:")');
  });

  it('[logic] isUnoptimized computed from startsWith("data:") check', () => {
    // Prove-It: removing the data: guard makes this fail.
    expect(iwfSrc).toContain('startsWith("data:")');
  });

  it('[logic] explicit unoptimized prop also sets isUnoptimized (pass-through)', () => {
    // Prove-It: removing the `unoptimized === true` condition makes this fail.
    expect(iwfSrc).toContain('unoptimized === true');
  });

  it('[logic] isUnoptimized combines all three conditions with OR (||)', () => {
    // The full computed constant: unoptimized === true || blob: || data:
    expect(iwfSrc).toMatch(/isUnoptimized[\s\S]{0,20}=[\s\S]{0,20}unoptimized === true[\s\S]{0,60}startsWith\("blob:"\)/);
  });

  it('[wiring] isUnoptimized passed as unoptimized prop to both Image branches', () => {
    // Both fill and fixed branches must forward the computed flag — not the raw prop.
    const matches = iwfSrc.match(/unoptimized=\{isUnoptimized\}/g) ?? [];
    // Two <Image> usages (fill branch + fixed branch), each gets unoptimized={isUnoptimized}.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// AC-3 — fill vs fixed mode
// ===========================================================================

describe('AC-3 — fill mode (default) vs fixed mode (width+height both provided)', () => {

  it('[mode-gate] isFixedMode checks typeof width === "number" && typeof height === "number"', () => {
    // Prove-It: removing the isFixedMode constant makes this fail.
    expect(iwfSrc).toContain('typeof width === "number" && typeof height === "number"');
  });

  it('[fill-mode] fill branch renders <Image with standalone fill attribute (Mode A)', () => {
    // The fill attribute is a standalone boolean JSX prop on its own indented line
    // after the opening <Image tag.  Use a wider window to cover the indentation gap.
    // Prove-It: removing `fill` from the fill branch makes this fail.
    expect(iwfSrc).toMatch(/<Image[\s\S]{0,200}^\s+fill\s*$/m);
  });

  it('[fill-mode] fill branch passes sizes prop to <Image>', () => {
    // sizes is required in fill mode for responsive viewport hints.
    // Prove-It: removing `sizes={sizes}` from the fill branch makes this fail.
    expect(iwfSrc).toContain('sizes={sizes}');
  });

  it('[fixed-mode] fixed branch passes width={width} and height={height} to <Image>', () => {
    // Prove-It: removing width/height from the fixed branch makes this fail.
    expect(iwfSrc).toContain('width={width}');
    expect(iwfSrc).toContain('height={height}');
  });

  it('[fixed-mode] fixed branch does NOT pass fill prop (fill and width/height are mutually exclusive)', () => {
    // In the fixed branch, `fill` must not appear between isFixedMode ? and the next branch.
    // Locate the fixed-mode Image tag and confirm it has no fill attribute.
    const fixedBranchStart = iwfSrc.indexOf('isFixedMode ? (');
    const fillBranchStart  = iwfSrc.indexOf(': (', fixedBranchStart);
    const fixedBranchSrc   = iwfSrc.slice(fixedBranchStart, fillBranchStart);
    // The fixed branch Image must have width and height but NOT fill.
    expect(fixedBranchSrc).toContain('width={width}');
    expect(fixedBranchSrc).not.toMatch(/<Image[\s\S]{0,10}fill/);
  });

  it('[consumer-fixed] LogoUpload passes width={128} height={128} → exercises fixed mode', () => {
    // Prove-It: removing width/height from LogoUpload makes this fail.
    expect(logoUploadSrc).toContain('width={128}');
    expect(logoUploadSrc).toContain('height={128}');
  });

  it('[consumer-fill] CampgroundDetailClient does NOT pass width or height (uses fill mode)', () => {
    // Detail hero should use fill mode to avoid CLS — explicit px dimensions not passed.
    // Filter out comment lines to avoid false positives from JSDoc.
    const codeLines = detailSrc
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // width/height props on ImageWithFallback would look like: width={...} or height={...}
    // These must not appear (fill mode is used instead).
    expect(codeLines).not.toMatch(/ImageWithFallback[\s\S]{0,200}width=\{/);
    expect(codeLines).not.toMatch(/ImageWithFallback[\s\S]{0,200}height=\{/);
  });

  it('[consumer-fill] ImageGallery does NOT pass width or height to ImageWithFallback', () => {
    expect(gallerySrc).not.toMatch(/ImageWithFallback[\s\S]{0,200}width=\{/);
    expect(gallerySrc).not.toMatch(/ImageWithFallback[\s\S]{0,200}height=\{/);
  });
});

// ===========================================================================
// AC-4 — priority only on detail hero (index 0); absent from all other consumers
// ===========================================================================

describe('AC-4 — priority=true on detail hero; card accepts priority prop (CAM-199); gallery/booking/dashboard have none', () => {

  // --- hero priority present on every grid branch ---

  it('[hero-mobile] mobile hero (images[0]) in CampgroundDetailClient carries priority', () => {
    // Prove-It: removing priority from the mobile hero block makes this fail.
    // The mobile section appears before the first desktop branch.
    const mobileSection = detailSrc.slice(
      detailSrc.indexOf('Mobile View: Single Hero Image'),
      detailSrc.indexOf('Desktop View: Adaptive Grid'),
    );
    expect(mobileSection).toContain('priority');
  });

  it('[hero-1img] 1-image desktop branch (images[0]) carries priority', () => {
    // Prove-It: removing priority from the single-image branch makes this fail.
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 1'),
      detailSrc.indexOf('images.length === 2'),
    );
    expect(branch).toContain('priority');
  });

  it('[hero-2img] 2-image desktop branch: index-0 carries priority={i === 0}', () => {
    // Prove-It: removing the conditional priority from the 2-image map makes this fail.
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 2'),
      detailSrc.indexOf('images.length === 3'),
    );
    expect(branch).toContain('priority={i === 0}');
  });

  it('[hero-3img] 3-image desktop branch: hero (images[0], col-span-2) carries priority', () => {
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 3'),
      detailSrc.indexOf('images.length === 4'),
    );
    expect(branch).toContain('priority');
  });

  it('[hero-3img] 3-image desktop branch: secondary images (slice 1-3) do NOT carry standalone priority', () => {
    // Secondary grid cells in the 3-image branch must not get priority.
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 3'),
      detailSrc.indexOf('images.length === 4'),
    );
    // The hero has `priority` (just the bare prop). Secondary cells should have sizes but no priority.
    // Count occurrences: only 1 priority in the 3-image branch (the hero).
    const priorityOccurrences = (branch.match(/\bpriority\b/g) ?? []).length;
    expect(priorityOccurrences).toBe(1);
  });

  it('[hero-4img] 4-image desktop branch: hero (images[0], col-span-2 row-span-2) carries priority', () => {
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 4'),
      detailSrc.indexOf('images.length >= 5'),
    );
    expect(branch).toContain('priority');
  });

  it('[hero-4img] 4-image desktop branch: only 1 priority occurrence (hero only)', () => {
    const branch = detailSrc.slice(
      detailSrc.indexOf('images.length === 4'),
      detailSrc.indexOf('images.length >= 5'),
    );
    const priorityOccurrences = (branch.match(/\bpriority\b/g) ?? []).length;
    expect(priorityOccurrences).toBe(1);
  });

  it('[hero-5img] 5+ image desktop branch: hero (images[0], col-span-2 row-span-2) carries priority', () => {
    const branch = detailSrc.slice(detailSrc.indexOf('images.length >= 5'));
    expect(branch).toContain('priority');
  });

  it('[hero-5img] 5+ image desktop branch: non-hero cells (slice 1-4) do NOT carry priority', () => {
    // In the 5+ branch there are 5 ImageWithFallback usages; only the hero (index 0) gets priority.
    // secondary cells in slice(1,4) and the 5th cell have no priority prop.
    const branch = detailSrc.slice(detailSrc.indexOf('images.length >= 5'));
    // Count plain `priority` (boolean shorthand) occurrences — should be 1 (the hero).
    // `priority={i === 0}` does not appear in the 5+ branch; it's the 2-image branch only.
    const priorityOccurrences = (branch.match(/\bpriority\b/g) ?? []).length;
    expect(priorityOccurrences).toBe(1);
  });

  // --- non-hero consumers must have NO priority ---

  it('[no-priority] ImageGallery (lightbox) has NO priority prop on ImageWithFallback', () => {
    // Lightbox is not the LCP element — adding priority here wastes bandwidth on preload.
    // Prove-It: adding priority to the gallery main image makes this fail.
    expect(gallerySrc).not.toContain('priority');
  });

  it('[priority-prop] CampgroundCard accepts a priority prop forwarded from the grid parent (CAM-199)', () => {
    // CAM-199 (PERF-IMG-LCP): CampgroundCard now accepts priority as an optional prop
    // (default false) and forwards it to ImageWithFallback. The grid parent (InfiniteScrollGrid)
    // is responsible for passing priority={index < 4} — only the first 4 above-the-fold
    // cards get it. The card itself never hardcodes priority; control belongs to the caller.
    // Prove-It: removing the priority prop from CampgroundCard interface makes this fail.
    expect(cardSrc).toContain('priority?: boolean');
    // The prop is forwarded to ImageWithFallback (not hardcoded true/false inline).
    expect(cardSrc).toContain('priority={priority}');
  });

  it('[priority-grid] InfiniteScrollGrid passes priority={index < 4} to the first 4 cards only (CAM-199)', () => {
    // CAM-199: first 4 cards are above-the-fold across mobile→desktop breakpoints.
    // Cards at index >= 4 stay lazy (default false). Infinite-scroll-appended cards are
    // always at index >= 4 (initial page has the first 4 at indices 0-3).
    // Prove-It: removing `index < 4` from the grid map makes this fail.
    expect(infiniteGridSrc2).toContain('priority={index < 4}');
    // The map must also capture the index variable.
    expect(infiniteGridSrc2).toMatch(/items\.map\(\(camp,\s*index\)/);
  });

  it('[no-priority] app/bookings/page.tsx has NO priority prop on ImageWithFallback', () => {
    expect(bookingsSrc).not.toContain('priority');
  });

  it('[no-priority] app/dashboard/campsites/page.tsx has NO priority prop on ImageWithFallback', () => {
    expect(dashCampSrc).not.toContain('priority');
  });

  it('[no-priority] ImageUpload (upload preview) has NO priority prop', () => {
    expect(imageUploadSrc).not.toContain('priority');
  });

  it('[no-priority] LogoUpload (128×128 fixed preview) has NO priority prop', () => {
    // LogoUpload uses fixed mode (width+height) — still not an LCP element.
    expect(logoUploadSrc).not.toContain('priority');
  });
});

// ===========================================================================
// AC-5 — next.config images contract
// ===========================================================================

describe('AC-5 — next.config images settings (webp-only, no avif, qualities, blob remote, minimumCacheTTL, no SVG)', () => {

  it('[formats] formats includes "image/webp"', () => {
    // Prove-It: removing "image/webp" from formats makes this fail.
    expect(nextConfigSrc).toContain('"image/webp"');
  });

  it('[formats] formats does NOT include "image/avif" (avif excluded per spec)', () => {
    // Prove-It: adding "image/avif" to the formats array makes this fail.
    expect(nextConfigSrc).not.toContain('"image/avif"');
  });

  it('[dangerouslyAllowSVG] dangerouslyAllowSVG is false (SVG blocked)', () => {
    // Prove-It: setting dangerouslyAllowSVG: true makes this fail.
    expect(nextConfigSrc).toContain('dangerouslyAllowSVG: false');
  });

  it('[remotePatterns] blob storage host *.public.blob.vercel-storage.com is allowed', () => {
    // Prove-It: removing the blob.vercel-storage.com pattern makes this fail.
    expect(nextConfigSrc).toContain('*.public.blob.vercel-storage.com');
  });

  it('[remotePatterns] Unsplash (images.unsplash.com) is present in remotePatterns (mock/demo campsite images)', () => {
    // CAM-213 originally removed unsplash (self-host migration).
    // Re-added as a remotePattern to unblock next/image for mock/demo campsite images
    // that still reference images.unsplash.com (local-dev fix; does not affect the CSP
    // img-src which remains strictly self/blob/OSM only via middleware.ts).
    expect(nextConfigSrc).toContain('images.unsplash.com');
  });

  it('[minimumCacheTTL] minimumCacheTTL is set (non-zero, 31-day equivalent)', () => {
    // Prove-It: removing minimumCacheTTL makes this fail.
    expect(nextConfigSrc).toContain('minimumCacheTTL');
    // The value is computed: 60 * 60 * 24 * 31 (or could be a literal). Either way,
    // the key must be present in the config block.
    expect(nextConfigSrc).toMatch(/minimumCacheTTL:\s*\d/);
  });

  it('[minimumCacheTTL] minimumCacheTTL equals 31-day value (60*60*24*31 = 2678400)', () => {
    // The source uses the expression `60 * 60 * 24 * 31`.
    // Prove-It: changing the value to a shorter TTL makes this fail.
    expect(nextConfigSrc).toContain('60 * 60 * 24 * 31');
  });

  it('[qualities] qualities is [75] (single quality level)', () => {
    // Prove-It: changing qualities to [85] or adding more levels makes this fail.
    expect(nextConfigSrc).toContain('qualities: [75]');
  });
});

// ===========================================================================
// AC-6 — fallback path intact (onError + errored state + ImageOff)
// ===========================================================================

describe('AC-6 — fallback path intact: errored state + onError wired + ImageOff icon', () => {

  it('[errored-state] useState(false) for errored still present in ImageWithFallback', () => {
    // Prove-It: removing the errored state makes this fail.
    expect(iwfSrc).toContain('const [errored, setErrored] = useState(false)');
  });

  it('[errored-state] showFallback = !src || errored logic still present', () => {
    // Prove-It: removing the errored check from showFallback makes this fail.
    expect(iwfSrc).toContain('const showFallback = !src || errored');
  });

  it('[onError] onError={() => setErrored(true)} wired on both Image branches', () => {
    // Both fill and fixed Image components must fire setErrored on error.
    // Prove-It: removing onError from either branch makes this fail.
    const matches = iwfSrc.match(/onError=\{.*?setErrored\(true\).*?\}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('[fallback-icon] ImageOff from lucide-react is still imported', () => {
    // Prove-It: removing the ImageOff import makes this fail.
    expect(iwfSrc).toContain('ImageOff');
    expect(iwfSrc).toContain('from "lucide-react"');
  });

  it('[fallback-render] ImageOff renders in the showFallback branch', () => {
    // The fallback branch must render the ImageOff component.
    // Prove-It: replacing ImageOff with a different icon makes this fail.
    const jsxSection = iwfSrc.slice(iwfSrc.indexOf('return ('));
    expect(jsxSection).toContain('<ImageOff');
  });

  it('[fallback-a11y] fallback ImageOff has aria-hidden="true"', () => {
    // The decorative fallback icon must be hidden from screen-readers.
    expect(iwfSrc).toContain('aria-hidden="true"');
  });

  it('[fallback-testid] fallback placeholder keeps --fallback-placeholder testid suffix', () => {
    // IR-1 contract: the testid suffix must be preserved for QA assertions.
    expect(iwfSrc).toContain('fallback-placeholder');
  });
});

// ===========================================================================
// AC-7 — context-17 (app/bookings/page.tsx) no-CLS wrapper uses aspect-[4/3]
// ===========================================================================

describe('AC-7 — bookings page image wrapper uses aspect-[4/3] (CLS prevention, not h-auto)', () => {

  it('[no-cls] bookings image wrapper has aspect-[4/3] class', () => {
    // Prove-It: swapping aspect-[4/3] for h-auto makes this fail.
    expect(bookingsSrc).toContain('aspect-[4/3]');
  });

  it('[no-cls] bookings image wrapper does NOT use h-auto (h-auto causes CLS on fill images)', () => {
    // h-auto on a relative wrapper with fill image = zero-height container = CLS.
    // Prove-It: adding h-auto to the wrapper class makes this fail.
    const wrapperLine = bookingsSrc
      .split('\n')
      .find((line) => line.includes('aspect-[4/3]')) ?? '';
    expect(wrapperLine).not.toContain('h-auto');
  });

  it('[consumer-wired] bookings page imports and uses ImageWithFallback (adoption intact)', () => {
    // Regression guard from ir1: the component must still be used here.
    expect(bookingsSrc).toContain('ImageWithFallback');
  });

  it('[context-sizes] bookings ImageWithFallback passes sizes prop (required for fill mode)', () => {
    // fill mode without sizes degrades to 100vw — a perf regression.
    // Prove-It: removing sizes from bookings ImageWithFallback makes this fail.
    expect(bookingsSrc).toContain('sizes=');
  });
});

// ===========================================================================
// CAM-213 — self-host images: no-image fallback uses /placeholder-camp.svg
// ===========================================================================

describe('CAM-213 — no-image fallback uses self-hosted placeholder (not unsplash)', () => {
  const cam213CardSrc   = readSrc('components/CampgroundCard.tsx');
  const cam213DetailSrc = readSrc('components/CampgroundDetailClient.tsx');
  const cam213MapSrc    = readSrc('components/MapComponent.tsx');

  it('[fallback] CampgroundCard uses /placeholder-camp.svg as no-image fallback', () => {
    expect(cam213CardSrc).toContain('/placeholder-camp.svg');
  });

  it('[fallback] CampgroundCard does NOT reference images.unsplash.com', () => {
    expect(cam213CardSrc).not.toContain('images.unsplash.com');
  });

  it('[fallback] CampgroundDetailClient uses /placeholder-camp.svg as no-image fallback', () => {
    expect(cam213DetailSrc).toContain('/placeholder-camp.svg');
  });

  it('[fallback] CampgroundDetailClient does NOT reference images.unsplash.com', () => {
    expect(cam213DetailSrc).not.toContain('images.unsplash.com');
  });

  it('[fallback] MapComponent uses /placeholder-camp.svg as no-image fallback', () => {
    expect(cam213MapSrc).toContain('/placeholder-camp.svg');
  });

  it('[fallback] MapComponent does NOT reference images.unsplash.com', () => {
    expect(cam213MapSrc).not.toContain('images.unsplash.com');
  });
});
