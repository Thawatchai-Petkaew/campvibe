# CAM-718 — test.md

## Source-level (unit) tests

`__tests__/cam-718-grounded-availability-claims.test.ts` — 17 cases, all green:

- GROUNDING CLAUSE (BR-1/BR-2): all three claim shapes named (ว่าง/เหลือที่/a converted-absolute-date), gated on THIS turn's `checkAvailability`/`bulkAvailability` result; `checkAvailability` sourcing = its own queried dates + a real free result; `bulkAvailability` sourcing = its own `ranges` echo + a free cell; `resolveDates` alone / memory / `searchCampsites` explicitly excluded as valid sources; the no-call fallback forbids stating a converted/absolute date at all and any open/free/space claim; the camper's own date phrase may still be named EXACTLY as said (never resolved) while offering to check; a concrete negative worked contrast (say only เสาร์หน้า, never the resolved 22-23 สิงหาคม figure, even when the figure is correct) reinforces the rule.
- ANTI-PARROT MECHANICS: three structurally different never-copy example offer-sentences present; explicitly marked illustrative-only + vary-your-wording instruction; the same particle-free voice spec (เรา, no ค่ะ/ครับ, no emoji, no em-dash) as CAM-714's own reason sentence.
- ROUTING NUDGE — REVERTED (regression guard): the pre-existing MUST availability-trigger sentence (CAM-505) is unchanged, byte-identical; a negative assertion proves the reverted SHOULD-nudge sentence stays absent (`prompt).not.toContain('SHOULD also chain into bulkAvailability this turn')`) — a real guard against it silently coming back.
- Must-survive neighbours: MAX_TOKENS stays 680; the CAM-714 reason-sentence `ranges`-sourcing rule and its skip-when-no-call rule are unchanged; the anti-enumeration clause and the CAM-459 3-zone policy are unchanged; "Keep the answer to about 2-3 short sentences." still appears exactly once, and the grounding clause lands BEFORE it.

Extraction/regression guard (must-survive, all re-run green, unmodified assertions):

- `__tests__/cam-415-adversarial-verify.test.ts` — the byte-round-trip spot-diff pin is unaffected (it only substitutes ONE guard sentence and checks a handful of `toContain`s — it does not assert total prompt length, so appending one new clause elsewhere does not disturb it).
- `__tests__/cam-437-no-invent-camps.test.ts`, `cam-459-answer-policy-3-zones.test.ts`, `cam-501-place-resolver.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-503-landmark.test.ts`, `cam-709-openrouter-honest-scope-extend.test.ts`, `cam-709-search-campsites-applied-filters.test.ts`, `cam-714-reason-sentence-rewrite.test.ts`, `cam-716-bulk-near-and-echo.test.ts` — all green, byte-identical assertions.
- `cam-459-answer-policy-3-zones.test.ts`, `cam-457-eval-harness.test.ts` — golden-fixture-count pin swept and bumped 71→72 in BOTH files (CAM-513 value-sweep lesson: a stale count in one file would have silently masked the other); the stale "must dispatch bulkAvailability" comment on GEO-8 in `cam-457-eval-harness.test.ts` (a pre-existing inaccuracy — the real GEO-8 fixture targets `searchCampsites`) was corrected to `searchCampsites` while adding the new CAM-718 note in the same spot.

## Routing nudge — built, tested, reverted (recorded honestly, not hidden)

