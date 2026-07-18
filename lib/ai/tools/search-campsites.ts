/**
 * CAM-270 AC-1/AC-8, BR-1/BR-2/BR-9 — the `searchCampsites` read-only AI tool.
 *
 * Reuses the exact same where-builder + card select every other catalog
 * caller uses (ADR-009 no-forked-data-path): `buildCampSiteWhere` always
 * gates on isActive/isPublished/deletedAt (BR-1), and `campCardSelect` is the
 * identical card payload shape the catalog grid renders — no parallel query
 * or projection is introduced for the AI layer.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { campCardSelect, type CampCardPayload } from '@/lib/read-models/camp-card';
import type { ToolDefinition } from '@/lib/ai/tool-registry';

/** BR-2 — the tool NEVER returns more than this many cards, regardless of any model-requested count. */
export const SEARCH_CAMPSITES_MAX_RESULTS = 10;

export const searchCampsitesArgsSchema = z.object({
  province: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  petFriendly: z.boolean().optional(),
  /** Model-requested result count — clamped to SEARCH_CAMPSITES_MAX_RESULTS, never honored above it (BR-2). */
  limit: z.number().int().positive().optional(),
});

export type SearchCampsitesArgs = z.infer<typeof searchCampsitesArgsSchema>;

export interface SearchCampsitesResult {
  /** Never null — a zero-match search returns [] so the caller can render an empty state (AC-8). */
  cards: CampCardPayload[];
}

/** CAM-404 — a province arg containing any Thai character triggers the ThailandLocation resolve below. */
const THAI_CHAR_PATTERN = /[ก-๙]/;

/**
 * CAM-404 — `Location.province` is stored in English (e.g. "Chiang Mai"), but
 * the model frequently emits the Thai province name it was given by the user
 * (e.g. "เชียงใหม่"). `buildCampSiteWhere` does an exact match on `province`,
 * so an un-resolved Thai value matches zero rows forever even when camps
 * exist. Resolve via `ThailandLocation` (provinceName ↔ provinceNameEn);
 * English input is returned unchanged (no DB round-trip). Coverage is
 * partial (~12 provinces seeded) — an unmapped Thai province, or any lookup
 * error, falls back to the raw value unchanged (never throws), matching the
 * search's prior behavior for those cases.
 */
async function resolveProvinceForSearch(province: string): Promise<string> {
  if (!THAI_CHAR_PATTERN.test(province)) return province;

  try {
    const match = await prisma.thailandLocation.findFirst({
      where: { provinceName: { contains: province } },
      select: { provinceNameEn: true },
    });
    return match?.provinceNameEn ?? province;
  } catch {
    return province;
  }
}

const jsonSchema = {
  type: 'object',
  properties: {
    province: {
      type: 'string',
      description:
        'Province name in English, e.g. "Chiang Mai". Thai province names (e.g. เชียงใหม่) are also accepted and resolved to the stored English value server-side.',
    },
    type: { type: 'string', description: 'Camp site type code, e.g. CAGD, GLAMP, LAKE' },
    priceMin: { type: 'number', description: 'Minimum nightly price in THB' },
    priceMax: { type: 'number', description: 'Maximum nightly price in THB' },
    petFriendly: { type: 'boolean', description: 'Only include pet-friendly camps when true' },
    limit: { type: 'number', description: `Max results to return (capped at ${SEARCH_CAMPSITES_MAX_RESULTS})` },
  },
  additionalProperties: false,
} as const;

export async function executeSearchCampsites(args: SearchCampsitesArgs): Promise<SearchCampsitesResult> {
  const province = args.province !== undefined ? await resolveProvinceForSearch(args.province) : undefined;

  const where = buildCampSiteWhere({
    province,
    type: args.type,
    min: args.priceMin !== undefined ? String(args.priceMin) : undefined,
    max: args.priceMax !== undefined ? String(args.priceMax) : undefined,
    petFriendly: args.petFriendly,
  });

  // BR-2: hard cap, never overridden by a larger model-supplied count.
  const take = Math.min(args.limit ?? SEARCH_CAMPSITES_MAX_RESULTS, SEARCH_CAMPSITES_MAX_RESULTS);

  const cards = await prisma.campSite.findMany({
    where,
    select: campCardSelect,
    take,
  });

  return { cards };
}

export const searchCampsitesTool: ToolDefinition<SearchCampsitesArgs, SearchCampsitesResult> = {
  name: 'searchCampsites',
  description:
    'Search published, active CampVibe campsites by province, type, price range, and pet-friendliness. Returns at most 10 result cards.',
  parameters: searchCampsitesArgsSchema,
  jsonSchema,
  execute: executeSearchCampsites,
};
