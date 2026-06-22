import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { campSiteIdParamSchema } from '@/lib/validations/wishlist';
import { checkRateLimit } from '@/lib/rate-limit';

// ─────────────────────────────────────────────────────────
// DELETE /api/wishlist/[campSiteId]
// Remove a camp site from the authenticated user's wishlist.
// Idempotent: returns 200 whether the record existed or not.
// Ownership is enforced by binding the delete to session userId —
// a user can only delete their own wishlist entries.
// ─────────────────────────────────────────────────────────
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ campSiteId: string }> },
) {
    // 1. Auth — userId always from session, never from params/body.
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Rate-limit — 100 write requests per 15 min per user (in-memory, per-instance baseline).
    const rl = checkRateLimit(`wishlist:write:${userId}`);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
            {
                status: 429,
                headers: { 'Retry-After': String(rl.retryAfterSec) },
            },
        );
    }

    // 3. Validate path param is a valid UUID.
    const { campSiteId } = await params;
    const paramValidation = campSiteIdParamSchema.safeParse(campSiteId);
    if (!paramValidation.success) {
        return NextResponse.json({ error: 'Invalid campSiteId — must be a UUID' }, { status: 400 });
    }

    try {
        // 4. Delete scoped to session userId — ownership enforced by construction.
        //    deleteMany is used so it is idempotent (no error if record does not exist).
        await prisma.wishlist.deleteMany({
            where: { userId, campSiteId: paramValidation.data },
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('[DELETE /api/wishlist/[campSiteId]]', error);
        return NextResponse.json({ error: 'Failed to remove wishlist entry' }, { status: 500 });
    }
}
