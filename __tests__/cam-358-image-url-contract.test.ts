/**
 * cam-358-image-url-contract.test.ts — CAM-358
 *
 * Root cause: `POST /api/upload` (app/api/upload/route.ts) returns a
 * ROOT-RELATIVE `/uploads/<file>` path in local dev (no BLOB_READ_WRITE_TOKEN)
 * and an ABSOLUTE blob `https://` URL once the token is configured.
 * `lib/validations/campsite.ts` `logo` and `lib/validations/image.ts`
 * `imageInputSchema` (both union branches) validated with a bare
 * `z.string().url()`, which only ever accepts the absolute shape — so a
 * re-upload on the dev fallback path, and any legacy relative row already in
 * the DB (e.g. `/placeholder-camp.svg`), 400'd on save with zod's generic
 * union message and could never be saved again.
 *
 * This story widens the value rule (NOT the API contract — app/api/upload
 * is untouched) to accept a root-relative path alongside an absolute URL,
 * while rejecting the CAM-215-style open-redirect bypass shapes
 * (protocol-relative `//`, backslash-prefixed `/\`, and any control
 * character anywhere in the value) and the empty string at the rule level.
 *
 * Layer: unit (zod boundary) + source-inspection (fs.readFileSync), same
 * precedent as __tests__/cam-356-form-validation-ux.test.ts and
 * __tests__/cam-352-image-kind-groundwork.test.ts — CampgroundForm.tsx and
 * spot-form-dialog.tsx have no isolated render harness (node environment,
 * no jsdom — see vitest.config.ts).
 *
 * AC coverage:
 *   AC-1  re-upload on the dev fallback path (relative /uploads/... URL) saves
 *   AC-2  a legacy relative row (e.g. /placeholder-camp.svg) round-trips + saves
 *   AC-3  //evil.com (protocol-relative) is rejected with the Thai copy
 *   AC-4  required-field markers render only on genuinely schema-required fields
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { imageInputSchema, imageUrlValue, isSafeImageUrl } from '@/lib/validations/image';
import { campSiteSchema } from '@/lib/validations/campsite';
import { imageCreateNested } from '@/lib/api-utils';

const IMAGE_URL_ERROR = 'ลิงก์รูปไม่ถูกต้อง';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---------------------------------------------------------------------------
// 1. isSafeImageUrl / imageUrlValue — the shared value rule (unit)
// ---------------------------------------------------------------------------
describe('isSafeImageUrl (CAM-358) — accepts absolute http(s) + safe root-relative paths', () => {
  it('[normal] an absolute https URL passes', () => {
    expect(isSafeImageUrl('https://blob.vercel-storage.com/campvibe-upload-abc123.jpg')).toBe(true);
  });

  it('[normal] an absolute http URL passes', () => {
    expect(isSafeImageUrl('http://cdn.example.com/a.jpg')).toBe(true);
  });

  it('[normal] a root-relative path (the /api/upload dev fallback shape) passes', () => {
    expect(isSafeImageUrl('/uploads/campvibe-upload-1700000000000-123.jpg')).toBe(true);
  });

  it('[normal] a legacy relative row already in the DB passes', () => {
    expect(isSafeImageUrl('/placeholder-camp.svg')).toBe(true);
  });

  it('[null/empty] the empty string fails at the rule level', () => {
    expect(isSafeImageUrl('')).toBe(false);
  });

  it('[error/validation] protocol-relative //evil.com is rejected (would resolve to a different origin)', () => {
    expect(isSafeImageUrl('//evil.com/x.jpg')).toBe(false);
  });

  it('[error/validation] a backslash right after the leading slash is rejected', () => {
    expect(isSafeImageUrl('/\\evil.com')).toBe(false);
  });

  it('[boundary] a control character anywhere in the value is rejected (CAM-215 lesson: not just the prefix)', () => {
    expect(isSafeImageUrl('/x\ty')).toBe(false);
    expect(isSafeImageUrl('/\t//evil.com')).toBe(false);
  });

  it('[error/validation] a bare non-url, non-relative string is rejected', () => {
    expect(isSafeImageUrl('not-a-url')).toBe(false);
  });

  it('[boundary] a path with two+ leading slashes beyond // is still rejected', () => {
    expect(isSafeImageUrl('///evil.com')).toBe(false);
  });

  // G3 nit-close: the scheme-safety invariant (only http/https are ever
  // accepted as an absolute URL — every other scheme falls through to the
  // root-relative check and is rejected there since none of these start with
  // a bare `/`) had zero direct tests. Pinned explicitly so a future refactor
  // of isSafeImageUrl can't silently regress it.
  it('[error/validation] javascript: scheme is rejected', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('[error/validation] a leading-space javascript: scheme is rejected (WHATWG trims the space, protocol is still non-http)', () => {
    expect(isSafeImageUrl(' javascript:alert(1)')).toBe(false);
  });

  it('[error/validation] data: scheme is rejected', () => {
    expect(isSafeImageUrl('data:text/html;base64,x')).toBe(false);
  });

  it('[error/validation] file: scheme is rejected', () => {
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
  });

  it('[error/validation] vbscript: scheme is rejected', () => {
    expect(isSafeImageUrl('vbscript:x')).toBe(false);
  });

  it('[error/validation] blob: scheme is rejected', () => {
    expect(isSafeImageUrl('blob:https://x')).toBe(false);
  });

  it('[error/validation] ftp: scheme is rejected (only http/https are accepted, not just "any URL-shaped value")', () => {
    expect(isSafeImageUrl('ftp://host/x.jpg')).toBe(false);
  });

  it('[normal] an uppercase HTTP scheme still passes (WHATWG lowercases the scheme before the protocol check)', () => {
    expect(isSafeImageUrl('HTTP://cdn.example.com/x.jpg')).toBe(true);
  });

  it('[boundary] a bare "/" is degenerate but currently passes the root-relative check — pinned intentionally, not a silent gap', () => {
    expect(isSafeImageUrl('/')).toBe(true);
  });
});

describe('imageUrlValue — zod wrapper carries the Thai error message', () => {
  it('[normal] a safe relative path parses through', () => {
    expect(imageUrlValue.parse('/uploads/x.jpg')).toBe('/uploads/x.jpg');
  });

  it('[error/validation] an unsafe value fails with the exact Thai copy (AC-3)', () => {
    const result = imageUrlValue.safeParse('//evil.com');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(IMAGE_URL_ERROR);
    }
  });

  it('[null/empty] empty string fails with the same Thai copy at this level', () => {
    const result = imageUrlValue.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(IMAGE_URL_ERROR);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. imageInputSchema — both union branches accept the widened contract
// ---------------------------------------------------------------------------
describe('imageInputSchema (CAM-358) — both branches accept root-relative URLs', () => {
  it('[normal] the bare-string branch accepts a relative /uploads path and normalizes to {url, kind}', () => {
    const result = imageInputSchema.parse('/uploads/campvibe-upload-1700000000000-123.jpg');
    expect(result).toEqual({ url: '/uploads/campvibe-upload-1700000000000-123.jpg', kind: 'PHOTO' });
  });

  it('[normal] the object branch accepts a relative url field (AC-1)', () => {
    const result = imageInputSchema.parse({ url: '/uploads/x.jpg', kind: 'PANORAMA' });
    expect(result).toEqual({ url: '/uploads/x.jpg', kind: 'PANORAMA' });
  });

  it('[error/validation] the bare-string branch rejects protocol-relative //evil.com', () => {
    const result = imageInputSchema.safeParse('//evil.com');
    expect(result.success).toBe(false);
  });

  it('[error/validation] the object branch rejects protocol-relative //evil.com in its url field', () => {
    const result = imageInputSchema.safeParse({ url: '//evil.com', kind: 'PHOTO' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. campSiteSchema.logo — the field this bug actually broke (AC-1, AC-2, AC-3)
// ---------------------------------------------------------------------------
describe('campSiteSchema.logo (CAM-358) — accepts the real /api/upload contract', () => {
  it('[normal] a dev-fallback relative logo URL saves (AC-1 — re-upload no longer 400s)', () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: 'ทดสอบ',
      logo: '/uploads/campvibe-upload-1700000000000-123.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('[normal] a legacy relative row already in the DB saves unchanged (AC-2)', () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: 'ทดสอบ',
      logo: '/placeholder-camp.svg',
    });
    expect(result.success).toBe(true);
  });

  it('[normal] an absolute blob URL still saves (the token-configured path, unchanged behavior)', () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: 'ทดสอบ',
      logo: 'https://blob.vercel-storage.com/campvibe-upload-abc123.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('[null/empty] an empty logo (no logo set) still saves via the literal branch', () => {
    const result = campSiteSchema.partial().safeParse({ nameTh: 'ทดสอบ', logo: '' });
    expect(result.success).toBe(true);
  });

  it('[error/validation] //evil.com is rejected with the Thai copy (AC-3)', () => {
    const result = campSiteSchema.partial().safeParse({ nameTh: 'ทดสอบ', logo: '//evil.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const logoIssue = result.error.issues.find((i) => i.path[0] === 'logo');
      expect(logoIssue?.message).toBe(IMAGE_URL_ERROR);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. imageCreateNested — the persistence helper is unaffected (relative
//    strings already passed through; this guards it stays that way now that
//    the zod boundary in front of it validates the same shape).
// ---------------------------------------------------------------------------
describe('imageCreateNested — persists relative URLs correctly (regression guard)', () => {
  it('[normal] a mixed relative + absolute array persists both, sortOrder preserved', () => {
    const result = imageCreateNested(['/uploads/a.jpg', 'https://cdn.example.com/b.jpg']);
    expect(result).toEqual({
      create: [
        { url: '/uploads/a.jpg', sortOrder: 0, kind: 'PHOTO' },
        { url: 'https://cdn.example.com/b.jpg', sortOrder: 1, kind: 'PHOTO' },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// 5. components/ui/input-field.tsx — the required-marker source guard (AC-4)
// ---------------------------------------------------------------------------
describe('InputField (CAM-358) — required marker rendering', () => {
  const src = read('components/ui/input-field.tsx');

  it('destructures `required` (does not silently forward it only via ...props)', () => {
    expect(src).toMatch(/\n\s*required,\n/);
  });

  it('renders a `*` marker next to the label, token-colored, aria-hidden (the accessible signal stays the native required attribute)', () => {
    expect(src).toContain('{required && (');
    expect(src).toContain('<span className="text-destructive" aria-hidden="true">');
  });

  it('still forwards `required` to the native input for the real accessible signal', () => {
    expect(src).toContain('required={required}');
  });
});

// ---------------------------------------------------------------------------
// 6. components/CampgroundForm.tsx — required marker applied only to
//    genuinely schema-required fields (AC-4)
// ---------------------------------------------------------------------------
describe('CampgroundForm (CAM-358) — required marker honesty', () => {
  const src = read('components/CampgroundForm.tsx');

  const REQUIRED_FIELDS: Array<[string, string]> = [
    ['nameTh', 'label={t.newCampground.nameTh}\n                                        required'],
    ['latitude', 'label={t.newCampground.latitude}\n                                        required'],
    ['longitude', 'label={t.newCampground.longitude}\n                                        required'],
    ['checkInTime', 'label={t.newCampground.checkIn}\n                                    required'],
    ['checkOutTime', 'label={t.newCampground.checkOut}\n                                    required'],
  ];

  REQUIRED_FIELDS.forEach(([field, snippet]) => {
    it(`${field} (schema-required) carries the required marker`, () => {
      expect(src).toContain(snippet);
    });
  });

  it('nameEn (schema-optional) does NOT carry a decorative required marker (honesty fix)', () => {
    expect(src).not.toContain('label={t.newCampground.nameEn}\n                                        required');
    expect(src).toContain('label={t.newCampground.nameEn}\n                                        value={formData.nameEn}');
  });

  it('campSiteSchema.nameEn is indeed optional (documents why no marker belongs here)', () => {
    expect(campSiteSchema.shape.nameEn.isOptional()).toBe(true);
  });

  it('campSiteSchema.latitude/longitude/checkInTime/checkOutTime are indeed required (documents the marker choice)', () => {
    expect(campSiteSchema.shape.latitude.isOptional()).toBe(false);
    expect(campSiteSchema.shape.longitude.isOptional()).toBe(false);
    expect(campSiteSchema.shape.checkInTime.isOptional()).toBe(false);
    expect(campSiteSchema.shape.checkOutTime.isOptional()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. components/spot-form-dialog.tsx — required marker on spotSchema-required
//    fields (AC-4)
// ---------------------------------------------------------------------------
describe('SpotFormDialog (CAM-358) — required marker honesty', () => {
  const src = read('components/spot-form-dialog.tsx');

  it('name carries the required marker (spotSchema.name is required)', () => {
    expect(src).toContain('label={copy.nameLabel}\n            required');
  });

  it('pricePerNight carries the required marker (spotSchema.pricePerNight is required)', () => {
    expect(src).toContain('label={copy.pricePerNightLabel}\n              required');
  });

  it('zone (schema-optional) does NOT carry a required marker', () => {
    expect(src).not.toContain('label={copy.zoneLabel}\n            required');
  });
});
