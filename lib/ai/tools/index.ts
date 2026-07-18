/**
 * CAM-270 — registers every AI tool exactly once. BR-1: the registry
 * contains NO write tool; both entries here are read-only.
 *
 * Importing this module (side-effect import) is what populates
 * lib/ai/tool-registry.ts's registry — openrouter-client.ts imports it
 * before building the model's tool schema list.
 */
import { registerTool } from '@/lib/ai/tool-registry';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';
import { checkAvailabilityTool } from '@/lib/ai/tools/check-availability';

registerTool(searchCampsitesTool);
registerTool(checkAvailabilityTool);

export { searchCampsitesTool, checkAvailabilityTool };
