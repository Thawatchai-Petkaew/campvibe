/**
 * CAM-270 — registers every AI tool exactly once. BR-1: the registry
 * contains NO write tool; every entry here is read-only.
 *
 * Importing this module (side-effect import) is what populates
 * lib/ai/tool-registry.ts's registry — openrouter-client.ts imports it
 * before building the model's tool schema list.
 *
 * CAM-419 (ADR-013 D5) — adds the first two `authed`-tier personal tools,
 * `getMyProfile` and `getMyWishlist`; the two existing tools stay `guest`.
 */
import { registerTool } from '@/lib/ai/tool-registry';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';
import { checkAvailabilityTool } from '@/lib/ai/tools/check-availability';
import { getMyProfileTool, getMyWishlistTool } from '@/lib/ai/tools/my-profile-wishlist';

registerTool(searchCampsitesTool);
registerTool(checkAvailabilityTool);
registerTool(getMyProfileTool);
registerTool(getMyWishlistTool);

export { searchCampsitesTool, checkAvailabilityTool, getMyProfileTool, getMyWishlistTool };
