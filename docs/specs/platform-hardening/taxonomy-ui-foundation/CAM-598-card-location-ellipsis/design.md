# CAM-598 — design notes

## Measured — before/after (real Chromium, dev server, guest chat mocked at the network boundary)

Worst-case real string (a live camp): `ในเมือง, เมืองนครราชสีมา, นครราชสีมา` (sub-district, district, province all repeat "เมือง").

| Component | Width | Before | After |
|---|---|---|---|
| `AiChatCampCard` (2-card carousel, `w-64`=256px card, ~206px available for text after icon+padding) | 320px | text=192px (fits, no clip needed), height=16px (1 line) | **unchanged** — already correct |
| `AiChatCampCard` | 390px | text=192px, height=16px (1 line) | **unchanged** — already correct |
| `AiChatCampCard`, amplified string (3x repeat, ~380px unclamped) | 390px | clips to 1 line, native `…`, height=16px | **unchanged** — already correct |
| `AiChatDetailCard` (location + terrain + access + distance) | 320px | 2 spans, `flex-wrap` row: **height=80px** (multiple visible lines) | 1 combined span, `line-clamp-1`, `flex-wrap` removed: **height=20px** (1 line), `scrollWidth`(250)≤`clientWidth`(250) |
| `AiChatDetailCard` | 390px | **height=80px** | **height=20px**, `scrollWidth`(320)=`clientWidth`(320) |

Screenshots confirming the visual ellipsis on the fixed `AiChatDetailCard` row are attached to the PR.

## Decision 1 — `AiChatCampCard.tsx` is UNCHANGED

The dispatch flagged a specific hazard: `line-clamp-1` sits on a flex-item span with no `min-w-0`, the textbook flexbox truncation trap (a flex item's automatic minimum width is its **min-content** size, which refuses to shrink below it, so the span can push the row wider instead of clipping).

Measured behaviourally at both 320px and 390px, with the real worst-case string AND a synthetic 3x-longer string: the span already clips correctly to one line with a native ellipsis, and adding `min-w-0` live (via `page.evaluate`) changed **nothing** (byte-identical width/height before and after). Root cause the trap doesn't fire here: Thai script has line-break opportunities almost everywhere (no long unbreakable "words" the way an English URL or CamelCase identifier has), so the browser's automatic min-content width for this text is already small — smaller than the available box — so the flex item never needs to shrink below its automatic minimum in the first place. The classic trap needs min-content > available width; that inequality doesn't hold for natural Thai place names at this card's width.

Per the ticket's own instruction ("if it already ellipses correctly, say so and leave it alone — do not 'fix' working code to match a theory"), `AiChatCampCard.tsx` is not touched by this story. The theory (the flex/min-width trap) was real and worth checking; the measurement said this specific component doesn't exhibit it.

## Decision 2 — `AiChatDetailCard.tsx`: truncate the WHOLE combined line as one unit

`AiChatDetailCard`'s row carries 4 logically distinct pieces: the location text (CAM-597), the terrain amenity, the access-type amenity (both CAM-450), and a distance-from-Bangkok figure — appended via a SECOND span with its own `· ` separator. Before this story the row was `flex flex-wrap`, so whichever pieces didn't fit wrapped onto their own new line(s) — confirmed 2-3 visible lines (height 40-80px) for the real worst-case camp.

Two options considered:
1. **Truncate only the location+terrain+access portion, always keep distance visible** — would need the distance span pinned `shrink-0` at the end and the location portion alone clamped. Rejected: produces an inconsistent read where an EARLIER part (say, access-type) can vanish mid-word with no ellipsis marker while a LATER part (distance) stays fully intact — confusing, and distance is the least decision-relevant of the four pieces on this row.
2. **Join all 4 pieces into one string, one `line-clamp-1` span** (chosen) — the whole row reads as a single "location line" to the camper (that's how the owner described it — "การ์ดแชท 3 ระดับ" — one line encompassing all the levels), and it reuses the exact same single-span/`line-clamp-1` treatment `AiChatCampCard` already uses for its own (shorter) location line, so the two assistant cards now truncate consistently. If the row overflows, the ellipsis lands wherever the combined text runs out — always at the true end of the row, never a jarring mid-row gap.

Implementation: `locationLineText = [...locationParts, distanceText].filter(Boolean).join(" · ")`, rendered in one `<span className="line-clamp-1 min-w-0">`; the parent `<p>` drops `flex-wrap` and gains `min-w-0` (belt-and-suspenders — per Decision 1's finding it may not be strictly load-bearing for Thai text, but it is definitionally correct for a flex item that must never determine its own minimum from content, and it's a 1-token no-risk addition once `flex-wrap` is gone). The `MapPin` icon keeps `shrink-0` (unchanged, always visible, per the dispatch note it was already correct).

## `location-text.ts` — not touched

It is a pure re-export (`export { buildLocationText } from "@/components/CampgroundCard"`) with zero truncation concern — truncation is a rendering/CSS decision that belongs at the component that lays the text into a box, not in the string-builder. Touching it here would mix concerns for no benefit.

## Out of scope, flagged not fixed

`components/CampgroundCard.tsx` (the Home catalog card) renders its own `locationText` in a plain `<p className="text-muted-foreground text-sm">` with no flex/icon pairing and no clamp at all today. It was explicitly out of bounds for this story (different component, different ticket). If it exhibits the same wrap-instead-of-ellipsis behavior, that is a separate, reportable finding — not fixed here.
