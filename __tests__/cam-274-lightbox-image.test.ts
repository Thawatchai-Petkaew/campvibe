/**
 * CAM-274 — IR-2 Lightbox main image collapsed to 0x0 + rounded preview.
 *
 * Layer: unit (static source analysis, fs.readFileSync — vitest env is 'node').
 * No production code written or edited by this file.
 *
 * Bug (root cause): the lightbox main image rendered ImageWithFallback in fill mode
 * (Mode A) with a wrapper className of only `max-w-full max-h-full` — no intrinsic
 * size. A next/image `fill` child is absolutely positioned and contributes no size
 * to its parent, so the wrapper collapsed to 0x0 and the photo never showed.
 * Thumbnails were unaffected because their wrapper sits inside a fixed `w-20 h-20`
 * button. Regression introduced by the CAM-194 next/image migration.
 *
 * Fix: switch the main image to ImageWithFallback's Mode B (pass width/height as
 * intrinsic hints; no `fill`), size the rendered <img> to its natural aspect ratio
 * within the viewport (`w-auto h-auto` + viewport-relative `max-w-[calc(...)]` /
 * `max-h-[calc(...)]` + `object-contain`), and round the wrapper with `rounded-3xl`
 * (which now hugs the real photo edges because the wrapper shrink-wraps a
 * static/sized child, not an absolutely-positioned fill child).
 *
 * AC coverage matrix:
 *   AC-1  Main image renders Mode B (width+height passed together; no orphan
 *         fill-with-unsized-wrapper) → photo shows centered, correct aspect.
 *   AC-2  Wrapper carries rounded-3xl (hugs the real photo, not a letterbox box)
 *         and bg-transparent (does not show a muted box behind a loaded photo).
 *   AC-3  Rendered <img> classes size to natural aspect within the viewport
 *         (w-auto h-auto + object-contain), constrained by viewport-relative
 *         max-w/max-h (not a parent-percentage, which would be circular since
 *         the wrapper shrink-wraps the img in Mode B).
 *   AC-4  Mobile fit: the surrounding container uses responsive padding
 *         (p-4 on mobile, md:p-20 on desktop) so photo + rounding aren't crushed
 *         on small viewports.
 *   AC-5  Thumbnails untouched: still fill mode (no width/height), still
 *         w-20 h-20 fixed wrapper button, still rounded-2xl + sizes="80px".
 *   AC-6  No regression to keyboard nav / backdrop close / a11y attributes
 *         (dialog role, aria-modal, aria-label, focus rings) on the gallery shell.
 *
 * Prove-It notes (verified red-before-green per story):
 *   AC-1: reverting to no width/height (fill mode) on the main image makes the
 *         Mode B test fail.
 *   AC-2: removing rounded-3xl or bg-transparent from the main wrapper className
 *         makes those tests fail.
 *   AC-3: removing w-auto/h-auto or reverting to a parent-percentage max-w-full
 *         (with no viewport calc) makes the sizing test fail.
 *   AC-4: reverting the container to a fixed p-20 (no mobile override) makes the
 *         responsive-padding test fail.
 *   AC-5: adding width/height to the thumbnail ImageWithFallback call, or
 *         shrinking the thumbnail button below w-20 h-20, makes those tests fail.
 *
 * Companion files:
 *   __tests__/cam-194-perf4-next-image.test.ts — updated (not weakened) to reflect
 *     the Mode B change on the main image; thumbnails still assert fill mode.
 *   __tests__/f3-detail-surface.test.ts — a11y/token/i18n guard on ImageGallery
 *     (dialog role, focus rings, scrim exemption) — unaffected by this fix.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const gallerySrc = src("components/ImageGallery.tsx");

// The main image lives between the "Main Image" and "Next Button" comment markers.
const mainImageBlock = gallerySrc.slice(
  gallerySrc.indexOf("{/* Main Image */}"),
  gallerySrc.indexOf("{/* Next Button */}"),
);

// The thumbnail strip lives after its own comment marker to the end of the file.
const thumbnailBlock = gallerySrc.slice(gallerySrc.indexOf("{/* Thumbnail Strip */}"));

describe("AC-1 — main image uses Mode B (width+height), not an orphan fill-with-unsized-wrapper", () => {
  it("[mode-b] main image passes width={1600} height={1200} together", () => {
    expect(mainImageBlock).toContain("width={1600}");
    expect(mainImageBlock).toContain("height={1200}");
  });

  it("[no-fill] main image does NOT pass a bare `fill` prop (Mode A is not used here)", () => {
    expect(mainImageBlock).not.toMatch(/<ImageWithFallback[\s\S]{0,300}\bfill\b/);
  });

  it("[no-orphan-wrapper] main wrapper className is not the old unsized-only value", () => {
    // The pre-fix bug: className="max-w-full max-h-full" with nothing else — no
    // intrinsic size hint anywhere on the call. Guard against regressing to that
    // exact orphan wrapper (width/height absent AND no rounded-3xl/bg-transparent).
    expect(mainImageBlock).not.toMatch(
      /className="max-w-full max-h-full"\s*\n\s*imgClassName/,
    );
  });
});

