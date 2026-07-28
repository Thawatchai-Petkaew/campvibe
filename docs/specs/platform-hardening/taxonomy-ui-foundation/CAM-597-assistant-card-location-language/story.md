## Story
As a **Camper**, I want the น้องกองไฟ assistant's result and detail cards to show a camp's district and province in the language I'm reading, so that a reply I asked for in Thai does not hand me back an English place name I have to translate myself.
Why: owner saw "Nakhon Ratchasima" (English) inside a Thai-language assistant reply on 2026-07-28, the same screenshot that surfaced CAM-596. This is CAM-545/CAM-573's exact defect (province rendered from raw storage, not the active language), on the ONE surface those stories never migrated — the assistant's own cards.
Scope: render the assistant's card location as district + province, in the active language, no country — reusing `buildLocationText` (CAM-545) and the id-derived bilingual chain `resolveLocationDisplayNames` (CAM-573), never a second implementation. Covers both AI-chat surfaces: the result card (`AiChatCampCard`) and the detail card (`AiChatDetailCard`). Threads the district data through the wire payload (`AiChatCardResponse.location`) that was carrying `province` alone.
Depends on: CAM-545 (`buildLocationText`), CAM-573 (`resolveLocationDisplayNames`, the id-derived AdminArea chain already selected by `campCardSelect`), CAM-427 (`aiCampCardSelect`/`toAiCampCard`, the AI card read-model this story extends).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is in a Thai-language session and asks น้องกองไฟ for camps | The assistant returns result cards | Each card's location line reads district + province in Thai (e.g. `เมืองนครราชสีมา, นครราชสีมา`), never an English name, never the country | `AiChatCampCard` renders `buildLocationText(card.location, 'th')`, reading the id-derived `districtTh`/`provinceTh` the wire payload now carries | EC-1 |
| AC-2 | The same session, camper switches the interface to English | The camper re-opens or re-asks (cards re-render) | The SAME cards now read district + province in English (e.g. `Mueang Nakhon Ratchasima, Nakhon Ratchasima`) | `buildLocationText` re-runs client-side with `language: 'en'` against the SAME structured payload already in hand — no re-fetch needed | EC-2 |
| AC-3 | A camper taps a result card to open its detail view | The detail card's hero renders | The hero location line shows the same localized district + province text as the result card, in the active language | `AiChatDetailCard` renders `buildLocationText(card.location, language)` from the SAME instant `card` prop, not a second data source | EC-3 |
| AC-4 | A returned camp's `Location` has no resolved AdminArea (e.g. an older/narrower fallback) | A card for it renders | The card still shows its raw province name (or nothing, if province itself is empty) and is never dropped from the results | `toAiCampCard`/`buildLocationText` fall back gracefully — the card is kept (G8 behavior, unchanged) | EC-4 |
| AC-5 | The province filter is exercised for Chiang Mai, before and after this change | A camper (or a test) counts matching camps | The count is unchanged | `Location.province` storage and `lib/campsite-filters.ts`'s exact-match filter are untouched by this story — Chiang Mai still returns 18 | EC-5 |

## Rules
- BR-1 The card's rendered location text is built ONLY via `buildLocationText` (CAM-545/CAM-573) — no second "district, province" string-builder is introduced anywhere in the AI-chat surface (proves AC-1/AC-2/AC-3).
- BR-2 `Location.province` (the raw, English, DB-stored column) is never changed in shape or value by this story — it keeps driving `lib/campsite-filters.ts`'s exact-string-equality filter, the province dropdown, and the AI search path unchanged (proves AC-5).
- BR-3 The wire payload (`AiChatCardResponse.location`) carries the STRUCTURED bilingual parts (`provinceTh`/`provinceEn`/`districtTh`/`districtEn`/`subDistrictTh`/`subDistrictEn`), never a pre-rendered string — the client picks the language at render time, so a mid-session language switch re-renders correctly with zero re-fetch (proves AC-2; see tech.md "Payload shape decision").
- BR-4 A camp with no resolved AdminArea (or no `Location` row at all) still produces a card — `province` coerces `null` to `''` exactly as `toAiCampCard` already did (G8, unchanged), never a dropped card (proves AC-4).
- BR-5 `isAiChatCardResponse`'s validator accepts every new `location` field as optional/well-formed, so an older/unaware wire body (before this story) still validates (api.md rule 12, backward-compatible by addition).