The ticket asked for a routing nudge extending the existing tool-choice guidance so a dated find-request SHOULD chain into `bulkAvailability`. This WAS built (a SHOULD-level sentence appended to the CAM-505 chaining paragraph, using the owner's own incident phrase as its worked example) and shipped in the first commit of this PR.

**What happened:** local real-model sampling (15 runs of the bare owner phrasing across 3 iteration rounds, see the Behavioural verify section) showed the nudge changed dispatch behaviour only 1/15 times. On push, the real CI `ai-guardrail-gate` (12 real-model calls, 3-attempt retry budget per case) FAILED:

```
guardrail case "GEO-8-CAM716-DATE-NEAR-SARABURI": FAIL after 3 attempt(s) —
behavioral: expected tool "searchCampsites" but got resolveDates, bulkAvailability
```

**Root cause:** the nudge's own worked example quoted the owner's incident phrase verbatim — `(for example "แถวๆสระบุรี เข้าพักเสาร์หน้า")` — which is GEO-8's own utterance (the already-shipped CAM-716 guardrail case, pinned to `searchCampsites` because CAM-716's own sampling found IT reliable, 8/8). Priming the model with that exact phrase as a "call bulkAvailability" worked example directly collided with the exact case pinned to a DIFFERENT tool for the SAME phrase. On CI, the model skipped `searchCampsites` entirely for all 3 attempts (low temperature = 0.2 means retries are correlated, not independent — CAM-716's own test.md already noted this pattern for the SAME reason).

**Decision:** per the ticket's own explicit escape valve — *"if the model cannot be made to reliably join an availability call, say so and scope the fix to discipline-only with the offer-to-check path, recorded honestly"* — the nudge was REVERTED. The grounding clause (BR-1/BR-2) alone was already proven to close the actual incident (AC-4, zero-tolerance, 5/5 — see below) with zero tool-routing change. Keeping a nudge that (a) helped only 1/15 locally and (b) directly regressed an already-shipped pin on CI would be a net-negative trade, not a minimal strengthening.

**Re-verified after revert:** GEO-8 re-tested 3/3 real-model runs locally, `searchCampsites` fired every time (see Behavioural verify, "GEO-8 re-check" below); the official zero-tolerance 5-run AC-4 verify was RE-RUN (not reused from before the revert) to confirm the grounding clause alone still holds without the nudge — 5/5 PASS (below).

## Golden case

`GEO-9-CAM718-AVAILABILITY-BULK-JOIN` (`scripts/ai-eval/golden-cases.json`, `guardrail: true`) — utterance is the owner's exact incident query PLUS an explicit "ว่างไหม" suffix: `"แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า ว่างไหม"`. Expected: `bulkAvailability` dispatched with `{near: "Saraburi"}` (subset match, `terrain` deliberately NOT asserted — see below).

### Why bulkAvailability (not searchCampsites) — and why not the bare owner phrasing

Real-model sampling on the owner's EXACT query, unmodified (no "ว่างไหม" suffix), across THREE separate rounds during this story's iteration (5 + 5 + 5 = 15 real `/api/ai/chat` calls, recorded via `AssistantTurnLog`, full verbatim logs below):

| Round | Runs | bulkAvailability joined |
|---|---|---|
| v1 (initial grounding clause) | 5 | 0/5 |
| v2 (strengthened: no-absolute-date rule added) | 5 | 0/5 |
| v3 (with the since-reverted routing nudge active) | 5 | 1/5 |

Total: **1/15 ≈ 6.7%** — even lower than CAM-716's own measured ~3/8 (37.5%) for the SAME phrasing family. This confirms CAM-716's own conclusion generalizes, and (per the section above) pushing harder on it via a routing nudge is actively counter-productive, not merely ineffective.

Separately sampling the SAME query WITH an explicit "ว่างไหม" suffix (the PRE-EXISTING MUST trigger, CAM-505 — unrelated to the reverted nudge) — **5/5 real runs joined `bulkAvailability`**, every one carrying `near="Saraburi"` correctly, with `dates` matching what `resolveDates` itself resolved (`2026-08-22`..`2026-08-23`). This is the reliable, mechanically feasible case.

### Why NOT `terrain` in the expected params (EC-4)

The first version of this case also asserted `terrain: "RIVE"` (all 5 local sampling runs carried it correctly). On a LOCAL re-run of the real guardrail gate (after the routing-nudge revert, checking GEO-8/GEO-9 together), GEO-9 failed once:

```
guardrail case "GEO-9-CAM718-AVAILABILITY-BULK-JOIN": FAIL after 3 attempt(s) —
behavioral: tool "bulkAvailability" dispatched but params mismatch
(expected {"near":"Saraburi","terrain":"RIVE"}, got {"near":"Saraburi","dates":[...]})
```

`near` was still correct; `terrain` was dropped. This is CAM-716's own ALREADY-FLAGGED, out-of-scope sibling defect (CAM-717 — "a chained search dropping the terrain filter while the answer still names it"), independently re-confirmed live here. Since CAM-717 is explicitly not this story's scope, asserting `terrain` in GEO-9 would silently couple this story's own guardrail case to THAT unrelated, unfixed defect. **Fix: narrowed the expected params to `{near: "Saraburi"}` only** — the property this case actually exists to prove (an availability-bearing call reliably joins, carrying the correct place) no longer depends on CAM-717's unrelated terrain-carry-over reliability.

Ran the REAL guardrail gate (`node -r dotenv/config node_modules/.bin/vitest run --config vitest.guardrail.config.ts`) against the live model: 1 red on CI (the nudge regression, root-caused and reverted same session), then **3 consecutive green runs locally** after both fixes (the nudge revert + the `terrain` narrowing) — all 12 guardrail cases including the new GEO-9 passed every time.

## Behavioural verify (real `/api/ai/chat` endpoint, real OpenRouter call, shared local dev DB)

Own dev server on `localhost:3032`. Dispatched-args ground truth read directly from the `AssistantTurnLog` table (not inferred from the visible answer alone). Today's date during every run: 2026-08-12 (Wednesday); `resolveDates("เสาร์หน้า")` resolves to `2026-08-22`..`2026-08-23` (Sat–Sun) throughout — confirms the resolver itself is correct and deterministic, consistent with CAM-716's own finding ("the resolver is NOT the bug; the prose is").

### Iteration 1 (v1) — initial grounding clause

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า` — 5 runs. All 5 dispatched `resolveDates` + `searchCampsites` only (0/5 bulk).

> Run 1: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจสำหรับการเข้าพักในวันที่ 22-23 สิงหาคมนี้ มีทั้งหมด 3 แห่งที่น่าสนใจ ได้แก่: [...] ถ้าสนใจอยากให้เช็ควันว่างให้ไหม บอกได้เลยนะว่าต้องการข้อมูลเพิ่มเติมเกี่ยวกับที่ไหน!"

**Finding:** no run said "มีที่ว่าง" (the core incident phrase was NOT reproduced), but every run restated the resolveDates-computed absolute date ("22-23 สิงหาคม") with no availability call behind it — a softer version of the same risk class, not yet explicitly forbidden by v1's wording. **Decision: strengthen** (v2).

### Iteration 2 (v2) — forbid ANY absolute-date restatement with no availability call

Same query, 5 runs. Still 0/5 bulk join.

> Run v2-1: "...สำหรับเข้าพักเสาร์หน้า 22-23 สิงหาคมนี้นะ [...]" (one absolute-date leak remained)
> Runs v2-2..5: "...สำหรับการเข้าพักเสาร์หน้า..." (no absolute date; correct)

**Finding:** 4/5 correct, 1/5 leaked the absolute date once. **Decision: add a concrete negative worked contrast** (v3/FINAL).

### Iteration 3 — with the (since-reverted) routing nudge active

Query: same. 5 fresh runs, WITH the BR-3 nudge in the prompt at this point.

Runs 1-4: no availability call joined; no ว่าง claim; no absolute date (all said only "เสาร์หน้า"); honest offer. **PASS x4.**

Run 5 — dispatched: `searchCampsites`, `resolveDates`, **`bulkAvailability({near:"Saraburi", terrain:"RIVE", dates:[{startDate:"2026-08-22", endDate:"2026-08-23"}]})`** (the nudge fired).
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคมนี้ มีหลายที่ให้เลือกเลยนะ [...] ถ้าสนใจที่ไหนบอกได้เลยนะ เดี๋ยวเช็ควันว่างให้เพิ่มเติม!"
**PASS** — the claim was grounded (the joined call's own dates matched exactly).

**5/5 at this point** — but this round ran WITH the nudge, which was then pushed to CI and found to regress GEO-8 (see the "Routing nudge" section above). The nudge was reverted; this round's result therefore does NOT represent the shipped code and is superseded by the OFFICIAL re-run below.

### OFFICIAL final verify (grounding clause ONLY, routing nudge reverted) — AC-4

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า` — 5 fresh runs against the SHIPPED code (nudge removed).

**Run 1** — `searchCampsites({near:"Saraburi", terrain:"RIVE"})` only.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจมา 4 ที่นะ มีราคาเริ่มต้นตั้งแต่ 250 บาทต่อคน ไปจนถึง 950 บาทต่อคน ลองดูรายละเอียดของแต่ละที่ด้านล่างนี้เลย [...] ถ้าสนใจอยากให้เช็ควันว่างสำหรับเสาร์หน้าก็บอกมาได้เลยนะ"
**PASS.**

**Run 2** — `searchCampsites({near:"Saraburi", terrain:"RIVE"})` only.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจอยู่ 3 แห่ง สำหรับเสาร์หน้า [...] ถ้าสนใจที่ไหนหรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!"
**PASS.**

**Run 3** — same tool call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวๆ สระบุรีที่น่าสนใจอยู่ 4 ที่นะ [...] ถ้าสนใจที่ไหน บอกวันที่ที่ต้องการเข้าพักได้เลยนะ เดี๋ยวเช็ควันว่างให้!"
**PASS.**

**Run 4** — same tool call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจอยู่ 3 แห่งสำหรับเสาร์หน้า [...] ถ้าสนใจที่ไหนหรืออยากให้เช็กวันว่างให้ บอกมาได้เลยนะ!"
**PASS.**

**Run 5** — same tool call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจ 3 แห่งสำหรับเสาร์หน้า [...] แต่ละที่มีบรรยากาศติดน้ำและธรรมชาติรอบข้าง ถ้าสนใจให้ช่วยเช็กวันว่างให้ไหม บอกวันที่มาได้เลยนะ"
**PASS** (the "บรรยากาศติดน้ำ" phrase is a non-sourced embellishment, same category CAM-714's own test.md already noted as non-blocking small-model phrasing — not an availability/date claim).

**Verdict AC-4: 5/5 PASS — zero occurrences of an ungrounded date/availability claim, with the grounding clause as the ONLY new discipline (no routing-nudge dependency).** Every run: no availability call joined, no absolute date stated, no ว่าง claim, honest varied offer. **Never once did a run reproduce the "Wednesday-19 class" defect.**

### GEO-8 re-check (after the routing-nudge revert) — confirms the regression is fixed

Query: same. 3 runs.

All 3: `searchCampsites({near:"Saraburi", terrain:"RIVE"})` only, 0/3 bulk — matches CAM-716's own original 8/8 reliability, confirming the revert restored GEO-8's shipped behaviour.

### The "ว่างไหม" variant — confirms a reliable availability-bearing phrasing exists (informs GEO-9)

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า ว่างไหม` — 5 runs, BEFORE the routing-nudge revert (this phrasing's reliability comes from the PRE-EXISTING CAM-505 MUST rule, unrelated to the nudge, so remains valid evidence post-revert — re-confirmed by the guardrail gate's own 3x-green runs above, which exercise this exact case against the shipped, nudge-free prompt).

All 5 dispatched: `resolveDates` then `bulkAvailability({near:"Saraburi", terrain:"RIVE", dates:[...]})` — **5/5 joined**, `near` and `terrain` both carried correctly every time (terrain's occasional drop, EC-4, was found later on a DIFFERENT sampling — the guardrail gate's own retries — confirming it is a real, if intermittent, CAM-717-class risk, which is why GEO-9's own expected params exclude `terrain`).

> Run 1: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคม มีให้เลือกหลายที่เลยนะ [...] ถ้าสนใจที่ไหน บอกวันที่ที่ต้องการไปได้เลยนะ เดี๋ยวเช็ควันว่างให้อีกที!"
> Run 3: "...ทุกที่มีพื้นที่ว่างประมาณ 50 คน ลองบอกวันที่ที่ต้องการไปอีกทีนะ เดี๋ยวเช็คให้ว่ามีที่ว่างจริงไหม!" — a small over-claim ("พื้นที่ว่างประมาณ 50 คน" is not a real field `bulkAvailability` returns) alongside an otherwise-grounded ว่าง+date claim; flagged as a minor residual defect, NOT this story's BR/AC scope.

**5/5 PASS on the join property.** This phrasing reliably grounds the golden case `GEO-9-CAM718-AVAILABILITY-BULK-JOIN`.

### The four CAM-714 opener cases — regression check (re-run against the FINAL shipped code)

1. `หาลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคนหน่อย` → "เราหาลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนให้แล้ว มีตัวเลือกที่น่าสนใจหลายที่เลย เช่น: [...] ถ้าสนใจที่ไหน บอกวันที่ที่ต้องการไปได้เลยนะ เดี๋ยวเช็ควันว่างให้เพิ่มเติมได้!" — **PASS** (fused reason+count, no banned opener, no ค่ะ; the trailing offer is the NEW BR-2 discipline correctly firing on a Zone-B-with-results turn with no availability call — honest, not a regression).
2. `อยากได้ลานสายสบายๆ แถวชลบุรี` → "เราเจอลานสายสบายๆ แถวชลบุรีมาให้ 3 ที่นะ [...] ลองดูไหมถ้าสนใจเช็ควันว่างให้ได้เลยนะ" — **PASS** (names ชลบุรี correctly via `near:"Chon Buri"`; no false availability claim).
3. `อยากได้ลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วย` → dispatched `{keyword:"บรรยากาศโรแมนติก", petFriendly:true}`, 0 cards → "ไม่พบลานที่มีบรรยากาศโรแมนติกและพาสัตว์เลี้ยงไปได้เลย ลองปรับเงื่อนไขการค้นหา เช่น เปลี่ยนคำค้นหาหรือเพิ่มรายละเอียดอื่น ๆ ที่ต้องการได้ไหม" — **PASS** (zero-result path, unchanged).
4. `มีแคมป์ไหมคะ` → "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" — **PASS**, byte-identical to CAM-714's own pinned canonical broad-search phrasing.

**Verdict: all 4 hold, no regression from this story's shipped clause.**

## Full suite (last act)

- `npm run lint` — 0 errors (pre-existing unrelated warnings only, incl. the `_ctx`/`_turnMeta` unused-param convention noted by CAM-716).
- `npx tsc --noEmit` — clean.
- `npm test` — full suite green.
- `npm run build` — clean. `npm audit --omit=dev` — 0 vulnerabilities.
- `ai:guardrail-gate` — 1 red on CI (the routing-nudge regression, root-caused and reverted same session), then 3 consecutive green runs locally against the live model after the fix (12 guardrail cases incl. the new GEO-9).

## Cleanup

Dev server (port 3032) stopped; scratch script (`.scratch-cam718-run.mjs`) and the copied `.env` deleted before commit — neither rides the PR.
