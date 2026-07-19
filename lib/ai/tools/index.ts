/**
 * CAM-270 — registers every AI tool exactly once. BR-1: the registry
 * contains NO write tool; every entry here is read-only.
 *
 * Importing this module (side-effect import) is what populates
 * lib/ai/tool-registry.ts's registry — openrouter-client.ts imports it
 * before building the model's tool schema list.
 *
 * CAM-418 (ADR-013 §D5, S5a) adds the first two `authed`-tier booking tools
 * (getMyBookings, getMyBookingDetail); CAM-419 (S5b) adds the other two
 * personal tools (getMyProfile, getMyWishlist) alongside them. The two
 * original tools (searchCampsites, checkAvailability) stay `guest`.
 */
import { registerTool } from '@/lib/ai/tool-registry';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';
import { checkAvailabilityTool } from '@/lib/ai/tools/check-availability';
import { getMyBookingsTool, getMyBookingDetailTool } from '@/lib/ai/tools/my-bookings';
import { getMyProfileTool, getMyWishlistTool } from '@/lib/ai/tools/my-profile-wishlist';
import { getCampDetailTool } from '@/lib/ai/tools/get-camp-detail';

registerTool(searchCampsitesTool);
registerTool(checkAvailabilityTool);
registerTool(getMyBookingsTool);
registerTool(getMyBookingDetailTool);
registerTool(getMyProfileTool);
registerTool(getMyWishlistTool);
// CAM-427 — the assistant's floating detail card: amenities + verified reviews + upcoming weekend dates.
registerTool(getCampDetailTool);

export {
  searchCampsitesTool,
  checkAvailabilityTool,
  getMyBookingsTool,
  getMyBookingDetailTool,
  getMyProfileTool,
  getMyWishlistTool,
  getCampDetailTool,
};
