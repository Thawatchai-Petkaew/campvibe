# CAM-714 — Test & Verify

## Source-level pins

`__tests__/cam-714-reason-sentence-rewrite.test.ts` (new, 22 tests, all green) — pins the mechanics not already covered by the updated CAM-709 pin test: SHAPE/fusion framing, the never-names-a-campsite guard, the FLAT no-invented-location rule's position + wording, petFriendly/type dimension coverage, the bulkAvailability `ranges`-only sourcing + degrade-to-dates+count, the flat no-parenthesis rule + truncation carve, the never-claim/never-mirror-mood rule with the worked petFriendly/โรแมนติก scenario, the broad-search branch, the skip-when-no-call rule, the old parroted exemplar's absence, the 5-item banned-opener list, the 3 never-copy examples + vary-instruction, the in-clause voice spec, the anti-list bans, the :691 register fix, and the must-survive neighbours (`MAX_TOKENS`, :656 anti-enumeration, :459 3-zone policy).

`__tests__/cam-709-openrouter-honest-scope-extend.test.ts` (updated, 12 tests, all green) — its original 2 tests' assertions are rewritten to match the new clause's actual phrasing (the honesty content survives, just reworded per the ratified synthesis — not a weakening); 4 new tests added checking petFriendly/type coverage, the old exemplar's removal, the banned-opener list, the 3 examples + voice spec, the parenthesis truncation, and the bulkAvailability provision.

`__tests__/cam-415-adversarial-verify.test.ts` — dated note added at the byte-round-trip test (per the PINS instruction); no assertion change needed — its round-trip is a self-referential identity substituting only the CAM-415 guard sentence, and never asserted against :700/:691 content (empirically verified: 16/16 still green after both edits).

## Superseded pins

- `__tests__/cam-709-openrouter-honest-scope-extend.test.ts` — 2 of its original assertions (`toContain('explaining why this set of camps was chosen')`, `toContain('Do NOT restate, acknowledge, or mirror the camper's own request wording in this sentence')`, `toContain('say plainly that this was a broad, general search...')`, `toContain('use ONLY each entry\'s \`labelTh\`...')`) updated to the new clause's actual wording — same rule, same or greater strength, different phrasing (the CAM-714 ratified synthesis rewrote the honesty spine's SENTENCES while keeping every constraint, per the dossier's judged synthesis).

## Behavioural verify (real `/api/ai/chat` endpoint, real OpenRouter call, dev DB — CAM-500 lesson: never trust a diff read for a prompt change)

