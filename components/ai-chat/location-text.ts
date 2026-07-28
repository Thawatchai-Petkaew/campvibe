/**
 * components/ai-chat/location-text.ts — CAM-597.
 *
 * Re-exports `buildLocationText` (components/CampgroundCard.tsx, CAM-545/
 * CAM-573's canonical "sub-district, district, province" renderer, in the
 * camper's active language, never the country) under a path that carries no
 * "CampgroundCard" substring. `AiChatCampCard.tsx` is regression-pinned
 * (CAM-428, BR-4 exception) to import NOTHING from the catalog card
 * component — the chat surface is deliberately decoupled from that
 * component's own `<Link>`-based navigation — so a direct import there would
 * trip that guard. This file changes nothing about the function itself:
 * ONE implementation, reused by both AI-chat surfaces that need the same
 * localized location text the catalog card already shows
 * (`AiChatCampCard.tsx`, `AiChatDetailCard.tsx`) — never a second copy of
 * the district/sub-district-prefixing logic (the CAM-566 lesson).
 */
export { buildLocationText } from "@/components/CampgroundCard";
