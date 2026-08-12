import type { PrismaClient } from '@prisma/client';
import type { AiChatCardTag } from '@/lib/api-client';

/**
 * lib/ai/tools/taxonomy-tags.ts — CAM-716.
 *
 * Extracted from `lib/ai/tools/search-campsites.ts` (CAM-564's per-card
 * `matchedTag` derivation + CAM-709's `appliedFilters.taxonomy` label
 * resolution) so `lib/ai/tools/bulk-availability.ts` can reuse the IDENTICAL
 * priority order, skip-when-no-taxonomy-filter behaviour, and batched
 * (no-N+1) lookups for its own cards (CAM-716 BR-3/BR-4) — the CAM-566
 * shared-matcher precedent, one algorithm with one home. `searchCampsites`
 * now calls through this module too; behavior is byte-identical for it (the
 * pre-existing `__tests__/cam-564-*.test.ts` pins keep passing unmodified),
 * only the code's home moved.
 */

/**
 * CAM-564 BR-2 — the multi-match PRIORITY order (highest first) used to pick
 * ONE leading badge when a search's own filters supply codes across more
 * than one taxonomy group and a card matches more than one of them. This is
 * a DELIBERATE editorial order, never data/arrival/DB-return order — see
 * `search-campsites.ts`'s original story.md BR-2 for the full per-group
 * rationale (terrain > camperStyle > annotatedFeatures > activities >
 * facilities > access > equipment).
 */
export const MATCHED_TAG_GROUP_PRIORITY = [
  'terrain',
  'camperStyle',
  'annotatedFeatures',
  'activities',
  'facilities',
  'access',
  'equipment',
] as const;
export type MatchedTagGroupKey = (typeof MATCHED_TAG_GROUP_PRIORITY)[number];

/**
 * The 7 taxonomy-filter argument fields both `searchCampsites` and
 * `bulkAvailability` accept, under the SAME names/shape (`string |
 * string[]`, CAM-461 Decision 4 OR-within-group arrays). `bulkAvailability`
 * does not offer `equipment` (out of its own v1 scope) — TypeScript's
 * structural typing allows an object that simply lacks that OPTIONAL key to
 * still satisfy this interface, so `deriveMatchedTags`/`buildTaxonomyEcho`
 * below work unmodified for either tool's args: `equipment` then never
 * contributes a candidate code, honestly, since bulk never offers that
 * filter.
 */
export interface TaxonomyFilterArgs {
  terrain?: string | string[];
  access?: string | string[];
  activities?: string | string[];
  facilities?: string | string[];
  annotatedFeatures?: string | string[];
  camperStyle?: string | string[];
  equipment?: string | string[];
}

/** A single-string arg is one code; an array arg (OR-within-group, CAM-461) is 1+ — either way, normalize to a code list. Absent -> []. */
export function toCodeList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function codesByGroup(args: TaxonomyFilterArgs): Record<MatchedTagGroupKey, string[]> {
  return {
    terrain: toCodeList(args.terrain),
    camperStyle: toCodeList(args.camperStyle),
    annotatedFeatures: toCodeList(args.annotatedFeatures),
    activities: toCodeList(args.activities),
    facilities: toCodeList(args.facilities),
    access: toCodeList(args.access),
    equipment: toCodeList(args.equipment),
  };
}

/** The one Prisma delegate `deriveMatchedTags` needs. */
export type TaxonomyLookupPrisma = Pick<PrismaClient, 'campSite'>;

/**
 * CAM-564 BR-1/BR-3/BR-4 — derives, per returned card, the ONE taxonomy tag
 * that honestly explains why THAT card is in these results.
 *
 * Why a second, small, BATCHED query is needed (never inferred from `args`
 * alone): a group's own ARRAY form is OR-within-group (CAM-461) — e.g.
 * `terrain:["RIVE","BEAC"]` guarantees a returned card has AT LEAST ONE of
 * the two, never tells the caller WHICH one. Only a real read of this card's
 * own MasterData rows (bounded to the small set of codes THIS search itself
 * supplied) can say which specific code the card carries.
 *
 * Batched (performance.md no-N+1): ONE extra `findMany` for the WHOLE page
 * of cards, never a per-card query in a loop. Skipped entirely when the
 * search supplied no taxonomy filter at all (`candidateCodes` empty).
 *
 * Fail-open: a lookup failure never blocks the search itself — the worst
 * case is simply no badge on this turn's cards.
 */
