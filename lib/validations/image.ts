import { z } from 'zod';

/**
 * CAM-352 groundwork — shared image-input contract (tech.md "Write-path contract").
 *
 * Mirrors the Prisma `ImageKind` enum (`prisma/schema.prisma` `model Image`).
 * `PANORAMA` = an iPhone-style wide-strip pano, NOT an equirectangular sphere —
 * the future viewer (CAM-355) must not assume a sphere.
 */
export const imageKindEnum = z.enum(['PHOTO', 'PANORAMA']);

const IMAGE_URL_ERROR = 'ลิงก์รูปไม่ถูกต้อง';

/**
 * CAM-358 — the real write path: `POST /api/upload` (app/api/upload/route.ts)
 * returns a ROOT-RELATIVE `/uploads/<file>` path in local dev (no
 * BLOB_READ_WRITE_TOKEN) and an ABSOLUTE blob `https://` URL once the token is
 * set. `z.string().url()` alone only ever accepted the absolute shape, so a
 * re-upload on a dev/un-configured env and any legacy relative row already in
 * the DB (e.g. `/placeholder-camp.svg`) both 400'd with zod's generic union
 * message and could never be saved again.
 *
 * Accepts EITHER an absolute `http(s)://` URL OR a root-relative path that
 * starts with exactly ONE leading `/`. Rejects:
 *  - `//evil.com` (protocol-relative — resolves to a different origin)
 *  - `/\evil.com` (backslash after the leading slash — browsers treat `\` as
 *    a path separator too, so this is the same bypass in disguise)
 *  - any control character (charCode < 0x20) ANYWHERE in the value — the
 *    CAM-215 open-redirect lesson applies here too: `/\t//evil.com` still
 *    passes a bare leading-`/` check, so every character is scanned, not just
 *    the prefix.
 *  - the empty string (callers that allow "no image" do so via a SEPARATE
 *    `.or(z.literal(''))` branch on top of this rule, e.g. `logo` below).
 */
export function isSafeImageUrl(value: string): boolean {
  if (value === '') return false;

  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return false;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
  } catch {
    // Not an absolute URL — fall through to the root-relative check below.
  }

  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
}

/**
 * The shared value rule: absolute http(s) URL OR a safe root-relative path.
 * Apply this everywhere an image/logo URL is validated instead of the bare
 * `z.string().url()` (which rejects every relative path the upload route can
 * legitimately return).
 */
export const imageUrlValue = z
  .string()
  .min(1, IMAGE_URL_ERROR)
  .refine(isSafeImageUrl, IMAGE_URL_ERROR);

/**
 * Backward-compatible by addition (`.claude/rules/api.md` rule 12): accepts EITHER
 * the legacy bare `string` URL shape OR the new `{url, kind}` shape, and normalizes
 * both to a stable `{url, kind}` object so every downstream consumer sees one shape.
 * A legacy `string[]` payload (old cached client, un-migrated caller) keeps working
 * end-to-end — it is transformed to `kind: 'PHOTO'` (the column default).
 */
export const imageInputSchema = z.union([
  imageUrlValue.transform((url) => ({ url, kind: 'PHOTO' as const })),
  z.object({ url: imageUrlValue, kind: imageKindEnum.default('PHOTO') }),
]);

export type ImageInput = z.infer<typeof imageInputSchema>;
