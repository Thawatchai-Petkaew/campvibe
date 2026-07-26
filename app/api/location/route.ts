import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { createLocationSchema } from '@/lib/validations/location';
import { matchAdminArea } from '@/lib/geo/admin-area-match';

/**
 * CAM-566 — this route used to carry its own standalone port of the
 * Thai/English administrative prefix/suffix strip + bilingual matcher
 * (CAM-563's tech.md documented it as a deliberate, faithful port of
 * CAM-554's algorithm, made because CAM-554's PR was unmerged at the time —
 * see `lib/geo/admin-area-match.ts`'s header + this story's tech.md for the
 * full diff). Both now call the ONE shared `matchAdminArea`.
 *
 * `district`/`subDistrict` are plain free-text `Input` fields on
 * `CampgroundForm.tsx` (unlike `province`, which is chosen from the
 * cascading `ThailandLocation`-backed select), so a host may type a prefix a
 * select would never produce — the shared matcher's normalization still
 * strips it before matching.
 */

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
                    const districtArea = await matchAdminArea(prisma, 'DISTRICT', district, provinceArea.id);
                    if (districtArea) {
                        adminAreaId = districtArea.id;
                        if (subDistrict) {
                            const subDistrictArea = await matchAdminArea(prisma, 'SUBDISTRICT', subDistrict, districtArea.id);
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