export async function deriveMatchedTags(
  prisma: TaxonomyLookupPrisma,
  cardIds: string[],
  args: TaxonomyFilterArgs
): Promise<Record<string, AiChatCardTag>> {
  const codes = codesByGroup(args);
  const candidateCodes = Array.from(new Set(MATCHED_TAG_GROUP_PRIORITY.flatMap((key) => codes[key])));

  const matchedTagByCampId: Record<string, AiChatCardTag> = {};
  if (candidateCodes.length === 0 || cardIds.length === 0) return matchedTagByCampId;

  try {
    const rows = await prisma.campSite.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        options: {
          where: { code: { in: candidateCodes } },
          select: { code: true, nameTh: true, nameEn: true },
        },
      },
    });

    for (const row of rows) {
      const presentCodes = new Set(row.options.map((o) => o.code));
      for (const key of MATCHED_TAG_GROUP_PRIORITY) {
        // Within a tier, preserve the CALLER'S own supplied order (e.g. the
        // model's own `["RIVE","BEAC"]` order) — never DB/return order.
        const winnerCode = codes[key].find((code) => presentCodes.has(code));
        if (!winnerCode) continue;
        const opt = row.options.find((o) => o.code === winnerCode);
        if (opt) matchedTagByCampId[row.id] = { nameTh: opt.nameTh, nameEn: opt.nameEn };
        break;
      }
    }
  } catch (error) {
    console.error('[CAM-564] matched-tag lookup failed (fail-open, no badge this turn)', error);
  }

  return matchedTagByCampId;
}

/** The one Prisma delegate `resolveTaxonomyLabels`/`buildTaxonomyEcho` need. */
export type MasterDataLookupPrisma = Pick<PrismaClient, 'masterData'>;

/**
 * CAM-709 BR-3 — resolves Thai labels for the taxonomy codes actually
 * supplied on THIS call, via ONE small batched `MasterData` read (never a
 * per-code loop). Reads `MasterData` directly rather than deriving from
 * `deriveMatchedTags`'s own per-card read: that read is scoped to `cardIds`
 * and short-circuits entirely on a zero-result search, or omits a code that
 * lost every card in an OR-array group, so it cannot be the source for an
 * echo that must stay truthful even on a zero-result search or for a losing
 * OR-array code that still genuinely constrained the query. Fail-open: a
 * lookup failure never blocks the search — the reason sentence simply omits
 * that taxonomy entry.
 */
export async function resolveTaxonomyLabels(
  prisma: MasterDataLookupPrisma,
  candidateCodes: string[]
): Promise<Record<string, string>> {
  if (candidateCodes.length === 0) return {};

  try {
    const rows = await prisma.masterData.findMany({
      where: { code: { in: candidateCodes } },
      select: { code: true, nameTh: true },
    });
    return Object.fromEntries(rows.map((row) => [row.code, row.nameTh]));
  } catch (error) {
    console.error('[CAM-709] taxonomy label lookup failed (fail-open, entries omitted this turn)', error);
    return {};
  }
}

/**
 * CAM-709 BR-3 — one taxonomy criterion inside an `appliedFilters` echo.
 * `group` names the tool's OWN argument dimension (the same
 * `MatchedTagGroupKey` set `MATCHED_TAG_GROUP_PRIORITY` uses), never the
 * DB's free-text `MasterData.group` column.
 */
export interface AppliedTaxonomyFilter {
  group: MatchedTagGroupKey;
  code: string;
  labelTh: string;
}

/**
 * CAM-709 BR-1/BR-2/CAM-716 BR-3 — builds the `taxonomy` array of an
 * `appliedFilters` echo from the SAME 7 args `deriveMatchedTags` reads, in
 * priority order — shared so `searchCampsites` and `bulkAvailability` echo
 * taxonomy filters identically.
 */
export async function buildTaxonomyEcho(
  prisma: MasterDataLookupPrisma,
  args: TaxonomyFilterArgs
): Promise<AppliedTaxonomyFilter[]> {
  const codes = codesByGroup(args);
  const candidateCodes = Array.from(new Set(MATCHED_TAG_GROUP_PRIORITY.flatMap((key) => codes[key])));
  const labelByCode = await resolveTaxonomyLabels(prisma, candidateCodes);

  const taxonomy: AppliedTaxonomyFilter[] = [];
  for (const group of MATCHED_TAG_GROUP_PRIORITY) {
    for (const code of codes[group]) {
      const labelTh = labelByCode[code];
      if (labelTh) taxonomy.push({ group, code, labelTh }); // omit on a missing label
    }
  }
  return taxonomy;
}
