/**
 * lib/spot-display-image.ts — CAM-664 (S2, per-spot viewport)
 *
 * A pure, DOM-free image-selection function for the pitch viewport: given a
 * spot's `images` relation (Prisma `Image[]`, polymorphic — kind PHOTO or
 * PANORAMA per `prisma/schema.prisma`), pick ONE image to show.
 *
 * Priority: PANORAMA (the pan-strip experience, CAM-354) > PHOTO (flat
 * lightbox) > the first image regardless of its `kind` (a defensive
 * fallback for a row whose `kind` is neither of the two live enum members
 * — e.g. a loosely-typed/legacy payload) > `null` (no image at all).
 *
 * `null` is the DOMINANT case today: only 2 of 3,006 seeded pitches carry
 * any image (story.md). The caller renders `null` through
 * `ImageWithFallback`'s own built-in empty slot (`components/ui/image-with-
 * fallback.tsx`, DESIGN.md "Empty image slot", CAM-539) — this module never
 * renders anything itself, it only decides WHICH image (if any).
 */

export interface SpotDisplayImageInput {
  url: string;
  kind?: string | null;
  alt?: string | null;
}

export interface SpotDisplayImage {
  url: string;
  alt: string | null;
  kind: 'PANORAMA' | 'PHOTO';
}

export function pickSpotDisplayImage(
  spot: { images?: SpotDisplayImageInput[] | null } | null | undefined
): SpotDisplayImage | null {
  const images = spot?.images ?? [];
  if (images.length === 0) return null;

  const panorama = images.find((img) => img.kind === 'PANORAMA');
  if (panorama) {
    return { url: panorama.url, alt: panorama.alt ?? null, kind: 'PANORAMA' };
  }

  const photo = images.find((img) => img.kind === 'PHOTO');
  if (photo) {
    return { url: photo.url, alt: photo.alt ?? null, kind: 'PHOTO' };
  }

  // Defensive fallback: images[0] whatever its (unexpected) kind value is.
  const first = images[0];
  return {
    url: first.url,
    alt: first.alt ?? null,
    kind: first.kind === 'PANORAMA' ? 'PANORAMA' : 'PHOTO',
  };
}
