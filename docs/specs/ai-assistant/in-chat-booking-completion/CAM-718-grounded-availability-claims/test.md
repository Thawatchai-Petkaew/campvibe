# CAM-718 — test.md

## Source-level (unit) tests

`__tests__/cam-718-grounded-availability-claims.test.ts` — 18 cases, all green:

- GROUNDING CLAUSE (BR-1/BR-2): all three claim shapes named (ว่าง/เหลือที่/a converted-absolute-date), gated on THIS turn's `checkAvailability`/`bulkAvailability` result; `checkAvailability` sourcing = its own queried dates + a real free result; `bulkAvailability` sourcing = its own `ranges` echo + a free cell; `resolveDates` alone / memory / `searchCampsites` explicitly excluded as valid sources; the no-call fallback forbids stating a converted/absolute date at all and any open/free/space claim; the camper's own date phrase may still be named EXACTLY as said (never resolved) while offering to check; a concrete negative worked contrast (say only เสาร์หน้า, never the resolved 22-23 สิงหาคม figure, even when the figure is correct) reinforces the rule.
- ANTI-PARROT MECHANICS: three structurally different never-copy example offer-sentences present; explicitly marked illustrative-only + vary-your-wording instruction; the same particle-free voice spec (เรา, no ค่ะ/ครับ, no emoji, no em-dash) as CAM-714's own reason sentence.
- ROUTING NUDGE (BR-3/BR-4): a dated find/recommend request SHOULD chain into `bulkAvailability`, carrying the same place/terrain filters + resolved dates; the nudge explicitly allows an honest degrade to `searchCampsites` alone; the pre-existing MUST availability-trigger sentence (CAM-505) is unchanged, byte-identical.
- Must-survive neighbours: MAX_TOKENS stays 680; the CAM-714 reason-sentence `ranges`-sourcing rule and its skip-when-no-call rule are unchanged; the anti-enumeration clause and the CAM-459 3-zone policy are unchanged; "Keep the answer to about 2-3 short sentences." still appears exactly once, and both new CAM-718 clauses land BEFORE it (order matters — the model reads the discipline before the length cap).

Extraction/regression guard (must-survive, all re-run green, unmodified assertions):

- `__tests__/cam-415-adversarial-verify.test.ts` — the byte-round-trip spot-diff pin is unaffected (it only substitutes ONE guard sentence and checks a handful of `toContain`s — it does not assert total prompt length, so appending two new clauses elsewhere does not disturb it).
- `__tests__/cam-437-no-invent-camps.test.ts`, `cam-459-answer-policy-3-zones.test.ts`, `cam-501-place-resolver.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-503-landmark.test.ts`, `cam-709-openrouter-honest-scope-extend.test.ts`, `cam-709-search-campsites-applied-filters.test.ts`, `cam-714-reason-sentence-rewrite.test.ts`, `cam-716-bulk-near-and-echo.test.ts` — all green, byte-identical assertions.
- `cam-459-answer-policy-3-zones.test.ts`, `cam-457-eval-harness.test.ts` — golden-fixture-count pin swept and bumped 71→72 in BOTH files (CAM-513 value-sweep lesson: a stale count in one file would have silently masked the other); the stale "must dispatch bulkAvailability" comment on GEO-8 in `cam-457-eval-harness.test.ts` (a pre-existing inaccuracy — the real GEO-8 fixture targets `searchCampsites`) was corrected to `searchCampsites` while adding the new CAM-718 note in the same spot.

## Golden case

`GEO-9-CAM718-AVAILABILITY-BULK-JOIN` (`scripts/ai-eval/golden-cases.json`, `guardrail: true`) — utterance is the owner's exact incident query PLUS an explicit "ว่างไหม" suffix: `"แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า ว่างไหม"`. Expected: `bulkAvailability` dispatched with `{near: "Saraburi", terrain: "RIVE"}` (subset match — same `strictParams` reasoning as GEO-8: a real dispatched call always also carries a day-relative `dates` array that cannot be pinned to an exact static value).

Ran the REAL guardrail gate (`node -r dotenv/config node_modules/.bin/vitest run --config vitest.guardrail.config.ts`) against the live model TWICE locally — both green (all 12 guardrail cases including the new GEO-9 passed both times).

### Why bulkAvailability + terrain (not searchCampsites, not a plain near-only pin) — and why not the bare owner phrasing

Real-model sampling on the owner's EXACT query, unmodified (no "ว่างไหม" suffix), across THREE separate rounds during this story's iteration (5 + 5 + 5 = 15 real `/api/ai/chat` calls, recorded via `AssistantTurnLog`, full verbatim logs in the Behavioural verify section below):

