import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { zoneCreateSchema, ZONE_DUPLICATE_MESSAGE } from '@/lib/validations/zone';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';
import { campTag, campSlugTag } from '@/lib/catalog-cache';

/**
 * CAM-362 — per-camp reusable Zone entity (tech.md §3.1/§3.2).
 *
 * GET is intentionally NOT gated by requireCampSitePermission — it mirrors
 * the spots GET visibility gate (public camp -> anyone; non-public -> only a
 * viewer, else 404 not 403 to avoid information-disclosure). Zones are
 * non-sensitive host-config labels the CAM-361 public grouping will consume.
 *
 * POST requires CAMPSITE_UPDATE (creating a zone edits camp composition,
 * mirrors spot POST).
 */

const zoneSelect = {
  id: true,
  campSiteId: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ZoneSelect;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const campSite = await prisma.campSite.findUnique({
      where: { id },
      select: { isActive: true, isPublished: true, deletedAt: true, operatorId: true },
    });

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    if (!isCampSitePublic(campSite)) {
      const session = await auth();
      if (!canViewCampSite(campSite, session)) {
        // 404 not 403 — no information-disclosure.
        return apiError('Camp site not found', 404);
      }
    }

    // Live zones only, single indexed query (@@index([campSiteId, deletedAt])) — no N+1.
    const zones = await prisma.zone.findMany({
      where: { campSiteId: id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: zoneSelect,
    });

    return apiSuccess(zones);
  } catch (error) {
    return apiError('Failed to fetch zones', 500, error);
  }
}

// Distinguishes the "friendly pre-check" duplicate from a generic transaction
// failure so the catch block can map it to 409 without re-inspecting Prisma
// error internals.
class DuplicateZoneNameError extends Error {}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Creating a zone edits camp composition — CAMPSITE_UPDATE (mirrors spot POST).
  const { error: authError, campSite } = await requireCampSitePermission(id, 'CAMPSITE_UPDATE');
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = zoneCreateSchema.safeParse(body);
    if (!validation.success) {
      const firstMessage = validation.error.issues[0]?.message ?? 'Validation Error';
      return apiError(firstMessage, 400, validation.error.format());
    }

    const { name } = validation.data;

    const zone = await prisma.$transaction(async (tx) => {
      // Friendly pre-check (BR, tech.md §3.2): case-insensitive, live-rows-only.
      // A soft-deleted name is NOT a duplicate — the partial unique index
      // (migration SQL) excludes tombstones, so this mirrors that semantics.
      const existing = await tx.zone.findFirst({
        where: { campSiteId: id, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        throw new DuplicateZoneNameError();
      }

      // sortOrder is server-assigned in round 1 (no client input) — append
      // to the end of the live list.
      const liveCount = await tx.zone.count({ where: { campSiteId: id, deletedAt: null } });

      return tx.zone.create({
        data: { campSiteId: id, name, sortOrder: liveCount },
        select: zoneSelect,
      });
    });

    // Bust the cached camp-detail read so a new zone surfaces without
    // waiting on the TTL (mirrors spot POST, CAM-353 BR-8).
    revalidateTag(campTag(id), {});
    if (campSite) {
      revalidateTag(campSlugTag(campSite.nameThSlug), {});
      revalidateTag(campSlugTag(campSite.nameEnSlug), {});
    }

    return apiSuccess(zone, 201);
  } catch (error) {
    if (error instanceof DuplicateZoneNameError) {
      return apiError(ZONE_DUPLICATE_MESSAGE, 409);
    }
    // Race backstop: the partial unique index (migration SQL, tech.md §2.1)
    // rejects a concurrent duplicate insert with P2002 even when the
    // pre-check above raced and missed it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return apiError(ZONE_DUPLICATE_MESSAGE, 409);
    }
    return apiError('Failed to create zone', 500, error);
  }
}
