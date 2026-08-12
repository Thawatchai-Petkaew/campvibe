# CAM-709 — Test & Verify

## Unit matrix (echo shape)

`__tests__/cam-709-search-campsites-applied-filters.test.ts` (16 tests, all green) — exercises `executeSearchCampsites`'s new `appliedFilters` field on `SearchCampsitesResult`:

| Case | Proves |
|---|---|
| normal — terrain + priceMax | Both dimensions echo together (AC-1); `taxonomy` carries `{group,code,labelTh}` resolved from a real batched `MasterData.findMany` call |
| normal — petFriendly:true | Echoes as `true` (AC-2) |
| dropped-arg — petFriendly:false | Never echoes (BR-1 — never constrained the query) |
| null/empty — no criteria at all | `appliedFilters` is exactly `{ taxonomy: [] }`, the broad-search signal (AC-3) |
| dropped-arg — sort + near | `sort` dropped when `near` overrides it (the geo path never consults `args.sort`) |
| normal — sort alone (non-near) | `sort` echoes when it genuinely ordered the result set |
| boundary — sort never set | `sort` stays `undefined`, never implies the default `'related'` |
| dropped-arg — `type:'ALL'` | Never echoes (`buildCampSiteWhere` treats it as no filter) |
| normal — real `type` code | Echoes |
| dropped-arg — `near` + `province` both supplied | Only `near` echoes; `province` is dropped entirely (near wins outright, matches the tool's own precedence) |
| dropped-arg — unresolvable district | Silently drops (never reached a real query filter) |
| boundary — district + subDistrict both resolved | Both echo together |
| error/validation (EC-3) — MasterData lookup throws | Taxonomy entries omitted (fail-open), search itself still succeeds |
| boundary (EC-3) — one OR-array code has no MasterData row | That entry is omitted; its sibling code still echoes |
| perf — no taxonomy arg supplied | The MasterData label query never fires (no-N+1 guard, mirrors `deriveMatchedTags`) |
| additive — `cards` unaffected | `appliedFilters` rides as a new sibling key; `cards` shape/values unchanged (api.md rule 12) |

`__tests__/cam-709-openrouter-honest-scope-extend.test.ts` (6 tests, all green) — pins the new prompt clause's presence and the untouched BR-5 lines (anti-enumeration `:656`, plain-text `:655`, `MAX_TOKENS`, the pre-existing honest-scope sentence).

## Superseded pins (dated notes, all re-verified green)

- `__tests__/cam-404-search-campsites-province-resolve.test.ts` — one `.resolves.toEqual({ cards: [] })` → now asserts the additive `appliedFilters` echo alongside it.
- `__tests__/cam-458-province-resolve.test.ts` — two full-result `.toEqual({ cards: [] })` pins → same additive update.
- `__tests__/cam-463-search-campsites-region.test.ts` — two full-result pins → same additive update.
- `__tests__/cam-502-geo-proximity.test.ts` — three full-result pins (near-path) → same additive update (`near` always echoes once set).
- `__tests__/cam-503-landmark.test.ts` — three full-result pins (landmark near-path) → same additive update.
- `__tests__/cam-587-district-subdistrict-aliases.test.ts` — four full-result pins (unresolved district/sub-district) → same additive update, each asserting the DROPPED (never-echoed) location per BR-1.
- `__tests__/cam-415-adversarial-verify.test.ts` — the full-prompt byte-round-trip test (`:241-245`) — **investigated, NOT edited**: its round-trip assertion (`newSystemPrompt.replace(newGuardSentence, oldGuardSentence).replace(oldGuardSentence, newGuardSentence) === newSystemPrompt`) is a self-referential identity that holds regardless of unrelated content added elsewhere in the prompt (verified empirically — full test file re-run green, unmodified, after both prompt edits).
- No pin on the `:691` sentence text existed in `cam-501`/`cam-502` test files to supersede (checked; none found).

## Behavioural verify (real `/api/ai/chat` endpoint, real OpenRouter call, dev DB — CAM-500 lesson: never trust a diff read for a prompt change)

Ran against `next dev -p 3028` (my own dev server; localhost:3000 is the owner's) pointed at the local dev Postgres (795 real active/published camps). All 4 cases below were re-run **after** the final prompt wording landed (confirmed by re-running each one last, consecutively, with no further edits after).

### AC-1 — water terrain + price cap

Message: `อยากได้ลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคน`

Answer opening: **`เลือกมาจากเงื่อนไขที่ขอไว้ คือ ลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคน มีตัวเลือกดังนี้:`**

Result: PASS. Opens with the reason sentence, near-verbatim match to the AC's own illustrative Thai example (terrain + price both named, sourced from the real applied filters — `terrain:RIVE`, `priceMax:500`). 10 cards returned.

### province + camperStyle (province+style plan example)

Message: `หาลานกางเต็นท์สายสบายๆ ในชลบุรีหน่อยค่ะ` (first tried เชียงใหม่ — 0 real matches for camperStyle CHIC there, confirmed honestly with `ไม่พบ...`; switched to ชลบุรี which has 3 real CHIC-tagged camps)

Answer opening: **`เลือกมาจากเงื่อนไขที่ขอไว้ คือสายสบายในชลบุรี มีลานกางเต็นท์ที่น่าสนใจดังนี้:`**

Result: PASS. Names the camperStyle Thai label ("สายสบาย") and the province ("ในชลบุรี"), never the raw `CHIC` code, never in parentheses (an earlier iteration leaked `สายสบาย (CHIC)` — fixed by tightening the taxonomy-label instruction to forbid any parenthetical code gloss; re-verified clean after the fix). 3 cards returned.

### AC-2 — honesty probe (pet-allowed = real filter + romantic-atmosphere = NOT a real filter)

Message: `อยากได้ลานกางเต็นท์บรรยากาศโรแมนติกสำหรับคู่รัก ที่พาสัตว์เลี้ยงไปได้ด้วยค่ะ`

Deliberately substituted "บรรยากาศโรแมนติก" (romantic atmosphere) for the story's own illustrative "วิวสวย" example: `วิวสวย` actually resolves to a real filter today (`type:VIEW`, both in the tool's own jsonSchema and the system prompt's concept-map line), so it would not reliably reproduce an *unfilterable* criterion. "Romantic atmosphere" matches no taxonomy code in any group (terrain/access/activities/facilities/equipment/annotatedFeatures/camperStyle/type) — confirmed against the full code lists in `search-campsites.ts` before choosing it.

**This was the load-bearing case, and it failed on the first two attempts before the prompt clause was strong enough:**

1. First attempt (base clause) — answer opened `ฉันพบลานกางเต็นท์บรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วยค่ะ...` — **claimed the unfiltered "โรแมนติก" criterion.** EC-1 violation, reproduced live.
2. Tuned the clause (added an explicit "do not restate the camper's own mood word" instruction + a worked example) — re-ran — **still claimed "โรแมนติก"** (`ได้พบลานกางเต็นท์บรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ค่ะ...`). The model was mirroring the camper's own request wording as a conversational opener, not composing from `appliedFilters`.
3. Strengthened further (explicit "do not restate/mirror" language + a concrete worked example naming this exact scenario) — re-ran:

Answer opening: **`เลือกมาจากเงื่อนไขที่ขอไว้ คือพาสัตว์เลี้ยงไปได้และบรรยากาศสบาย (สายคุณหนู) มีลานกางเต็นท์ที่น่าสนใจดังนี้:`**

Result: PASS. The word "โรแมนติก" does not appear anywhere in the answer. The model honestly named only what it actually applied: `petFriendly:true` (real) and `camperStyle:CHIC` (a real best-effort mapping from the mood — per the existing, untouched CAM-477 vibe-search guidance — named by its genuine MasterData `nameTh`, `"สบาย (สายคุณหนู)"`, which legitimately contains its own parenthetical text, unlike the earlier raw-code leak). 10 cards returned. Re-ran twice more (after the parenthesis-tightening edit) to confirm stability — consistent both times.

### AC-3 — broad, no-filter search

Message: `แนะนำที่กางเต็นท์หน่อยค่ะ`

Answer opening: **`เลือกมาจากการค้นหาทั่วไป ไม่มีเงื่อนไขเฉพาะเจาะจงค่ะ นี่คือที่กางเต็นท์ที่น่าสนใจ:`**

Result: PASS. States plainly this was a broad/general search with no specific criteria (`appliedFilters` was `{ taxonomy: [] }` — nothing set), matching AC-3. The closing line invites picking among the shown results rather than a fresh criterion in as many words — a minor softness, not a dishonesty violation (no fabricated reason). 10 cards returned.

## Known pre-existing, out-of-scope observation

Every case above still lists campsites by name in the body of the answer (violates the anti-enumeration clause, `openrouter-client.ts:656`). Story.md's own Out-of-scope section names this explicitly: *"Fighting the model's list-writing habit (it violates :656 today; a separate behavioural battle, observed not fought here)."* Confirmed live, not fixed here — no clause touched at `:656`/`:655` (BR-5).

## Self-verify commands (final, all green)

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npm run lint` — 0 errors, 360 pre-existing warnings (none new).
- `npx vitest run` — 486 files passed / 5 skipped, 12390 tests passed / 25 skipped (includes the 22 new CAM-709 tests + 15 superseded pins, all green).
- ai-guardrail-gate (9 real-model golden cases, `lib/ai` changed) — runs on CI per PR; not re-run locally (real spend guard — CI is the system of record for this gate).