| Round | Runs | bulkAvailability joined | near carried correctly |
|---|---|---|---|
| v1 (initial grounding clause) | 5 | 0/5 | n/a (searchCampsites only, near correct 5/5) |
| v2 (strengthened: no-absolute-date rule added) | 5 | 0/5 | n/a (searchCampsites only, near correct 5/5) |
| FINAL (negative worked contrast added) | 5 | 1/5 | yes (near="Saraburi", dates 2026-08-22..23) |

Total: **1/15 ≈ 6.7%** — even lower than CAM-716's own measured ~3/8 (37.5%) for the SAME phrasing family (CAM-716's 8-sample pool mixed in the "ว่างไหม"-suffixed variant; this story's 15 samples are the bare phrasing only). This confirms CAM-716's own conclusion generalizes: the pre-existing MUST availability-trigger sentence (CAM-505) is already not reliably obeyed by this small model on a phrasing with no explicit availability trigger word, and this story's own new SHOULD-level nudge (BR-3) — deliberately weaker, since a second unenforceable MUST adds nothing (BR-4) — does not change that ceiling in a way this sample size can detect. **Pinning a guardrail case on the bare phrasing to require a bulk/check join would be exactly the flaky gate CAM-716 already declined to ship** — same conclusion, independently re-derived.

Separately sampling the SAME query WITH an explicit "ว่างไหม" suffix (the pre-existing MUST trigger, CAM-505, independent of this story's own SHOULD nudge) — **5/5 real runs joined `bulkAvailability`**, every one carrying `near="Saraburi"` AND `terrain="RIVE"` correctly, with `dates` matching what `resolveDates` itself resolved (`2026-08-22`..`2026-08-23`). This is the reliable, mechanically feasible case — it proves an availability-bearing call CAN be made to join reliably for a dated-proximity ask (closing the honest half of the ticket's own question), just not for the AMBIGUOUS bare phrasing the incident itself used (which the grounding clause — not tool-routing — is what actually closes, per AC-4 below).

Per the ticket's own explicit escape valve ("if the model cannot be made to reliably join an availability call, say so and scope the fix to discipline-only with the offer-to-check path, recorded honestly"): for the BARE owner phrasing, the fix is scoped to discipline-only (the grounding clause, BR-1/BR-2) — proven by the zero-tolerance behavioural verify below, not by a tool-dispatch guardrail. The NEW golden case targets the phrasing where a reliable dispatch assertion is honest to make.

## Behavioural verify (real `/api/ai/chat` endpoint, real OpenRouter call, shared local dev DB)

Own dev server on `localhost:3032` (localhost:3000/3031 are other sessions). Dispatched-args ground truth read directly from the `AssistantTurnLog` table (not inferred from the visible answer alone). Today's date during every run: 2026-08-12 (Wednesday); `resolveDates("เสาร์หน้า")` resolves to `2026-08-22`..`2026-08-23` (Sat–Sun) throughout — confirms the resolver itself is correct and deterministic, consistent with CAM-716's own finding ("the resolver is NOT the bug; the prose is").

### Iteration 1 — v1 grounding clause (before the no-absolute-date strengthening)

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า` — 5 runs.

All 5 dispatched: `resolveDates({text:"เสาร์หน้า"})` then `searchCampsites({near:"Saraburi", terrain:"RIVE"})` — no availability call joined in any of the 5.

> Run 1: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจสำหรับการเข้าพักในวันที่ 22-23 สิงหาคมนี้ มีทั้งหมด 3 แห่งที่น่าสนใจ ได้แก่: [...] ถ้าสนใจอยากให้เช็ควันว่างให้ไหม บอกได้เลยนะว่าต้องการข้อมูลเพิ่มเติมเกี่ยวกับที่ไหน!"

Runs 2-5 were near-identical in shape (all restated "22-23 สิงหาคม" as the search-target date, none said "มีที่ว่าง", all closed with an offer to check).

**Finding:** no run said "มีที่ว่าง" (has availability) — the core incident phrase was NOT reproduced — but every run DID restate the resolveDates-computed absolute date ("22-23 สิงหาคม") in prose with no availability call behind it. This is a SOFTER version of the same risk class (a specific date in prose, un-grounded by any availability tool), which the v1 clause did not yet explicitly forbid (it only forbade the combined "free on a specific date" claim, not a bare date restatement). **Decision: strengthen the clause** (see Iteration 2).

### Iteration 2 — v2, strengthened to forbid ANY absolute-date restatement with no availability call

Same query, 5 runs. All 5 still dispatched `resolveDates` + `searchCampsites` only (0/5 bulk join).

> Run v2-1: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจอยู่ 3 ที่สำหรับเข้าพักเสาร์หน้า 22-23 สิงหาคมนี้นะ [...] ถ้าสนใจอยากให้เช็กวันว่างให้ไหม บอกได้เลยนะว่าช่วงไหนที่คุณสนใจ!"
> Run v2-2: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจสำหรับการเข้าพักเสาร์หน้า มีทั้งหมด 3 ที่ให้เลือก: [...] ถ้าสนใจที่ไหนหรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!"
> Run v2-3: (same shape as v2-2, "สำหรับการเข้าพักเสาร์หน้า", no absolute date)
> Run v2-4: (same shape as v2-2)
> Run v2-5: (same shape as v2-2)

**Finding:** 4/5 runs now correctly say only "เสาร์หน้า" (the camper's own phrase) with NO absolute date — the strengthened rule worked for 4/5. Run v2-1 still leaked "22-23 สิงหาคมนี้" once. **Decision: add ONE more concrete negative-worked-contrast reinforcement** (see Iteration 3, the FINAL/official run).

### Iteration 3 (FINAL, official zero-tolerance verify) — after the negative worked contrast

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า` — 5 fresh runs.

