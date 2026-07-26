/**
 * lib/validations/catalog-cursor.ts — PERF-3 / CAM-196
 *
 * Zod schema for GET /api/campsites query parameters (cursor + sort extension).
 *
 * Validates at the boundary per .claude/rules/api.md §1 — parse failure → 400.
 * Existing filter params (type, keyword, province, …) are forwarded unchanged to
 * buildCampSiteWhere; they are defined in lib/validations/campsite.ts already and
 * re-declared here as passthrough strings (coerced to string, optional).
 */

import { z } from 'zod';
import { VALID_SORTS } from '@/lib/catalog-cursor';
import { FILTERABLE_ZOD_FIELDS, type FilterableZodField } from '@/lib/taxonomy-registry';

// ---------------------------------------------------------------------------
// Sort + cursor params
// ---------------------------------------------------------------------------

/**
 * SECURITY (G3 review finding — event-loop DoS / wasted round-trips):
 * startDate/endDate must parse to a real date before reaching
 * buildCampSiteWhere or CAM-344's availability helper. An unparseable value
 * (e.g. `endDate=garbage`) previously flowed through as an Invalid Date into
 * 4 Prisma queries that threw and got silently swallowed by the fail-open
 * catch (4 wasted round-trips per request).
 *
 * Chosen behaviour: normalize an unparseable value to `undefined` — treated
 * as "no dates supplied" (undated search, no badge) — rather than failing
 * the whole request with a 400. The public, unauthenticated catalog GET must
 * keep returning results even when a caller sends a malformed date; a 400
 * here would be a new way to break the public listing that didn't exist
 * before this story.
 *
 * This does NOT cap the SPAN of an otherwise-valid range (a 1000-year span
 * still parses and passes through) — the span cap is a single choke point in
 * lib/campsite-availability.ts (MAX_STATUS_RANGE_NIGHTS), shared by both
 * attach points (SSR + this cursor route), not duplicated here.
 */
const optionalDateString = z
  .string()
  .optional()
  .transform((value) => (value !== undefined && !Number.isNaN(Date.parse(value)) ? value : undefined));

// CAM-523 (S7) — the 8 taxonomy query params (access/facilities/external/
// equipment/activities/terrain/annotatedFeatures/camperStyle) are GENERATED
// from lib/taxonomy-registry.ts's FILTERABLE_ZOD_FIELDS instead of being
// hand-listed here. Each is `z.string().optional()`, byte-identical to the
// pre-CAM-523 shape. Adding a new filterable MasterData group to the
// registry widens this schema automatically.
const taxonomyFieldsShape = Object.fromEntries(
  FILTERABLE_ZOD_FIELDS.map((field) => [field, z.string().optional()])
) as Record<FilterableZodField, z.ZodOptional<z.ZodString>>;

export const catalogQuerySchema = z.object({
  // ── cursor params ─────────────────────────────────────────────────────────
  sort: z.enum(VALID_SORTS).optional().default('related'),
  cursor: z.string().optional(),

  // ── existing filter params — forwarded to buildCampSiteWhere unchanged ───
  type:       z.string().optional(),
  keyword:    z.string().optional(),
  province:   z.string().optional(),
  district:   z.string().optional(),
  startDate:  optionalDateString,
  endDate:    optionalDateString,
  guests:     z.string().optional(),
  min:        z.string().optional(),
  max:        z.string().optional(),

  // ── taxonomy params (registry-derived — see taxonomyFieldsShape above) ───
  ...taxonomyFieldsShape,
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
