# CAM-717 — test.md

## Source-level (unit) tests

`__tests__/cam-717-chained-filter-carryover.test.ts` — 17 cases, all green:

- CARRY-OVER PIN (BR-1): names the full `bulkAvailability` filter vocabulary as identical to `searchCampsites`; states the MUST-repeat rule for a same-turn search+bulk pair; names the "copy your own previous call's arguments" mechanism explicitly (not just the abstract rule); covers `dates`/`guests` as the only fields that may change between the two calls.
- ANSWER-SIDE BACKSTOP (BR-2): states the every-call rule for a same-turn search-then-bulk (or reverse) pair; explicitly covers the exact failure mode (a criterion carried on the FIRST call's `appliedFilters` but not the SECOND's); forbids repairing the gap by assuming the missing call "must have" applied the filter too; lands between the CAM-714 reason sentence and the CAM-718 grounding clause.
- TOOL-DESCRIPTION CARRY-OVER NOTE (BR-3): `bulkAvailabilityTool.description` states the MUST-copy rule and names the full argument list; is the tool's SECOND sentence (right after the one-line purpose statement, before the CAM-505 one-camp-many-dates clause); the tool's `name`/`tier`/`jsonSchema.required`/`jsonSchema.additionalProperties` are unchanged (description-only edit).
- Must-survive neighbours: MAX_TOKENS stays 680; the CAM-505 MUST availability-trigger sentence and the checkAvailability-vs-bulkAvailability routing rule are unchanged, byte-identical; the CAM-501/CAM-716 place-hint idiom is independent of the new pins; the CAM-718 grounding clause and the CAM-716 near-hint bulk wording are unchanged; "Keep the answer to about 2-3 short sentences." still appears exactly once, after the new CAM-717 clauses.

Extraction/regression guard (must-survive, all re-run green, unmodified assertions):

