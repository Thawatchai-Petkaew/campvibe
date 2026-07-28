---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — the assistant's cards render location in the camper's own language (CAM-597)

## Ground-truth research (before writing any code)

`grep -rn "location" lib/read-models/ai-camp-card.ts` + reading `lib/read-models/camp-card.ts` end to end showed the fix was smaller than the ticket assumed: `aiCampCardSelect` (`lib/read-models/ai-camp-card.ts`) is `{ ...campCardSelect, options: {...} }` — a literal spread of `campCardSelect`, whose `location` select ALREADY includes `adminArea: { select: adminAreaChainSelect }` (added by CAM-573). So every AI tool that builds a card via `aiCampCardSelect`/`toAiCampCard` (`search-campsites.ts`, `check-availability.ts`, `bulk-availability.ts`) was **already fetching** the id-derived AdminArea chain from Postgres on every query — `toAiCampCard` (the mapper) simply discarded it, re-narrowing `location` down to `{ province: string }` before the row ever reached the wire. The defect was 100% in the MAPPING layer, not the query layer.

Confirmed with a source-diff assertion (kept as a permanent structural guard, `__tests__/cam-597-ai-camp-card-location.test.ts`): `aiCampCardSelect.location` is reference-equal (`toBe`) to `campCardSelect.location` — the exact same object, never a re-declared copy that could drift.

**Consequence for the dispatch's allowed file surface:** `search-campsites.ts`, `check-availability.ts`, `bulk-availability.ts` needed **zero** Prisma `select` edits (verified — see the reader/writer table below); only `ai-camp-card.ts`'s mapper needed to change. `get-camp-detail.ts` is a genuinely separate tool with its own narrow, hand-written `location: { select: { province: true, region: true } }` — see "get-camp-detail.ts — a deliberate non-change" below for why it was left untouched too.

## Reader/writer inventory (architecture.md §15b)

