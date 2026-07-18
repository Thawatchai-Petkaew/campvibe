---
linear: CAM-408
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
class: spec-lite
---
# AI search understands terrain codes and relative Thai dates (CAM-408)

## Story
As a **Camper**, I want the AI chat to understand terrain/facility words ("ติดน้ำ", "วิวภูเขา") and relative Thai dates ("สัปดาห์หน้า"), so that asking for a water-adjacent, pet-friendly camp or a mountain-view tent site available next weekend returns real matching results instead of an empty list.
Why: real-smoke G4 defect — `หาที่แคมป์ติดน้ำ หมาเข้าได้` and `ลานกางเต้นวิวภูเขา ว่างเสาร์อาทิตย์หน้า` both returned zero results though ~20 matching camps exist. Root cause 1: `searchCampsites`'s schema exposed no terrain/access/activities/facilities args, so the model had no way to emit a MasterData taxonomy code. Root cause 2: the system prompt carried no reference date, so a relative Thai date could not be resolved to an ISO date for `checkAvailability`.
Scope: `lib/ai/tools/search-campsites.ts` (add terrain/access/activities/facilities/keyword args, pure passthrough to the existing `buildCampSiteWhere` taxonomy handling — no new where-logic) + `lib/ai/openrouter-client.ts` (inject today's Asia/Bangkok date + filter/date guidance into the system prompt, built fresh per turn). No schema/migration change, no UI change.
Depends on: CAM-270 (`searchCampsites`/`checkAvailability` tools, shipped) · CAM-404 (Thai province resolve, shipped) · CAM-271/272 (chat endpoint + UI, shipped).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper asks about a terrain/access/activity/facility characteristic in Thai, e.g. `หาที่แคมป์ติดน้ำ หมาเข้าได้` | The model calls `searchCampsites` with a matching taxonomy code (e.g. `terrain: "RIVE"`, `petFriendly: true`) | Real matching campsite cards appear in the chat (no changed copy — reuses the existing card render) | The code is validated by zod, then passed through unchanged to `buildCampSiteWhere`'s existing `options: { some: { code } }` AND-filter; matching camps are returned | EC-1 |
| AC-2 | The camper asks about availability using a relative Thai date, e.g. `ว่างเสาร์อาทิตย์หน้า` | The model calls `checkAvailability` | The assistant reports real remaining capacity for the resolved dates (no changed copy) | The system prompt carries today's actual Asia/Bangkok date; the model computes the absolute ISO date range from it before calling `checkAvailability` | EC-2 |
| AC-3 | The model attempts to call `searchCampsites` with a taxonomy code that does not exist in MasterData | The tool call is dispatched | — (unchanged; same handled-error path CAM-270 already ships) | zod's `z.enum` rejects the unknown code before Prisma runs (`invalid_args`, no query) | EC-3 |

## Rules
- BR-1 `terrain`, `access`, `activities`, `facilities` are each a single optional code validated against the real MasterData codes for that group (source: `prisma/seed.ts` `masterData`); each is passed through unchanged to `buildCampSiteWhere`. (proves AC-1)
- BR-2 `keyword` is a single optional string passed through unchanged to `buildCampSiteWhere`'s existing name/description keyword match — reserved for a specific campsite name, not a general characteristic. (proves AC-1)
- BR-3 An arg value outside its group's real code list fails `searchCampsitesArgsSchema`'s `z.enum` at `dispatchTool`'s `safeParse` step — the call is rejected as `invalid_args`; `executeSearchCampsites` and Prisma are never reached. (proves AC-3, EC-3)
- BR-4 The system prompt's date line (`Today's date is <ISO date> (<Thai weekday>), Asia/Bangkok time.`) is computed fresh on every call from the real current time — never a cached/module-load value. (proves AC-2)

## Edge cases
- EC-1 IF no camp matches the requested taxonomy code(s) THEN `searchCampsites` returns `{ cards: [] }` (unchanged CAM-270 AC-8 empty-state behavior), no throw (BR-1)
- EC-2 IF the model cannot resolve a relative date it still calls `checkAvailability` with its best-effort ISO date THEN the existing `checkAvailability` result/error path is unchanged (this fix supplies the missing reference date; it does not change `checkAvailability` itself) (BR-4)
- EC-3 IF the model requests an unknown/invalid taxonomy code THEN `dispatchTool` returns `{ ok:false, code:'invalid_args' }` — no Prisma query runs, no crash (BR-3)

## Data
- No schema change, no migration. Reads the existing `MasterData` table's Terrain/Access type/Activity/Internal facility groups (already seeded by `prisma/seed.ts`); `buildCampSiteWhere`'s existing `options: { some: { code } }` AND-filter is reused unchanged for every new arg.

## Seams & refs
- Reuse: `lib/campsite-filters.ts` `buildCampSiteWhere` (terrain/access/activities/facilities/keyword params already exist and are used by the catalog UI filter panel — this story only wires the AI tool's args through to them, no new where-logic) · `lib/ai/tool-registry.ts` `dispatchTool` (existing zod-reject-before-execute pattern, BR-3). No other reader/writer of `MasterData`/`buildCampSiteWhere` is touched (NO-CHANGE) — `lib/filterOptions.ts` was investigated as a candidate code source and rejected (dead code, codes don't match the real MasterData table; see code comment in `search-campsites.ts`).
- Refs: CAM-270 story (`searchCampsites`/`checkAvailability` origin) · CAM-404 story (Thai province resolve, same file) · ADR-009 (AI tool layer, no forked data path).

## Out of scope
- Multi-code (array/OR or AND) taxonomy filters per group → not requested; single-code covers both reported defects without the AND-multi-select footgun (see code comment).
- Expanding `MasterData` beyond the currently-seeded codes → follow-up ticket if a gap recurs in smoke.
- Fixing the pre-existing, unrelated facility-code mismatch in `lib/filterOptions.ts`/`types/api.ts`/`app/api/bulk-seed`/`components/AmenitiesModal.tsx` (dead/legacy code not wired to this tool) → separate ticket if it ever surfaces as a real defect.

## Self-verify
- AC-1 → unit (`terrain`/`access`/`activities`/`facilities`/`keyword` each parse via zod and reach `buildCampSiteWhere` unchanged; jsonSchema advertises the real codes + Thai gloss)
- AC-2 → unit (`formatTodayContextLine` format asserted with an injected `now`, not the real clock; `runAssistantTurn`'s system-prompt message contains an ISO-date + Thai-weekday line and the relative-date/keyword guidance sentences)
- AC-3/EC-3 → unit (an unrecognized code fails `searchCampsitesArgsSchema.safeParse`)
- Story-specific: full existing `cam-270-*`/`cam-271-*`/`cam-404-*`/`cam-405-*` suites re-run unmodified and green (no regression to the existing tool/prompt contract)
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB)

## Changelog
- v1 (2026-07-18) — created (spec-lite, real-smoke G4 defect fix; G1 folds into the G3 packet per gate policy v2)