describe("AC-2 — main wrapper rounds the real photo edges (rounded-3xl) and is transparent (bg-transparent)", () => {
  it("[radius] main image wrapper className carries rounded-3xl", () => {
    expect(mainImageBlock).toMatch(/className="[^"]*\brounded-3xl\b[^"]*"/);
  });

  it("[bg] main image wrapper className carries bg-transparent", () => {
    expect(mainImageBlock).toMatch(/className="[^"]*\bbg-transparent\b[^"]*"/);
  });

  it("[radius-scale] rounded-3xl is the DESIGN.md card/modal radius token (not an arbitrary px value)", () => {
    expect(mainImageBlock).not.toMatch(/rounded-\[\d+px\]/);
  });
});

describe("AC-3 — rendered <img> sizes to its natural aspect within the viewport (not a circular parent-percentage)", () => {
  it("[intrinsic] imgClassName includes w-auto and h-auto (lets HTML width/height attrs drive aspect ratio)", () => {
    expect(mainImageBlock).toMatch(/imgClassName="[^"]*\bw-auto\b[^"]*"/);
    expect(mainImageBlock).toMatch(/imgClassName="[^"]*\bh-auto\b[^"]*"/);
  });

  it("[object-fit] imgClassName includes object-contain (no cropping of the photo)", () => {
    expect(mainImageBlock).toMatch(/imgClassName="[^"]*\bobject-contain\b[^"]*"/);
  });

  it("[viewport-constrained] imgClassName constrains size via viewport-relative calc, not a parent-percentage", () => {
    // max-w-full/max-h-full on the *img* itself (as opposed to the wrapper) would be
    // circular in Mode B since the wrapper shrink-wraps the img. Must use vw/vh calc.
    expect(mainImageBlock).toMatch(/max-w-\[calc\(100vw[^)]*\)\]/);
    expect(mainImageBlock).toMatch(/max-h-\[calc\(100vh[^)]*\)\]/);
  });

  it("[no-sizes] main image does not pass a sizes prop (unused in Mode B)", () => {
    expect(mainImageBlock).not.toMatch(/\bsizes=/);
  });
});

describe("AC-4 — surrounding container uses responsive padding so mobile isn't crushed", () => {
  it("[mobile-padding] main image container uses p-4 on mobile", () => {
    expect(gallerySrc).toMatch(/flex items-center justify-center p-4 md:p-20/);
  });

  it("[desktop-padding] main image container keeps md:p-20 on desktop (unchanged breathing room)", () => {
    expect(gallerySrc).toContain("md:p-20");
  });
});

describe("AC-5 — thumbnails are untouched: fill mode, fixed w-20 h-20 wrapper, rounded-2xl, sizes=80px", () => {
  it("[fill-mode] thumbnails do NOT pass width or height to ImageWithFallback", () => {
    expect(thumbnailBlock).not.toMatch(/ImageWithFallback[\s\S]{0,200}width=\{/);
    expect(thumbnailBlock).not.toMatch(/ImageWithFallback[\s\S]{0,200}height=\{/);
  });

  it('[fixed-button] thumbnail button keeps w-20 h-20 (fixed intrinsic size that made fill mode safe)', () => {
    expect(thumbnailBlock).toMatch(/\bw-20\b/);
    expect(thumbnailBlock).toMatch(/\bh-20\b/);
  });

  it("[radius] thumbnail button keeps rounded-2xl (unchanged, distinct from the main image's rounded-3xl)", () => {
    expect(thumbnailBlock).toContain("rounded-2xl");
  });

  it('[sizes] thumbnails keep sizes="80px" (required for fill mode)', () => {
    expect(thumbnailBlock).toContain('sizes="80px"');
  });

  it("[object-fit] thumbnails keep object-cover (crop-to-fill, unlike the main image's object-contain)", () => {
    expect(thumbnailBlock).toContain("object-cover");
  });
});

describe("AC-6 — no regression to keyboard nav / backdrop close / a11y on the gallery shell", () => {
  it('[a11y] dialog wrapper still has role="dialog" aria-modal="true"', () => {
    expect(gallerySrc).toContain('role="dialog"');
    expect(gallerySrc).toContain('aria-modal="true"');
  });

  it("[keyboard] Escape / ArrowLeft / ArrowRight handlers are still wired", () => {
    expect(gallerySrc).toContain('e.key === "Escape"');
    expect(gallerySrc).toContain('e.key === "ArrowLeft"');
    expect(gallerySrc).toContain('e.key === "ArrowRight"');
  });

  it("[backdrop] handleBackdropClick still closes only on a direct backdrop click", () => {
    expect(gallerySrc).toContain("e.target === e.currentTarget");
  });

  it("[focus-ring] prev/next/close buttons still carry a visible focus ring", () => {
    expect(gallerySrc).toContain("focus:ring-2 focus:ring-white");
  });
});
