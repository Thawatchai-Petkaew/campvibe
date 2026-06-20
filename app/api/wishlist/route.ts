import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { wishlistBodySchema } from '@/lib/validations/wishlist';
import type { WishlistWithCampSiteDTO } from '@/types/api';

// ─────────────────────────────────────────────────────────
// POST /api/wishlist
// Add a camp site to the authenticated user's wishlist.
// Idempotent: returns 201 whether the record is new or already existed.
// ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    // 1. Auth — userId always from session, never from body.
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        // 2. Input validation.
        const body = await request.json();
        const validation = wishlistBodySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation Error', details: validation.error.format() },
                { status: 400 },
            );
        }
        const { campSiteId } = validation.data;

        // 3. Verify camp site exists (404 if not).
        const campSite = await prisma.campSite.findUnique({
            where: { id: campSiteId },
            select: { id: true },
        });
        if (!campSite) {
            return NextResponse.json({ error: 'Camp site not found' }, { status: 404 });
        }

        // 4. Create wishlist entry.
        //    On unique-constraint violation (P2002 — already wishlisted) treat as success per decision 4.
        try {
            await prisma.wishlist.create({
                data: { userId, campSiteId },
            });
        } catch (createErr: unknown) {
            const prismaErr = createErr as { code?: string };
            if (prismaErr?.code !== 'P2002') {
                // Not a unique constraint error — rethrow so the outer catch handles it.
                throw createErr;
            }
            // Already wishlisted — transparent idempotent, fall through to 201.
        }

        return NextResponse.json({ campSiteId }, { status: 201 });
    } catch (error) {
        // Do not expose internals to the client (security requirement).
        console.error('[POST /api/wishlist]', error);
        return NextResponse.json({ error: 'Failed to save wishlist entry' }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────
// GET /api/wishlist
// Return all wishlisted camp sites for the authenticated user.
// Single query with include — no N+1.
// ─────────────────────────────────────────────────────────
export async function GET() {
    // 1. Auth.
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        // 2. Single query: wishlist rows + camp site summary fields.
        const rows = await prisma.wishlist.findMany({
            where: { userId },
            include: {
                campSite: {
                    select: {
                        id: true,
                        nameTh: true,
                        nameEn: true,
                        nameThSlug: true,
                        nameEnSlug: true,
                        images: true,
                        priceLow: true,
                        priceHigh: true,
                        isVerified: true,
                        isPublished: true,
                        latitude: true,
                        longitude: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // 3. Map to contract shape.
        const result: WishlistWithCampSiteDTO[] = rows.map((row) => ({
            id: row.id,
            campSiteId: row.campSiteId,
            createdAt: row.createdAt.toISOString(),
            campSite: {
                id: row.campSite.id,
                nameTh: row.campSite.nameTh,
                nameEn: row.campSite.nameEn,
                nameThSlug: row.campSite.nameThSlug,
                nameEnSlug: row.campSite.nameEnSlug,
                images: row.campSite.images,
                priceLow: row.campSite.priceLow,
                priceHigh: row.campSite.priceHigh,
                isVerified: row.campSite.isVerified,
                isPublished: row.campSite.isPublished,
                latitude: row.campSite.latitude,
                longitude: row.campSite.longitude,
            },
        }));

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('[GET /api/wishlist]', error);
        return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
    }
}