## Edge cases
- EC-1 IF a card's `adminArea` resolves only to PROVINCE depth THEN the rendered text is province-only, no dangling comma, never a wrong-language guess (BR-1)
- EC-2 IF the camper switches language mid-session with NO new search THEN the already-rendered cards update their location text from the SAME in-hand structured payload on the next render — never stale, never requiring a refetch (BR-3)
- EC-3 IF the detail card is opened for a camp whose result card never showed a province (empty) THEN the detail hero's location row is also omitted (the SAME `hasProvince` gate, unchanged) (BR-4)
- EC-4 IF a card's `Location` row is entirely absent THEN `province` is `''`, every bilingual field is absent, and `buildLocationText` returns `''` — the card is kept, not dropped (BR-4)
- EC-5 IF a camp's raw `Location.province` is read anywhere by a filter/search path THEN it is the UNCHANGED English value — this story only changes what a returned camp's card DISPLAYS, never which camps are returned or matched (BR-2)

## Data
No schema change and no migration. `Location.adminAreaId`-derived fields (`AdminArea.nameTh`/`nameEn`/`level`/`parent`) are already selected by `campCardSelect` (CAM-573) and already flow into every AI tool's row via `aiCampCardSelect` (which spreads `campCardSelect`) — this story only changes how `toAiCampCard` MAPS that already-fetched data onto the wire card, and how the wire type (`AiChatCardResponse.location`) is shaped. No new Prisma `select` field was needed on `search-campsites.ts`/`check-availability.ts`/`bulk-availability.ts` (verified — see tech.md); `get-camp-detail.ts`'s own separate, narrower `location` select is untouched (its `location` field is not rendered by `AiChatDetailCard`, see tech.md "Known gap / non-gap").

## Seams & refs
- Reuse: `buildLocationText` (`components/CampgroundCard.tsx`, CAM-545) — re-exported for the AI-chat surface at `components/ai-chat/location-text.ts` (a new, dependency-free alias; `AiChatCampCard.tsx` is regression-pinned, CAM-428, to import nothing from the catalog card component — BR-4 exception there). `resolveLocationDisplayNames` (`lib/read-models/camp-card.ts`, CAM-573) — imported directly into `lib/read-models/ai-camp-card.ts`'s `toAiCampCard`, unchanged.
- Refs: CAM-545 (camp-card fix), CAM-573 (detail-page/id-derived-chain fix), CAM-566 (the "don't write a second implementation" lesson this story follows), CAM-427 (the AI card read-model this story extends).

## Out of scope
- `lib/ai/place-resolver.ts` / which camps a search RETURNS — untouched; this story changes only how a returned camp's location is WRITTEN on the card.
- `get-camp-detail.ts`'s own `GetCampDetailResult.location` (province/region) — not rendered by `AiChatDetailCard` today (its hero reads the instant `card` prop, never `detail.location`); left as-is, see tech.md.
- The model's own natural-language prose (what น้องกองไฟ SAYS in a sentence) — this story is about the CARD UI only.

## Self-verify
- AC-1/AC-2/AC-4/AC-5 → unit (`__tests__/cam-597-ai-camp-card-location.test.ts`, `__tests__/cam-597-api-client-location.test.ts`)
- AC-1/AC-2/AC-3 → unit, source + behavioral (`__tests__/cam-597-ai-chat-card-location.test.ts`)
- AC-5 canary → `__tests__/cam-580-chiang-mai-canary.test.ts` (pre-existing, re-run before AND after, real dev DB)
- Migration up/down — N/A (no schema change); ownership — n/a (read-only, no new mutation)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-28) — created