**Search method:** `grep -n "location" lib/read-models/ai-camp-card.ts lib/read-models/camp-card.ts` + `grep -rn "aiCampCardSelect\|campCardSelect\|toAiCampCard\|AiCampCard\b" lib/ai/tools/*.ts` + `grep -rn "\.location" components/ai-chat/*.tsx` (every render site) + `grep -rn "GetCampDetailResult" lib components app` (every consumer of the OTHER tool's location field) + reading CAM-573/CAM-545's own tech.md (naming `ai-camp-card.ts` as "VERIFIED, NO-CHANGE NEEDED" at the time, for a different reason — structural immunity via `Omit<...,'location'>` — this story is the one that finally changes what that re-added `location` shape carries).

| Reader/writer | Touches location how | Action this story | Why |
|---|---|---|---|
| `lib/read-models/ai-camp-card.ts` `toAiCampCard` | re-narrowed `location` to `{province:string}`, discarding the already-fetched `adminArea` | **NOW** — attaches `resolveLocationDisplayNames(row.location?.adminArea)` (CAM-573, imported unchanged) alongside the raw `province`/`district` | the root cause; the ONE place this story actually needed to change |
| `lib/ai/tools/search-campsites.ts` | `select: aiCampCardSelect` (spreads `campCardSelect`) | **VERIFIED, NO-CHANGE NEEDED** | already fetches `adminArea`; the mapper change above is enough |
| `lib/ai/tools/check-availability.ts` | same `select: aiCampCardSelect` | **VERIFIED, NO-CHANGE NEEDED** | same reason |
| `lib/ai/tools/bulk-availability.ts` | same `select: aiCampCardSelect` | **VERIFIED, NO-CHANGE NEEDED** | same reason |
| `lib/ai/tools/get-camp-detail.ts` | its OWN separate, hand-written `location: { select: { province: true, region: true } }` — never `aiCampCardSelect` | **NOT TOUCHED** | its `location` field is not rendered anywhere (see "get-camp-detail.ts — a deliberate non-change" below) |
| `lib/api-client.ts` `AiChatCardResponse.location` / `isAiChatCardResponse` | wire type + shape validator, `province`-only | **NOW** — widened additively (api.md rule 12) to `AiChatCardLocation`; validator extended for each new optional field | the wire contract must carry what `toAiCampCard` now attaches, or it's dropped before the client ever sees it |
| `components/ai-chat/AiChatCampCard.tsx` | rendered raw `card.location.province` | **NOW** — renders `buildLocationText(card.location, language)` | AC-1/AC-2, the result-card half of the defect |
| `components/ai-chat/AiChatDetailCard.tsx` | rendered raw `card.location.province` (from the SAME instant `card` prop, never `detail.location`) | **NOW** — same `buildLocationText(card.location, language)` swap | AC-3, the detail-card half |
| `components/CampgroundCard.tsx` `buildLocationText` | canonical renderer (CAM-545/CAM-573) | **VERIFIED, NO-CHANGE NEEDED (zero edits)** | already exported; reused via a new re-export, see "Payload shape decision" |
| `lib/read-models/camp-card.ts` `resolveLocationDisplayNames` | canonical chain-walk (CAM-573) | **VERIFIED, NO-CHANGE NEEDED (zero edits)** | imported as-is into `ai-camp-card.ts` |
| `lib/campsite-filters.ts` | province exact-match filter | **NOT TOUCHED (out of bounds)** | `Location.province` storage/shape is completely unchanged — see "Chiang Mai canary" below |
| `lib/ai/place-resolver.ts` | which camps a search matches | **NOT TOUCHED (out of bounds)** | this story changes only how a RETURNED camp's location is displayed |

## get-camp-detail.ts — a deliberate non-change

`GetCampDetailResult.location` (`{province, region}`) is fetched by `executeGetCampDetail` and threaded through `isCampDetailLocation`/`isGetCampDetailOk` in `lib/api-client.ts`, but **`AiChatDetailCard.tsx` never reads `detail.location` anywhere** — its hero location line reads `card.location` (the instant `AiChatCardResponse` the camper already saw on the result card), by explicit design ("Data model" doc comment, unchanged by this story: location is part of the INSTANT paint, never gated on the async fetch). Confirmed by grep (`grep -n "\.location" components/ai-chat/AiChatDetailCard.tsx`) both before and after this story's edits — the only occurrences are `card.location.province` (twice) and this story's own doc-comment prose explaining why `detail.location` is never touched. A regression guard pins this (`__tests__/cam-597-ai-chat-card-location.test.ts`, "the hero location still reads from the instant `card` prop").

Consequence: `get-camp-detail.ts`'s own `location` select (`province`/`region` only, no `adminArea`) was left completely untouched — extending it would have added dead, unrendered data. If a future story wires `detail.location` into the UI (e.g. an enrichment once the async fetch resolves), that story should extend `get-camp-detail.ts`'s select the SAME way this one extended `ai-camp-card.ts` — reuse `resolveLocationDisplayNames`, never a third implementation.

## Payload shape decision — structured parts, not a pre-rendered string

**Decision:** `AiChatCardResponse.location` carries the STRUCTURED bilingual parts (`provinceTh`/`provinceEn`/`districtTh`/`districtEn`/`subDistrictTh`/`subDistrictEn`, all optional, plus the unchanged raw `province`/`district`) — the SAME shape `CampgroundCardData['location']` (the catalog card) already carries. The client renders it via `buildLocationText(location, language)` at render time, picking the language from `useLanguage()`'s live `language` value.

**Alternative considered and rejected:** have the server pre-render a single string field (e.g. `locationText: string`) in whichever language the request was made in.

**Why rejected — verified behaviorally, not assumed:** `AiChatCampCard`/`AiChatDetailCard` receive `card` as a plain prop; the SAME card object stays in React state for the lifetime of the conversation turn (`AiChatMessageList` → `AiChatPanel`'s `selectedCamp`) — there is no re-fetch when the camper flips the language toggle (`useLanguage()`'s `language` is read fresh on every render from `LanguageContext`, but the CARD DATA itself is not re-requested). Traced the actual call path: `aiChatAPI.send`/`aiChatAPI.getCampDetail` are only invoked on a NEW question or opening a detail card — never on a language-context change. A pre-rendered string field would therefore go stale the instant a camper switched language mid-session (exactly the failure mode CAM-548/CAM-573 fixed for the catalog/detail pages, which face the identical constraint and already chose the structured-parts shape) — the camper would see the OLD language's district/province until they re-asked a new question. The structured-parts shape has no such window: `buildLocationText` re-runs on every render with whatever `language` is current, proven directly in this story's own tests (`__tests__/cam-597-ai-camp-card-location.test.ts`, "the SAME card renders district + province in English when the language switches — no re-fetch, no stale text": one `toAiCampCard()` output fed into `buildLocationText` twice, once per language, asserting the SAME payload produces two different, correct strings).

This also keeps `lib/read-models/ai-camp-card.ts` consistent with the EXACT precedent `lib/read-models/camp-card.ts` already set for the catalog card (CAM-545/CAM-573) — one shape, one rendering function, reused everywhere a camp card's location needs to show.

## Reuse mechanism — components/ai-chat/location-text.ts

`buildLocationText` (`components/CampgroundCard.tsx`) is the ONE existing implementation this story must reuse (per the ticket, and per the CAM-566 "don't write a second implementation" lesson). `AiChatCampCard.tsx` carries a CAM-428 regression pin (`__tests__/cam-428-framed-chat-card.test.ts`: `expect(cardSrc).not.toMatch(/CampgroundCard/)`) — a deliberate BR-4 exception decoupling the chat surface from the catalog card component's own `<Link>`-based navigation — so a direct `import { buildLocationText } from "@/components/CampgroundCard"` in that file would trip an existing, out-of-this-story's-surface test.

Resolution: a new, tiny re-export file, `components/ai-chat/location-text.ts` — `export { buildLocationText } from "@/components/CampgroundCard";` — with no logic of its own. Both `AiChatCampCard.tsx` and `AiChatDetailCard.tsx` import from this one path (kept symmetric between the two sibling chat surfaces, even though only `AiChatCampCard.tsx` is pin-constrained). `components/CampgroundCard.tsx` itself is **untouched** (0 lines changed) — deliberately, since its `buildLocationText` function body is the literal target of an unrelated, out-of-this-story's-surface regression pin (`__tests__/cam-192-list-buffet.test.ts`: `expect(cardSrc).toContain('location.province')`, which greps the FUNCTION BODY's own `location.province` reads) that a "move the implementation to lib/" refactor would have broken. Re-exporting from the existing home avoids touching that file at all, while still satisfying "reuse, don't duplicate" — there is exactly one `buildLocationText` function body in the whole repo, unmoved.

