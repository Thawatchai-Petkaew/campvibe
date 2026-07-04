import { z } from 'zod';

/**
 * CAM-352 groundwork — shared image-input contract (tech.md "Write-path contract").
 *
 * Mirrors the Prisma `ImageKind` enum (`prisma/schema.prisma` `model Image`).
 * `PANORAMA` = an iPhone-style wide-strip pano, NOT an equirectangular sphere —
 * the future viewer (CAM-355) must not assume a sphere.
 */
export const imageKindEnum = z.enum(['PHOTO', 'PANORAMA']);

/**
 * Backward-compatible by addition (`.claude/rules/api.md` rule 12): accepts EITHER
 * the legacy bare `string` URL shape OR the new `{url, kind}` shape, and normalizes
 * both to a stable `{url, kind}` object so every downstream consumer sees one shape.
 * A legacy `string[]` payload (old cached client, un-migrated caller) keeps working
 * end-to-end — it is transformed to `kind: 'PHOTO'` (the column default).
 */
export const imageInputSchema = z.union([
  z.string().url().transform((url) => ({ url, kind: 'PHOTO' as const })),
  z.object({ url: z.string().url(), kind: imageKindEnum.default('PHOTO') }),
]);

export type ImageInput = z.infer<typeof imageInputSchema>;
