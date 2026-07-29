/**
 * cam-664-spot-display-image.test.ts — CAM-664 (S2)
 *
 * `pickSpotDisplayImage` (lib/spot-display-image.ts) is a pure, DOM-free
 * function: given a spot's `images` relation, pick ONE image to show in
 * the fixed-height viewport. Priority: PANORAMA > PHOTO > images[0]
 * (defensive fallback) > null (the dominant case — 2 of 3,006 seeded
 * pitches have any image, story.md).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation (n/a — no external input crosses a validation boundary
 * here, it is a pure selection function over an already-typed array).
 */
import { describe, expect, it } from "vitest";
import { pickSpotDisplayImage } from "@/lib/spot-display-image";

describe("pickSpotDisplayImage — priority PANORAMA > PHOTO > images[0] > null", () => {
  it("[null/empty] no spot at all -> null", () => {
    expect(pickSpotDisplayImage(undefined)).toBeNull();
    expect(pickSpotDisplayImage(null)).toBeNull();
  });

  it("[null/empty] a spot with no images relation -> null", () => {
    expect(pickSpotDisplayImage({})).toBeNull();
    expect(pickSpotDisplayImage({ images: null })).toBeNull();
  });

  it("[boundary] a spot with an empty images array -> null (the dominant case: 2 of 3,006 pitches have any image)", () => {
    expect(pickSpotDisplayImage({ images: [] })).toBeNull();
  });

  it("[normal] PANORAMA wins even when it is not the first image", () => {
    const result = pickSpotDisplayImage({
      images: [
        { url: "https://x/photo-1.jpg", kind: "PHOTO", alt: "a photo" },
        { url: "https://x/pano-1.jpg", kind: "PANORAMA", alt: "a pano" },
        { url: "https://x/photo-2.jpg", kind: "PHOTO", alt: null },
      ],
    });
    expect(result).toEqual({ url: "https://x/pano-1.jpg", alt: "a pano", kind: "PANORAMA" });
  });

  it("[normal] no PANORAMA present -> the first PHOTO wins", () => {
    const result = pickSpotDisplayImage({
      images: [
        { url: "https://x/photo-1.jpg", kind: "PHOTO", alt: "first" },
        { url: "https://x/photo-2.jpg", kind: "PHOTO", alt: "second" },
      ],
    });
    expect(result).toEqual({ url: "https://x/photo-1.jpg", alt: "first", kind: "PHOTO" });
  });

  it("[boundary] a single PANORAMA-only image -> that image, kind preserved", () => {
    const result = pickSpotDisplayImage({
      images: [{ url: "https://x/pano.jpg", kind: "PANORAMA", alt: null }],
    });
    expect(result).toEqual({ url: "https://x/pano.jpg", alt: null, kind: "PANORAMA" });
  });

  it("[normal] a missing alt normalizes to null (never undefined)", () => {
    const result = pickSpotDisplayImage({
      images: [{ url: "https://x/photo.jpg", kind: "PHOTO" }],
    });
    expect(result?.alt).toBeNull();
  });

  it("[error/validation defensive] a row whose kind matches neither enum member falls back to images[0], never throws", () => {
    const result = pickSpotDisplayImage({
      images: [{ url: "https://x/weird.jpg", kind: "SOMETHING_ELSE", alt: "weird" }],
    });
    expect(result).toEqual({ url: "https://x/weird.jpg", alt: "weird", kind: "PHOTO" });
  });

  it("[error/validation defensive] a row with kind undefined/null falls back to images[0], normalized to PHOTO", () => {
    expect(pickSpotDisplayImage({ images: [{ url: "https://x/a.jpg", kind: undefined }] }))
      .toEqual({ url: "https://x/a.jpg", alt: null, kind: "PHOTO" });
    expect(pickSpotDisplayImage({ images: [{ url: "https://x/b.jpg", kind: null }] }))
      .toEqual({ url: "https://x/b.jpg", alt: null, kind: "PHOTO" });
  });
});
