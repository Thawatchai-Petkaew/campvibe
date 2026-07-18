/**
 * CAM-270 — registers every AI tool exactly once. BR-1: the registry
 * contains NO write tool; every entry here is read-only.
 *
 * Importing this module (side-effect import) is what populates
 * lib/ai/tool-registry.ts's registry — openrouter-client.ts imports it
 * before building the model's tool schema list.
 *
 * CAM-418 (ADR-013 §D5, S5a) adds the first two `authed`-tier tools
 * (getMyBookings, getMyBookingDetail) alongside the existing `guest`-tier pair.
 */
import { registerTool } from '@/lib/ai/tool-registry';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';
import { checkAvailabilityTool } from '@/lib/ai/tools/check-availability';
import { getMyBookingsTool, getMyBookingDetailTool } from '@/lib/ai/tools/my-bookings';

registerTool(searchCampsitesTool);
registerTool(checkAvailabilityTool);
registerTool(getMyBookingsTool);
registerTool(getMyBookingDetailTool);

export { searchCampsitesTool, checkAvailabilityTool, getMyBookingsTool, getMyBookingDetailTool };
