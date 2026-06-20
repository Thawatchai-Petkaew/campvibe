import { z } from 'zod';

/**
 * Schema for the POST /api/wishlist request body.
 * userId is intentionally excluded — it is derived from the authenticated session only.
 */
export const wishlistBodySchema = z.object({
    campSiteId: z.string().uuid(),
});

export type WishlistBody = z.infer<typeof wishlistBodySchema>;

/**
 * Schema for validating a campSiteId path parameter.
 * Used in DELETE /api/wishlist/[campSiteId].
 */
export const campSiteIdParamSchema = z.string().uuid();
