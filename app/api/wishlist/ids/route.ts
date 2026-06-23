import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import type { WishlistIdsResponse } from '@/types/api';

// ─────────────────────────────────────────────────────────
// GET /api/wishlist/ids
// Return only the campSiteId list for the authenticated user's wishlist.
// Used by the frontend to determine which heart/save buttons are active
// without fetching full camp site data.
// ─────────────────────────────────────────────────────────
export async function GET() {
    // 1. Auth — userId always from session, never from query/body.
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        // 2. Minimal query — only campSiteId needed.
        const rows = await prisma.wishlist.findMany({
            where: { userId },
            select: { campSiteId: true },
        });

        const response: WishlistIdsResponse = {
            campSiteIds: rows.map((r) => r.campSiteId),
        };

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        console.error('[GET /api/wishlist/ids]', error);
        return NextResponse.json({ error: 'Failed to fetch wishlist IDs' }, { status: 500 });
    }
}
