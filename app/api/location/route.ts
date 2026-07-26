import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { createLocationSchema } from '@/lib/validations/location';

/**
 * CAM-563 — same Thai/English administrative prefixes/suffixes stripped by
 * the CAM-563 backfill script (`scripts/backfill-cam-563-location-admin-area
 * .mjs::normalizeAdminAreaName`) and CAM-554's geocode resolver — ported
 * here (not imported: this route is TS/Next, the backfill is a standalone
 * `.mjs`, see tech.md's Seams section) because `district`/`subDistrict` are
 * plain free-text `Input` fields on `CampgroundForm.tsx` (unlike `province`,
 * which is chosen from the cascading `ThailandLocation`-backed select), so a
 * host may type a prefix a select would never produce.
 */
const THAI_ADMIN_PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];
const EN_ADMIN_PREFIXES = ['Changwat ', 'Chang Wat ', 'Amphoe ', 'Amphur ', 'Khet ', 'Tambon ', 'Khwaeng ', 'District ', 'Province of '];
const EN_ADMIN_SUFFIXES = [' Province', ' District'];

function normalizeAdminAreaName(raw: string): string {
    let name = raw.trim();
    for (const prefix of THAI_ADMIN_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const prefix of EN_ADMIN_PREFIXES) {
        if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
    }
    for (const suffix of EN_ADMIN_SUFFIXES) {
        if (name.endsWith(suffix)) { name = name.slice(0, -suffix.length); break; }
    }
    return name.trim();
}

/**
 * CAM-563 — bilingual, hierarchical, exact-match lookup (never `contains` —
 * the DEF-1/DEF-2 Thai-substring collision lesson, `.claude/rules/code.md`)
 * scoped to `parentId` so a same-named district in a different province can
 * never match.
 */
async function matchAdminAreaByName(
    level: 'DISTRICT' | 'SUBDISTRICT',
    rawName: string,
    parentId: string
): Promise<{ id: string } | null> {
    const name = normalizeAdminAreaName(rawName);
    if (!name) return null;
    return prisma.adminArea.findFirst({
        where: {
            countryCode: 'TH',
            level,
            parentId,
            OR: [
                { nameTh: { equals: name, mode: 'insensitive' } },
                { nameEn: { equals: name, mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    });
}

export async function POST(request: NextRequest) {
    // RISK-6: Location creation requires authentication.
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    // 1. Validate at the boundary before any DB work.
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const parsed = createLocationSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const { lat, lon, country, province, district, subDistrict, region, thaiLocationId } = parsed.data;

    try {
        // S5: populate the conformant Country + AdminArea links so live-created camps (not just
        // seeded ones) get a region linkage. Only set countryCode if the Country actually exists
        // (FK-safe); resolve the province AdminArea from the legacy thaiLocationId.
        const wantCountry = (!country || country === 'Thailand') ? 'TH' : country;
        const knownCountry = await prisma.country.findUnique({ where: { code: wantCountry }, select: { code: true } });
        let adminAreaId: string | undefined;
        if (thaiLocationId) {
            const tl = await prisma.thailandLocation.findUnique({ where: { id: thaiLocationId }, select: { provinceCode: true } });
            if (tl) {
                const provinceArea = await prisma.adminArea.findUnique({
                    where: { countryCode_level_code: { countryCode: 'TH', level: 'PROVINCE', code: tl.provinceCode } },
                    select: { id: true },
                });
                adminAreaId = provinceArea?.id;

                // CAM-563 — walk deeper than PROVINCE when the host also typed a
                // district/sub-district (CAM-553/CAM-559's free-text fields):
                // `adminAreaId` becomes the DEEPEST level actually resolved
                // (subDistrict ?? district ?? province), the SAME convention
                // the CAM-563 backfill script + CAM-554's geocode resolver use.
                // A level with no raw value, or no match, stops the walk here —
                // never guesses the next level from an unmatched parent, and
                // never regresses `adminAreaId` below the province match above.
                if (provinceArea && district) {
                    const districtArea = await matchAdminAreaByName('DISTRICT', district, provinceArea.id);
                    if (districtArea) {
                        adminAreaId = districtArea.id;
                        if (subDistrict) {
                            const subDistrictArea = await matchAdminAreaByName('SUBDISTRICT', subDistrict, districtArea.id);
                            if (subDistrictArea) adminAreaId = subDistrictArea.id;
                        }
                    }
                }
            }
        }

        const location = await prisma.location.create({
            data: {
                country: country || 'Thailand',
                province,
                // CAM-553: persist the district the host typed/selected — was
                // silently dropped before (BR-1: the "form collects, API
                // ignores" defect CAM-551 found).
                district,
                // CAM-559: sub-district, wired through the SAME seam CAM-553
                // built for district — the cascading picker's third level.
                subDistrict,
                region: region || 'North',
                lat,
                lon,
                thaiLocationId,
                countryCode: knownCountry?.code,
                adminAreaId,
            }
        });

        return NextResponse.json(location, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }
}