## API contract (wire shape)

`AiChatCardResponse.location` (`lib/api-client.ts`) widens additively (api.md rule 12):

```ts
export interface AiChatCardLocation {
  province: string;            // unchanged, required — Location.province, raw English
  provinceTh?: string;
  provinceEn?: string;
  district?: string | null;    // unchanged, now also read (was selected but discarded before)
  districtTh?: string;
  districtEn?: string;
  subDistrictTh?: string;
  subDistrictEn?: string;
}
```

`isAiChatCardResponse` validates each new field as "absent or well-formed" (same convention as the existing `options`/`hasReviews`/`remaining`/`matchedTag` additive fields) — an older/unaware wire body (a persisted conversation's `cards` block written before this story) still validates and renders (province-only, the pre-existing behavior). No new endpoint, no new error code — this is a response-shape widening only.

## HARD CONSTRAINT verified — Chiang Mai canary, before AND after

`Location.province` storage and `lib/campsite-filters.ts`'s exact-string-equality filter were never touched by this story (confirmed: `git diff` against this story's file surface touches zero files under `lib/campsite-filters.ts`, `lib/ai/place-resolver.ts`, or `prisma/`).

| When | Command | Result |
|---|---|---|
| Before this story's code changes | `node --env-file=.env node_modules/.bin/vitest run __tests__/cam-580-chiang-mai-canary.test.ts` | 7/7 pass — DB layer `campSite.count({location:{province:'Chiang Mai'}})` = **18** |
| After this story's code changes | same command, re-run | 7/7 pass — same **18**, unchanged |

Also re-verified end to end against the REAL dev DB (not a fixture): ran `toAiCampCard` + `buildLocationText` against a real published camp whose `adminArea` resolves to SUBDISTRICT depth (Buri Ram) — Thai session: `"พระครู, เมืองบุรีรัมย์, บุรีรัมย์"`; English session (SAME card, SAME payload, only `language` flipped): `"Phra Khru, Mueang Buri Ram, Buri Ram"`. No re-fetch between the two renders.

## ADRs

No new ADR — this story reuses CAM-545/CAM-573's already-accepted rendering pattern (structured bilingual parts + client-side `buildLocationText`) on a new surface; no new architectural pattern introduced.

## Links

`lib/read-models/ai-camp-card.ts` · `lib/read-models/camp-card.ts` (CAM-573, unchanged) · `components/CampgroundCard.tsx` (CAM-545, unchanged) · `components/ai-chat/location-text.ts` (new) · `lib/api-client.ts` · CAM-545 tech.md · CAM-573 tech.md · CAM-427 (the read-model this story extends) · story.md

## Changelog
- v1 (2026-07-28) — created