Own dev server on `localhost:3029` (localhost:3000 is the owner's), pointed at the shared local dev Postgres. This story went through **3 iterations** — the first prompt landed clean on the 4 CAM-709 cases, but two independent real-model runs on OTHER queries surfaced a genuine honesty gap (a fabricated province name) that the CAM-709 cases alone did not probe. Both iterations are recorded below in full, not hidden, per the "never fabricate a metric — report measured numbers" rule.

### Iteration 1 (first landed clause) — the 4 CAM-709 cases

**AC-1, water + price** — `หาลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคนหน่อย`
> "เราหาลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนมาให้แล้ว มีหลายที่ให้เลือก เช่น: [...]" (10 cards)

PASS — no banned opener, no ค่ะ, first person เรา, criteria fused with found-count, no raw code/parenthesis.

**Province+style** — `อยากได้ลานสายสบายๆ แถวชลบุรี`
> "เราเจอลานสายสบายๆ แถวชลบุรีมาให้ 3 ที่นะ มีบรรยากาศริมทะเลและชายหาดที่น่าสนใจ: [...]" (3 cards)

PASS — different opening verb (เจอ vs หา above), no banned opener, no ค่ะ.

**AC-2 honesty probe, pet+romantic** — `อยากได้ลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วย`
> "เราเจอลานที่บรรยากาศดีและพาสัตว์เลี้ยงไปได้ด้วยนะ มีหลายที่ให้เลือก เช่น..." (10 cards, `matchedTag: null` on every card — confirms ONLY `petFriendly` was ever a real filter, no taxonomy code was set for "romantic")

PASS on the hard constraint (the word โรแมนติก does not appear; no raw taxonomy code). Observation: the model added "บรรยากาศดี" (generic "nice atmosphere") as mild, non-sourced embellishment — not a paraphrase of "โรแมนติก" specifically (it's the kind of generic filler that could describe any pleasant camp), but it is technically beyond "speaks only of the pet criterion." Noted, not blocking — the OLD clause's own AC-2 needed 3 attempts to reliably pass per CAM-709's test.md; small-model phrasing compliance is probabilistic, not a regression.

**AC-3, broad search** — `มีแคมป์ไหมคะ`
> "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" (0 cards, `searchAttempted` fired with empty `appliedFilters`)

PASS — this exact case matched my own illustrative broad-search shape verbatim (the ONE place in the clause where an exact-copy is licensed by design, since `appliedFilters` empty is the one condition where a single canonical honest phrasing is intentional and safe).

**Same broad query, different phrasing** — `แนะนำที่กางเต็นท์หน่อย` (run twice)
> Run 1: "เราหาที่กางเต็นท์มาให้แล้ว มีหลายที่ที่น่าสนใจในนราธิวาสและยะลา เช่น: [...]"
> Run 2 (same query): "เราหาที่กางเต็นท์ให้แล้ว มีหลายที่น่าสนใจในนราธิวาสและยะลา เช่น "ทะเลสาบเขื่อนนราธิวาส" [...]"

**FAIL (both runs)** — the opening sentence names "ในนราธิวาสและยะลา" as if it were a searched location, when this is a genuinely broad, unfiltered search (no province/region/near ever passed) — the model narrated a location it merely observed from the top of an unfiltered, unordered result set. This is a real honesty defect the 4 named CAM-709 cases never happened to probe (since AC-3's own phrasing, "มีแคมป์ไหมคะ", triggers the licensed broad-search shape reliably; a differently-worded broad ask does not).

### Iteration 2 — targeted fix, re-verify

Added a location-honesty guard mid-paragraph ("never state or imply a province... unless it is the exact `appliedFilters.province`/`near`/`region` value"). Restarted the dev server (confirmed necessary — Next dev does NOT always pick up an edited server-module string on the next request without a full restart; a stale-server false negative was caught and corrected here).

`แนะนำที่กางเต็นท์หน่อย` (re-run): `"เราหาที่กางเต็นท์ให้แล้ว มีหลายที่น่าสนใจ เช่น "ทะเลสาบเขื่อนนราธิวาส" [...]"` — **FIXED**, no location claim.

But a **different** query then reproduced the SAME class of miss: `อยากได้ลานแบบแกลมปิ้งราคาไม่เกิน 1000 บาท` (a glamping+price query whose 10-camp result pool happens to concentrate in 2 provinces):
> "เราเจอลานแบบแกลมปิ้งที่ราคาไม่เกิน 1000 บาท มีให้เลือกหลายที่เลยนะ โดยเฉพาะในนราธิวาสและยะลา ที่น่าสนใจมีดังนี้: [...]"

**FAIL** — same defect, different query. The nuanced "never infer" phrasing measurably under-held.

### Iteration 3 — flat-rule rewrite (final)

Per the dossier's own core finding ("string-level/flat bans are the one lever this model has repeatedly been proven to obey — the โรแมนติก ban and the parenthesis ban both worked once explicit"), rewrote the guard as an absolute FLAT rule, relocated to sit immediately after the never-names-a-campsite guard (early in the clause — a small model's mid-clause attention is weaker, per the same dossier): *"FLAT RULE: if `appliedFilters` carries no `province`/`near`/`region`/`district`/`subDistrict` this turn, this sentence contains NO province, region, or place name at all — not even one the returned camps merely happen to share — full stop."*

Restarted the dev server again. Re-ran the glamping+price query 2 more times:

> Run 1: `"เราเจอลานแกลมปิ้งที่ราคาไม่เกิน 1000 บาท มีให้เลือกหลายที่เลยนะ ที่น่าสนใจได้แก่: [...]"` — CLEAN, no location.
> Run 2: `"เราเจอลานแบบแกลมปิ้งที่ราคาไม่เกิน 1000 บาท มีให้เลือกหลายที่เลยนะ โดยเฉพาะในนราธิวาสและยะลา ที่น่าสนใจมีดังนี้: [...]"` — STILL FAILS.

**Honest conclusion**: the flat rule measurably *improves* reliability (multiple other broad/no-location queries — `แนะนำที่กางเต็นท์หน่อย`, `มีแคมป์ไหมคะ` — are now consistently clean; see the final full run below) but does **not** guarantee zero location-fabrication on every possible query shape. This specific glamping+price query, whose small result pool happens to concentrate geographically, remains a stubborn residual case (~50% in this sample). This is a real, honestly-reported limitation of prompt-only enforcement on a small model, not a fabricated "100% fixed" claim. Flagged in story.md's Out of scope for a possible follow-up (a server-side validation/strip pass), since a fully deterministic fix is a code change outside this story's prompt-only surface.

This finding is **not** one of the ticket's 4 required CAM-709 cases or the Saraburi case — it surfaced from my own additional exploratory queries during behavioural verify, and is reported here in the spirit of "verify behaviourally, never trust a diff read" even though it goes beyond the literal `done_when` checklist.

## Final clean run (current, shipped code) — all required cases

Dev server restarted fresh; all cases below run consecutively against the FINAL clause, no further edits after.

**AC-1, water+price** — `หาลานกางเต็นท์ริมน้ำ ราคาไม่เกิน 500 บาทต่อคืนต่อคนหน่อย`
> "เราหาลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนมาให้แล้ว มีหลายที่ให้เลือก เช่น: [...]" (10 cards)

PASS.

**Province+style** — `อยากได้ลานสายสบายๆ แถวชลบุรี`
> "เราเจอลานสายสบายๆ แถวชลบุรีมาให้ 3 ที่นะ มีบรรยากาศริมทะเลที่น่าสนใจ: [...]" (10 cards, 3-camp taxonomy match named in the answer)

PASS.

**AC-2 honesty probe, pet+romantic** — `อยากได้ลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้ด้วย`
> "ไม่พบลานที่มีบรรยากาศโรแมนติกและพาสัตว์เลี้ยงไปได้เลย ลองปรับเงื่อนไขการค้นหา เช่น เปลี่ยนคำค้นหาหรือเพิ่มรายละเอียดอื่น ๆ ที่ต้องการดูไหม?" (0 cards this run)

Note: this exact phrasing is non-deterministic across runs — sometimes the model finds 0 matches (a different code path, CAM-437's zero-result honesty at :664, which is NOT governed by :700's mood-mirroring ban since :700 only fires when results exist) and sometimes 10 (the CAM-709/714 case, verified clean above and in Iteration 1). The zero-result path mentioning "โรแมนติก" here is honest in spirit — it is telling the camper nothing was found for the full ask (including the unmapped romantic part), not falsely claiming a filter matched — a materially different failure class from claiming an unapplied criterion produced real results. Confirmed via `matchedTag: null` on every returned card in the non-zero runs (Iteration 1 and the re-check below) that no taxonomy code was ever set for "romantic."

Re-check (non-zero run, current code): `หาลานบรรยากาศโรแมนติกที่พาสัตว์เลี้ยงไปได้` →
> "เราหาลานที่พาน้องหมาไปได้มาให้ 10 ที่ แต่ไม่มีข้อมูลเกี่ยวกับบรรยากาศโรแมนติกในผลลัพธ์นี้ ลองดูที่ที่พาน้องหมาไปได้ เช่น..."

Sentence 1 (the :700-governed opening sentence) is clean: "เราหาลานที่พาน้องหมาไปได้มาให้ 10 ที่" — names only the pet criterion, no โรแมนติก. Sentence 2 is a separate, honest no-data disclosure (:674's rule — genuinely no romantic-atmosphere data tracked), not a :700 violation. PASS on the AC-2 constraint as scoped (the opening sentence).

**AC-3, broad search** — `มีแคมป์ไหมคะ`
> "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" (0 cards)

PASS.

**Saraburi (bulkAvailability)** — `ลานกางเต็นท์ติดริมแม่น้ำ ว่างเสาร์นี้ แถวๆ สระบุรี`
> "เราพบลานกางเต็นท์ติดริมแม่น้ำในแถวสระบุรีที่ว่างสำหรับเสาร์นี้นะ มีทั้งหมด 4 ที่ให้เลือก ได้แก่: [...]" (20 cards from the underlying searchCampsites call; 4 named as free)

PASS on all CAM-714-governed properties — no banned opener, no ค่ะ, first person เรา, uses "แถว" (proximity register) not "ใน" (matches :691's near-vs-in honesty distinction — the camper said "แถวๆ สระบุรี", a proximity phrasing), date sourced from a real availability check. Observation: "ได้แก่:" is a colon-introduced list run-up my clause explicitly bans as a category — a partial miss shared with the pre-existing, explicitly out-of-scope :656 anti-enumeration tension (same category CAM-709's own test.md flagged as "known violated today").

**Variety check** — 3 distinct criteria-bearing questions, run consecutively:
1. `มีลานพาสัตว์เลี้ยงไปได้ในเชียงใหม่ไหม` → `"เราเจอลานกางเต็นท์ที่พาสัตว์เลี้ยงไปได้ในเชียงใหม่มาให้ 10 ที่ โดยส่วนใหญ่ตั้งอยู่ในอำเภอแม่ริมและแม่ออน ราคาเริ่มต้นที่ 150 บาทต่อคน ลองดูรายละเอียดเพิ่มเติมในลิสต์ด้านล่างนะ"`
2. `หาลานกางเต็นท์ในป่าที่มีกิจกรรมเดินป่าหน่อย` → `"เราเจอลานกางเต็นท์ในป่าที่มีกิจกรรมเดินป่าให้เลือกหลายที่เลยนะ มีทั้งหมด 10 ที่ที่น่าสนใจ เช่น\n\nต้นน้ำชานเมืองตรัง (Trang Riverside Camp 3) ราคาเริ่มต้นที่ 250 บาทต่อคืน [...]"`
3. `ขอลานที่มีน้ำอุ่นใช้ด้วยได้ไหม` → `"เราเจอลานที่มีน้ำอุ่นให้ใช้ด้วยนะ มีทั้งหมด 10 ที่ที่น่าสนใจ เช่น "หาดชายฝั่งเงียบนราธิวาส" และ "อ่าวเล็กปลายแหลมนราธิวาส" ซึ่งทั้งสองแห่งตั้งอยู่ในจังหวัดนราธิวาส [...]"`

Programmatic check (Python, on the 3 raw answers):
- distinct openers: **True** (3 distinct full strings; first words after เรา are เจอ/เจอ/เจอ but full openers diverge immediately after — "เจอลานกางเต็นท์ที่พาสัตว์เลี้ยงไปได้ในเชียงใหม่" vs "เจอลานกางเต็นท์ในป่าที่มีกิจกรรมเดินป่า" vs "เจอลานที่มีน้ำอุ่นให้ใช้ด้วย")
- starts with a banned opener: **False** for all 3
- ends in ค่ะ/ครับ: **False** for all 3

VARIETY CHECK PASSES per the ticket's exact bar. Observation (not a :700 violation): case 3's second sentence names "จังหวัดนราธิวาส" — but this is inside the enumeration listing the actual card names (which literally include "นราธิวาส" in their own names, e.g. "อ่าวเล็กปลายแหลมนราธิวาส") — a true statement about the named entities, not a fabricated search-scope claim, and outside the ONE opening sentence :700 governs.

## Must-survive neighbours — confirmed unchanged

`MAX_TOKENS` = 680 (pinned, green). `:656` anti-enumeration clause byte-identical (pinned, green). `:459` 3-zone answer policy byte-identical (pinned, green). `matchedTag`/CAM-564 machinery untouched (no file in that surface edited). `appliedFilters` echo mechanics in `lib/ai/tools/search-campsites.ts` and `lib/ai/tools/bulk-availability.ts` — read-only inspected, zero lines changed (prompt-only story, confirmed via `git status --short`: only `lib/ai/openrouter-client.ts` + 3 test files touched).

## Full suite (last act)

`npx vitest run __tests__/` — 486 files passed / 5 skipped, 12420 tests passed / 1 failed / 22 skipped.

The 1 failure — `__tests__/cam-650-pricing-unit-schema.test.ts` ("an existing (seeded) CampSite row defaults priceUnit to PER_SITE without ever setting it", expected `PER_SITE` got `PER_PERSON`) — is a real-DB test (`describe.skipIf(!hasRealDb)`) that reads `prisma.campSite.findFirst()` (whichever row is first in the SHARED local dev Postgres) and asserts a specific `priceUnit`. Confirmed unrelated to this diff: `git status --short` shows exactly 4 files touched (`lib/ai/openrouter-client.ts` + 3 `__tests__/cam-7{09,14,415}*` test files), none in the CampSite/pricing surface; `search-campsites.ts`/`bulk-availability.ts` are read-only (grepped, zero `update`/`create`/`delete`/`upsert` calls) so this story's behavioural verify calls could not have mutated that row. This is pre-existing drift on the shared dev DB (per `.claude/rules/ops.md`, "the owner's localhost points here" — many concurrent worktree agents write to the same local Postgres), the same category as the documented "known pre-existing failure, env-dependent — ignore it and note it in the PR" rule for `__tests__/delivery-client.test.ts`. Reproduced in isolation (consistent, not flaky) — noted here for QA/DevOps, not chased (out of this story's file surface).

`npm run lint` — 0 errors (360 pre-existing warnings, unrelated files). `npm run typecheck` — clean. `npm run build` — clean (all routes compile).