**Run 1** — dispatched: `resolveDates({text:"เสาร์หน้า"})`, `searchCampsites({near:"Saraburi", terrain:"RIVE"})`. No availability call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีสำหรับเข้าพักเสาร์หน้า มีทั้งหมด 3 ที่ที่น่าสนใจ: [...] ถ้าสนใจที่ไหนหรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!"
**PASS** — no ว่าง claim, no absolute date, honest offer.

**Run 2** — same tool calls, no availability call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวๆ สระบุรีสำหรับเข้าพักเสาร์หน้า มีทั้งหมด 3 ที่ที่น่าสนใจ: [...] แต่ละที่มีบรรยากาศติดน้ำและเหมาะสำหรับการพักผ่อนริมแม่น้ำ ถ้าสนใจให้ช่วยเช็ควันว่างให้ไหม บอกวันที่มาได้เลยนะ"
**PASS** — same shape; "บรรยากาศติดน้ำ" is a non-sourced embellishment (same category CAM-714's own test.md already noted as non-blocking small-model phrasing), not a date/availability claim.

**Run 3** — same tool calls, no availability call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีสำหรับเสาร์หน้า มีตัวเลือกที่น่าสนใจอยู่ 3 ที่ด้วยกัน: [...] ถ้าสนใจที่ไหนหรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!"
**PASS**.

**Run 4** — same tool calls, no availability call.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่น่าสนใจสำหรับเสาร์หน้า มีทั้งหมด 3 ที่ให้เลือก: [...] ถ้าสนใจที่ไหน หรืออยากให้เช็ควันว่างเพิ่มเติม บอกได้เลยนะ!"
**PASS**.

**Run 5** — dispatched: `searchCampsites({near:"Saraburi", terrain:"RIVE"})`, `resolveDates({text:"เสาร์หน้า"})`, **`bulkAvailability({near:"Saraburi", terrain:"RIVE", dates:[{startDate:"2026-08-22", endDate:"2026-08-23"}]})`** — the BR-3 routing nudge fired this time.
> "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคมนี้ มีหลายที่ให้เลือกเลยนะ [5 camps listed] ถ้าสนใจที่ไหนบอกได้เลยนะ เดี๋ยวเช็ควันว่างให้เพิ่มเติม!"
**PASS under the stricter AC-1 rule** — this run DID claim ว่าง + a date ("22-23 สิงหาคมนี้"), but a real `bulkAvailability` call joined THIS turn and its own `dates` argument (`2026-08-22`..`2026-08-23`) matches the claimed date exactly; the 5 cards returned are `bulkAvailability`'s own `cards[]` (only camps with ≥1 free cell), so the claim is genuinely grounded, not fabricated.

**Verdict AC-4: 5/5 PASS — zero occurrences of an ungrounded date/availability claim.** Either (a) no availability call joined and the answer named only เสาร์หน้า with an honest offer (runs 1-4), or (b) an availability call joined and the claimed date matched its real result exactly (run 5). **Never once did a run reproduce the "Wednesday-19 class" defect** (a claimed date with no tool behind it, or a claimed date that disagrees with what a joined tool actually returned).

### The "ว่างไหม" variant — confirms a reliable availability-bearing phrasing exists

Query: `แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า ว่างไหม` — 5 runs (informs the golden-case decision above).

All 5 dispatched: `resolveDates({text:"เสาร์หน้า"})` then `bulkAvailability({near:"Saraburi", terrain:"RIVE", dates:[{startDate:"2026-08-22", endDate:"2026-08-23"}]})` — **5/5 joined**, `near` and `terrain` both carried correctly every time.

> Run 1: "เราเจอลานกางเต็นท์ติดริมแม่น้ำแถวสระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคม มีให้เลือกหลายที่เลยนะ [...] ถ้าสนใจที่ไหน บอกวันที่ที่ต้องการไปได้เลยนะ เดี๋ยวเช็ควันว่างให้อีกที!"
> Run 2: (same shape, near/terrain/dates all correct)
> Run 3: "เราพบลานกางเต็นท์ติดริมแม่น้ำแถวๆ สระบุรีที่ว่างสำหรับเสาร์หน้า 22-23 สิงหาคม มีหลายที่ให้เลือกเลยนะ: [...] ทุกที่มีพื้นที่ว่างประมาณ 50 คน ลองบอกวันที่ที่ต้องการไปอีกทีนะ เดี๋ยวเช็คให้ว่ามีที่ว่างจริงไหม!" — a small over-claim ("พื้นที่ว่างประมาณ 50 คน" is not a real field `bulkAvailability` returns, likely a training-knowledge guess about typical capacity) alongside an otherwise-grounded ว่าง+date claim; flagged as a minor residual defect, NOT this story's BR/AC scope (BR-1 only governs the ว่าง/date claim itself, which IS grounded here — the capacity-number embellishment is a distinct, smaller-blast-radius issue, same category as CAM-714's noted non-blocking embellishments).
> Runs 4-5: same shape as runs 1-2, all grounded correctly.

