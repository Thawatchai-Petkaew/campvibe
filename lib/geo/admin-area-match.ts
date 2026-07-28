import type { PrismaClient } from '@prisma/client';

/**
 * lib/geo/admin-area-match.ts — CAM-566
 *
 * The ONE bilingual, hierarchical AdminArea matcher. Consolidated from THREE
 * near-identical ports that grew independently because of a sequencing gap:
 * CAM-554's reverse-geocode resolver (`app/api/geocode/_shared.ts`) sat in an
 * unmerged PR when CAM-563 needed the same algorithm for its backfill script
 * AND its location-write path, so Backend ported it standalone twice,
 * flagging the duplication both times (see CAM-563 tech.md's "Seams — CAM-554
 * coordination" section). All three landed on `dev` before this story could
 * run. The enumerated diff between the three prior copies — and how each
 * behaviour is preserved here — is in
 * `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-566-shared-matcher/tech.md`.
 *
 * Runtime-agnostic by design: every function takes its Prisma client as an
 * explicit first parameter — never a module-level `@/lib/prisma` import —
 * because one caller, `scripts/backfill-cam-563-location-admin-area.mjs`, is
 * a standalone plain-Node `.mjs` script. Node's native TypeScript type-
 * stripping (which lets a `.mjs` script import this `.ts` file directly, no
 * bundler) resolves relative paths but NOT the `@/*` tsconfig path alias, so
 * a module-scope `@/lib/prisma` import here would break that one caller.
 * Dependency injection is also what already lets both the backfill script's
 * own tests AND CAM-563's route test inject a fake/mocked client.
 */

export type AdminAreaLevel = 'PROVINCE' | 'DISTRICT' | 'SUBDISTRICT';

export interface AdminAreaNode {
    id: string;
    code: string;
    nameTh: string;
    nameEn: string;
    parentId: string | null;
}

/** The one Prisma delegate this module needs — real `PrismaClient` or a test double satisfy this structurally. */
export type AdminAreaMatchPrisma = Pick<PrismaClient, 'adminArea'>;

// Known Thai/English administrative prefixes/suffixes Google's Geocoding API
// (CAM-554) and hosts' own free-text district/sub-district fields (CAM-563)
// both produce (e.g. "จังหวัดเชียงใหม่", "Amphoe Mueang Chiang Mai") - stripped
// before matching against AdminArea's bare `nameTh`/`nameEn` columns.
// Longest/most-specific entries first so a shared substring (e.g. "อำเภอ"
// inside "กิ่งอำเภอ") never partially matches.
const THAI_PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];
const EN_PREFIXES = ['Changwat ', 'Chang Wat ', 'Amphoe ', 'Amphur ', 'Khet ', 'Tambon ', 'Khwaeng ', 'District ', 'Province of '];
const EN_SUFFIXES = [' Province', ' District'];

/**
 * Deterministic prefix/suffix strip, never a substring match (CAM-501/503's
 * Thai-substring collision lesson). Null/undefined-safe — CAM-563's backfill
 * script's stricter guard (its real input is a stored `Location.district`/
 * `subDistrict` column that can genuinely be `null`), preserved here as the
 * union: CAM-554's/CAM-563 route's callers only ever passed a
 * guaranteed-truthy string, so widening the accepted type is backward
 * compatible for them.
 */
export function normalizeAdminName(raw: string | null | undefined): string {
    let name = (raw ?? '').trim();
    if (!name) return name;
    for (const prefix of THAI_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const prefix of EN_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const suffix of EN_SUFFIXES) {
        if (name.endsWith(suffix)) { name = name.slice(0, -suffix.length); break; }
    }
    return name.trim();
}

/**
 * Bilingual, hierarchical match against the AdminArea tree - exact equality
 * only (never `contains`, CAM-501/503's Thai-substring lesson), scoped by
 * `parentId` when given so a same-named district/sub-district under a
 * different parent can never match. Normalizes the raw name INTERNALLY and
 * short-circuits (no DB round-trip) when the normalized name is empty -
 * CAM-563's backfill/route ports' defensive behaviour, preserved as a
 * strictly-more-efficient no-op for CAM-554's geocode caller too (both
 * outcomes are `null` either way, so this changes no observable behaviour).
 * Returns the FULL node (`id`/`code`/`nameTh`/`nameEn`/`parentId`) - a
 * superset of what CAM-563's two ports needed (they read only `.id`) and
 * exactly what CAM-554's resolver needs (`.code` to derive the matching
 * `ThailandLocation` row, the full shape for its `subDistrict` response
 * field).
 */
export async function matchAdminArea(
    prisma: AdminAreaMatchPrisma,
    level: AdminAreaLevel,
    rawName: string | null | undefined,
    parentId?: string
): Promise<AdminAreaNode | null> {
    const name = normalizeAdminName(rawName);
    if (!name) return null;

    return prisma.adminArea.findFirst({
        where: {
            countryCode: 'TH',
            level,
            ...(parentId ? { parentId } : {}),
            OR: [
                { nameTh: { equals: name, mode: 'insensitive' } },
                { nameEn: { equals: name, mode: 'insensitive' } },
            ],
        },
        select: { id: true, code: true, nameTh: true, nameEn: true, parentId: true },
    });
}

/** The one Prisma delegate `listChildAdminAreaIds` needs — a structural subset of `AdminAreaMatchPrisma` (`findMany` only, no `findFirst`), so a caller that only ever lists children can satisfy this with a narrower test double. */
export type AdminAreaListPrisma = Pick<PrismaClient, 'adminArea'>;

/**
 * CAM-587 — every immediate child id of `parentId` at the given `level`
 * (e.g. every SUBDISTRICT beneath one DISTRICT, or every DISTRICT beneath one
 * PROVINCE). Extracted here (not duplicated per caller) because it is the
 * SAME "one level down" primitive `resolveProvinceAdminAreaIds`
 * (`lib/campsite-filters.ts`, CAM-563) already hand-rolls twice inline for
 * its own province->district->subDistrict subtree walk — CAM-587 needs the
 * identical primitive for a DISTRICT's own subtree (district ->
 * subDistrict), so it is composed from this shared function rather than a
 * third hand-rolled copy (the exact drift `matchAdminArea`'s own docblock
 * warns about). Never throws; an unknown/childless `parentId` simply
 * resolves to `[]` (a real Prisma `findMany` naturally returns no rows).
 */
export async function listChildAdminAreaIds(
    prisma: AdminAreaListPrisma,
    level: AdminAreaLevel,
    parentId: string
): Promise<string[]> {
    if (!parentId) return [];
    const rows = await prisma.adminArea.findMany({
        where: { countryCode: 'TH', level, parentId },
        select: { id: true },
    });
    return rows.map((r) => r.id);
}