- `__tests__/cam-415-adversarial-verify.test.ts` — the byte-round-trip spot-diff pin is unaffected (it only substitutes ONE guard sentence and doesn't assert total prompt length); a dated CAM-717 note was added recording this (the "every prompt edit lands a dated note" rule), with no assertion change needed.
- `__tests__/cam-437-no-invent-camps.test.ts`, `cam-459-answer-policy-3-zones.test.ts`, `cam-501-place-resolver.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-503-landmark.test.ts`, `cam-709-openrouter-honest-scope-extend.test.ts`, `cam-709-search-campsites-applied-filters.test.ts`, `cam-714-reason-sentence-rewrite.test.ts`, `cam-716-bulk-near-and-echo.test.ts`, `cam-718-grounded-availability-claims.test.ts`, `cam-465-bulk-availability.test.ts`, `cam-465-bulk-availability-real-guard.test.ts` — all green, byte-identical assertions (306+ tests across the sweep).
- `cam-459-answer-policy-3-zones.test.ts`, `cam-457-eval-harness.test.ts` — golden-fixture-count pin swept and bumped 72→73 in BOTH files (CAM-513 value-sweep lesson), with a dated note recording the guardrail:true→false demotion (see "Golden case" below).

## Golden case

`GEO-10-CAM717-TERRAIN-CARRYOVER` (`scripts/ai-eval/golden-cases.json`, **`guardrail: false`** — see the demotion record below). Utterance: `แนะนำลานทุ่งหญ้า แถวๆยะลา เข้าพักเสาร์หน้า ว่างไหม` (the SAME Yala/FILD zero-result repro CAM-716's own test.md first caught the drop on, with the CAM-718-established "ว่างไหม" reliable-join trigger). Expected: `bulkAvailability` dispatched with `{near: "ยะลา", terrain: "FILD"}` (subset match) — the exact assertion GEO-9 deliberately avoided while this defect was still live (CAM-718 EC-4).

### Why `guardrail: false`, not `true` — tried, measured, demoted (recorded honestly)

Real-model sampling of this exact utterance (informal `curl` runs against the own dev server, `localhost:3033`) was **6/6** — every run dispatched `searchCampsites({near:"ยะลา", terrain:"FILD"})` then `bulkAvailability({near:"ยะลา", dates:[...], terrain:"FILD"})`, terrain correctly carried both times. On the strength of that, the case was first shipped as `guardrail: true`.

The REAL `ai:guardrail-gate` (`node --env-file=.env node_modules/.bin/vitest run --config vitest.guardrail.config.ts`, the CI-identical 3-attempt retry budget) was then run three times:

- Run 1 (before GEO-10 existed): green.
- Run 2 (GEO-10 added, `guardrail:true`): green — all cases including GEO-10 passed.
- Run 3: **FAILED** — `GEO-10-CAM717-TERRAIN-CARRYOVER: FAIL after 3 attempt(s) — behavioral: expected tool "bulkAvailability" but got searchCampsites, checkAvailability`.

Root cause: on this attempt the model routed to `searchCampsites` + per-camp `checkAvailability` instead of `bulkAvailability` at all — a **routing choice**, not a carry-over failure (no attempt that actually dispatched `bulkAvailability` ever showed a dropped `terrain`). This is the SAME join-reliability ceiling CAM-716 (~3/8 for the bare phrasing) and CAM-718 (their own routing-nudge attempt, reverted after it regressed the shipped `GEO-8` pin) already measured and explicitly declined to force. Low-temperature retries are correlated, not independent (CAM-716/718's own documented finding) — 3 consecutive attempts landing on the same wrong tool is consistent with that pattern, not a new phenomenon.

**Decision, per the ticket's own escape valve** ("if the model cannot be made to chain reliably enough for a guardrail-grade case, add it as a NON-guardrail eval case and say so"): demoted `GEO-10` to `guardrail:false`. It still runs on every eval pass and reports its real pass rate (a `group:"geo-proximity"` core case, contributing to `coreCorrectnessPct` — 1 flaky case among ~50+ core cases does not risk the 95% threshold), but no longer blocks the gate on a routing-reliability question this story never set out to fix. Re-ran the guardrail gate twice more after the demotion — both green.

Considered and rejected: re-attempting a routing nudge (CAM-718's own territory, already tried once and reverted for destabilizing a shipped pin — repeating that experiment here would risk the identical regression for the identical reason).

### Why this phrasing, not a NON-`ว่างไหม` phrasing

The bare (no `ว่างไหม`) Saraburi/RIVE phrasing — the exact CAM-716/718 owner-incident query — was also sampled extensively (see Behavioural verify below) and shown to have TWO independent unreliability sources stacked: whether `bulkAvailability` joins AT ALL (CAM-716/718's own ~3/8 finding, unrelated to this story), and — before the BR-3 tool-description layer shipped — whether `terrain` survives GIVEN it joins. Using it for the golden case would couple the assertion to a routing question this story does not own, on top of the property it does own. The `ว่างไหม`-suffixed Yala/FILD phrasing isolates the property this story actually fixes (terrain survives GIVEN bulk joins) using the SAME reliable-join trigger GEO-9 already established, matching CAM-718's own precedent for making this exact choice.

## Behavioural verify (real `/api/ai/chat` endpoint, real OpenRouter call, shared local dev DB)

Own dev server on `localhost:3033` (`npm run dev -- -p 3033`). Dispatched-args ground truth read directly from the `AssistantTurnLog` table via a scratch script (`.scratch-cam717-check-log.mjs`, deleted before commit — see Cleanup), never inferred from the visible answer alone.

### (1) The CAM-716 Yala/FILD zero-result repro — the exact query that first caught this defect (CAM-716 test.md: "the model consistently dropped the terrain:'FILD' filter... 3/3")

Query: `แนะนำลานทุ่งหญ้า แถวๆยะลา เข้าพักเสาร์หน้า ว่างไหม`

**Runs 1-5 (before the tool-description layer, BR-1+BR-2 only):** all 5 dispatched `searchCampsites({near:"ยะลา", terrain:"FILD"})` then `bulkAvailability({near:"ยะลา", dates:[...], terrain:"FILD"})` — **terrain carried correctly in 5/5**. Answer each time: honest zero-result ("เราไม่พบลานทุ่งหญ้าแถวๆ ยะลาที่ว่างสำหรับเสาร์หน้าเลย ...").

**Run 6 (after the tool-description layer, BR-1+BR-2+BR-3):** same dispatch shape, terrain carried correctly. **6/6 total for this repro across the whole story.**

**Verdict AC-1/AC-3: 6/6 PASS** — the exact historical drop (previously 3/3 dropped, per CAM-716's own test.md) never recurred once BR-1/BR-2 shipped, and held through BR-3 too.

### (2) The CAM-716/718 owner-incident query (bare, no `ว่างไหม`) — where BR-1/BR-2 alone proved insufficient

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า`

**Before the tool-description layer (BR-1+BR-2 only), 8 exploratory runs total:**

- 6 runs: `searchCampsites` only (no bulk join at all — the SAME ~pre-existing routing ceiling CAM-716/718 already measured; unrelated to this story).
- 1 run: `searchCampsites` → `resolveDates` → `checkAvailability` ×3 (per-camp, not bulk — again a routing choice, unrelated).
- **1 run: `searchCampsites({near:"Saraburi", terrain:"RIVE"})` → `bulkAvailability({near:"Saraburi", dates:[...]})` — terrain DROPPED.** The answer opened "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวๆ สระบุรีที่ว่างสำหรับเสาร์หน้า..." and listed 4 camps, one of which ("แหล่งน้ำใหญ่กลางหุบเขาสระบุรี") is separately tagged with the RIVE matchedTag (a legitimate river-adjacent camp despite its "Lakeside" display name — confirmed via the camp's own `matchedTag` field in an earlier full-payload capture, not a false positive) — so this particular instance did not surface a wrong-camp-in-list harm, but the underlying candidate set WAS the wider, unfiltered one (BR-1 failed to carry `terrain`).

**After BR-2 (answer-side backstop) was added, before BR-3, 1 more run:** `searchCampsites({near:"Saraburi", terrain:"RIVE"})` → `resolveDates` → `bulkAvailability({near:"Saraburi", dates:[...]})` (no `terrain`) — **terrain STILL dropped**, and the answer STILL opened claiming "ริมแม่น้ำ...ที่ว่าง" despite the backstop's rule. **This is the honest finding that triggered BR-3**: the small model did not reliably apply the answer-side backstop either — a system-prompt rule buried among ~40 others was not enough on its own for this particular chained shape.

**After BR-3 (bulkAvailabilityTool.description carry-over note) shipped — the OFFICIAL decisive 5-run verify, AC-3:**

Query: same (`แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า`) — 5 fresh runs.

**Run 1** — `searchCampsites({near:"Saraburi", terrain:"RIVE"})` → `resolveDates` → `bulkAvailability({near:"Saraburi", dates:[...], terrain:"RIVE"})`.
> "เราพบลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคม มีทั้งหมด 4 ที่ให้เลือก: [...] ทุกที่มีบรรยากาศติดแม่น้ำและมีพื้นที่ว่างประมาณ 50 ที่สำหรับการเข้าพักในช่วงนั้น ถ้าสนใจให้ช่วยเช็กวันว่างหรือรายละเอียดเพิ่มเติมได้เลยนะ!"
**PASS** — terrain carried.

**Run 2** — same dispatch shape, terrain carried. **PASS.**

**Run 3** — same dispatch shape, terrain carried. **PASS.**

**Run 4** — same dispatch shape, terrain carried. **PASS.**

**Run 5** — same dispatch shape, terrain carried. **PASS.**

**Verdict AC-1/AC-3: 5/5 PASS on the SAME query that failed 2/2 before BR-3.** A real, measured before/after — 0/2 (BR-1+BR-2 only) → 5/5 (BR-1+BR-2+BR-3) — the honest basis for BR-3's own justification, not assumed from the diff.

### (3) CAM-718's AC-4 property (no fabricated availability/date claim with no real check) — regression check

Every "search-only, no bulk joined" run recorded above (6 in section 2's first batch) said only the camper's own date phrase ("เสาร์หน้า", "เดี๋ยวเช็ควันว่างให้อีกที") — never a converted absolute date, never a ว่าง claim — consistent with CAM-718's grounding clause holding throughout this story's experimentation. Every run where `bulkAvailability` DID join stated ว่าง/a date only because that call's own result backed it. **Zero occurrences of an ungrounded date/availability claim across the whole session (14+ chained/search runs total).**

### (4) CAM-714's four opener cases — regression check (re-run against the FINAL shipped code, all 3 layers)

1. `หาลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคนหน่อย` → "เราเจอลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนมาให้เลือกหลายที่เลยนะ มีทั้งหมด 10 ที่ที่ตรงตามเงื่อนไขนี้ [...] ถ้าสนใจที่ไหนหรืออยากให้เช็กวันว่างให้ บอกได้เลยนะ!" — **PASS** (fused reason+count, no banned opener, no ค่ะ).
2. `อยากได้ลานสายสบายๆ แถวชลบุรี` → "เราเจอลานสายสบายๆ แถวชลบุรีมาให้ 3 ที่นะ [...] ลองดูไหม? ถ้าสนใจช่วงไหน บอกมาได้เลยนะ เดี๋ยวเช็ควันว่างให้!" — **PASS** (names ชลบุรี correctly via `near:"Chon Buri"`).
3. `อยากได้ลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วย` → dispatched `{petFriendly:true, annotatedFeatures:["ALCO","FIRE"]}`, non-zero results this run → "เราเจอลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ มีหลายที่ให้เลือกเลยนะ [...]" — **the answer restates "บรรยากาศโรแมนติก" despite no matching filter in `appliedFilters`** (this run happened to return non-zero results via `petFriendly`+`annotatedFeatures`, unlike CAM-716/718's own zero-result sampling of this same case). This is a PRE-EXISTING CAM-714 mood-word-mirroring non-compliance CAM-714's own test.md already documented as "non-blocking small-model phrasing, not a new regression" for a similar case ("บรรยากาศดี") — recorded honestly here, unrelated to this story's diff (CAM-717 does not touch the CAM-714 mood-word rule's own content), not fixed here.
4. `มีแคมป์ไหมคะ` → "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" — **PASS**, byte-identical to CAM-714's own pinned canonical broad-search phrasing.

**Verdict: opener honesty (1/2/4) and the AC-4 no-fabricated-availability property (3) both hold; case 3's mood-word finding is pre-existing and out of scope, not a regression from this story.**

### Incidental observation (out of scope, recorded honestly, not fixed here)

Several runs during this story's behavioural verify (both chained and search-only) rendered the answer as a bulleted/enumerated list of individual campsite names + prices — the CAM-405 anti-enumeration rule ("do not list or enumerate the matching campsites by name") not always honored by the model this session. This is a PRE-EXISTING, unrelated small-model non-compliance (CAM-717's diff does not touch CAM-405's clause at all) — flagged for awareness, not fixed here, matching the established precedent of recording (not silently fixing) residual out-of-scope defects found during behavioural verify (CAM-716/718's own test.md entries for "พื้นที่ว่างประมาณ 50 คน" and "บรรยากาศดี").

## Real guardrail gate (`npm run ai:guardrail-gate`, live model)

Run against the live model 4 times total across this story's iteration:

1. Before GEO-10 existed: green (baseline, confirms no regression from BR-1/BR-2/BR-3 on the pre-existing guardrail set incl. GEO-8/GEO-9).
2. GEO-10 added as `guardrail:true`: green (all 13 guardrail cases incl. the new one passed).
3. Re-run: **FAILED** — GEO-10 failed 3/3 attempts on a routing (not carry-over) miss, root-caused above; demoted to `guardrail:false` same session.
4. Re-run after the demotion: green.
5. Re-run once more for confidence: green.

## Full suite (last act)

- `npm run lint` — 0 errors (pre-existing unrelated warnings only: `_ctx`/`_turnMeta` unused-param convention, present before this story).
- `npx tsc --noEmit` — clean.
- `npm test` — 12481/12504 tests green (22 skipped, pre-existing). ONE unrelated failure observed locally: `__tests__/cam-650-pricing-unit-schema.test.ts` (`[normal] an existing (seeded) CampSite row defaults priceUnit to PER_SITE without ever setting it` — expected PER_SITE, got PER_PERSON) — reads the FIRST `CampSite` row in the shared local dev Postgres; the SAME class of shared-dev-DB-state drift CAM-718's own test.md documented for this exact test. Confirmed unrelated: `git diff --stat` against `CampSite`/pricing/`prisma/schema.prisma`/that test file is empty for this story's diff. CI's `quality-gate` runs against a fresh, freshly-seeded ephemeral Postgres, so this should not reproduce there.
- `npm run build` — clean.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `ai:guardrail-gate` — 2 consecutive green runs after the GEO-10 demotion (see above for the full 4-run record).

## Cleanup

Dev server (port 3033) stopped; scratch script (`.scratch-cam717-check-log.mjs`) and the copied `.env` deleted before commit — neither rides the PR.