**5/5 PASS.** This phrasing reliably grounds the golden case `GEO-9-CAM718-AVAILABILITY-BULK-JOIN` above.

### The four CAM-714 opener cases — regression check

Re-ran all four verbatim (CAM-714's own test.md, iteration-3 final):

1. `หาลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคนหน่อย` → "เราเจอลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนมาให้เลือกหลายที่เลย มีทั้งหมด 10 แห่งที่ตรงตามเงื่อนไขนี้ เช่น: [...] ถ้าสนใจที่ไหน หรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!" — **PASS** (fused reason+count, no banned opener, no ค่ะ; the trailing offer-to-check sentence is new since CAM-714 — that's this story's own BR-2 in action on a Zone-B-with-results turn that made no availability call, and it is honest: no date/ว่าง claim, just an offer).
2. `อยากได้ลานสายสบายๆ แถวชลบุรี` → "เราเจอลานสายสบายๆ แถวชลบุรีมาให้ 3 ที่นะ มีบรรยากาศริมทะเลและราคาเริ่มต้นที่ 700 บาทต่อคน ลองดูรายละเอียดได้เลย: [...] ถ้าสนใจที่ไหนหรืออยากให้เช็ควันว่างให้ บอกได้เลยนะ!" — **PASS** (names ชลบุรี correctly via `near:"Chon Buri"`; no false availability claim).
3. `อยากได้ลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วย` → dispatched `{keyword:"บรรยากาศโรแมนติก", petFriendly:true}`, 0 cards → "ไม่พบลานที่มีบรรยากาศโรแมนติกและพาสัตว์เลี้ยงไปได้เลย ลองปรับเงื่อนไขการค้นหา เช่น เปลี่ยนคำค้นหาหรือประเภทของลานดูไหม?" — **PASS** (zero-result path, unchanged, no availability claim to guard against).
4. `มีแคมป์ไหมคะ` → "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" — **PASS**, byte-identical to CAM-714's own pinned canonical broad-search phrasing.

**Verdict: all 4 hold, no regression from this story's two new clauses.** One incidental, honest observation: CAM-714-case-1/2 now also close with an offer-to-check sentence they didn't have before CAM-718 — this is the NEW BR-2 discipline correctly firing on a Zone-B-with-results turn that made no availability call, not a regression of CAM-714's own reason-sentence shape (which is unchanged and still opens each answer).

## Full suite (last act)

- `npm run lint` — 0 errors (pre-existing unrelated warnings only, incl. the `_ctx`/`_turnMeta` unused-param convention noted by CAM-716).
- `npx tsc --noEmit` — clean.
- `npm test` — full suite green: 490 passed | 5 skipped test files, 12462 passed | 25 skipped tests (the documented pre-existing `__tests__/delivery-client.test.ts` env-dependent exception, per CLAUDE.md's standing note).
- `ai:guardrail-gate` — green, run twice locally against the live model (both green; 12 guardrail cases incl. the new GEO-9).

## Cleanup

Dev server (port 3032) stopped; scratch script (`.scratch-cam718-run.mjs`) and the copied `.env` deleted before commit — neither rides the PR.
