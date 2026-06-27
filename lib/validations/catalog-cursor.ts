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

// ---------------------------------------------------------------------------
// Sort + cursor params
// ---------------------------------------------------------------------------

export const catalogQuerySchema = z.object({
  // ── cursor params ─────────────────────────────────────────────────────────
  sort: z.enum(VALID_SORTS).optional().default('related'),
  cursor: z.string().optional(),

  // ── existing filter params — forwarded to buildCampSiteWhere unchanged ───
  type:       z.string().optional(),
  keyword:    z.string().optional(),
  province:   z.string().optional(),
  district:   z.string().optional(),
  startDate:  z.string().optional(),
  endDate:    z.string().optional(),
  guests:     z.string().optional(),
  min:        z.string().optional(),
  max:        z.string().optional(),
  access:     z.string().optional(),
  facilities: z.string().optional(),
  external:   z.string().optional(),
  equipment:  z.string().optional(),
  activities: z.string().optional(),
  terrain:    z.string().optional(),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
