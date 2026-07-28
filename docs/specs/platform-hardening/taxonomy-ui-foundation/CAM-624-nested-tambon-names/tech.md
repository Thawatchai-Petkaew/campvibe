---
linear: CAM-624
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — One tambon name contains another, and we may pick the wrong one (CAM-624)

## Measurement first (the ticket's own required step, before any code changed)

**Confirmed via CAM-611's own already-committed, already-passing test** (`__tests__/cam-611-subdistrict-structural-guard.test.ts`, its EC-5 block, pre-fix):
```
resolvePlace('ลานกางเต็นท์ท่าทองหลาง')                    -> {subDistrict:"ท่าทองหลาง", district:"บางคล้า"}   (already correct)
resolvePlace('เมื่อวานนี้ไปท่าทองหลางเยี่ยมญาติมา')          -> {subDistrict:"ทองหลาง",   district:"บ้านนา"}    (WRONG — different place, different province)
resolvePlace('ลานกางเต็นท์ท่าหินโงม')                      -> {subDistrict:"ท่าหินโงม",  district:"เมืองชัยภูมิ"} (already correct)
resolvePlace('เมื่อวานนี้ไปท่าหินโงมเยี่ยมญาติมา')           -> {subDistrict:"หินโงม",    district:"เมืองหนองคาย"} (WRONG — different place, different province)
```
**Answer to the ticket's central question:** with a camping-context marker present, the longer name already wins (candidates are sorted longest-`nameTh`-first, `detectSubDistrict` returns on the FIRST match — the same idiom `detectProvince`/`detectRegion`/`detectLandmark`/`detectDistrict` already use). The defect is narrower than "which name wins" — it is CAM-611's own `requiresCampingContext` guard: when it SKIPS the longer candidate for lacking camping context, the pre-existing "skip and keep scanning" idiom (needed elsewhere, e.g. so an unrelated candidate later in the same sentence can still match) lets the SHORTER, embedded, unguarded candidate fire in its place — even though its only reason for matching is that it is a literal substring of the rejected longer one.

**This is a real, observable wrong answer** — a bare or narrative mention of either tambon (no camping word in the sentence, plausible: a follow-up reply to "where do you want to camp?", or an unrelated sentence that happens to contain the substring) is silently redirected to a different real place in a different province. Not "may be small" — confirmed. Fix required.

## Why 12 pairs exist but only 2 misfire (measured, not assumed)

Re-scanned the FULL, filtered candidate set `buildSubDistrictCandidates()` already produces (503-row shortlist, after the existing length-floor/vocab/substring-of-province guards) for every pair where one surviving name is a proper substring of another:

| # | Longer (parent) | Shorter (embedded child) | Parent `requiresCampingContext`? | Parent `entries.length` | Misfires today? |
|---|---|---|---|---|---|
| 1 | ปากน้ำแหลมสิงห์ | ปากน้ำ | No | 1 | No — parent always wins unconditionally |
| 2 | **ท่าทองหลาง** | **ทองหลาง** | **Yes (`ท่า`)** | 1 | **Yes — confirmed above** |
| 3 | เสม็ดใต้ | เสม็ด | No | 1 | No |
| 4 | เสม็ดเหนือ | เสม็ด | No | 1 | No |
| 5 | หนองไผ่แก้ว | หนองไผ่ | No | 1 | No |
| 6 | **ท่าหินโงม** | **หินโงม** | **Yes (`ท่า`)** | 1 | **Yes — confirmed above** |
| 7 | กะลุวอเหนือ | กะลุวอ | No | 1 | No |
| 8 | ถ้ำทองหลาง | ทองหลาง | No | 1 | No |
| 9 | บางพระเหนือ | บางพระ | No | 1 | No |
| 10 | ห้วยยางโทน | ห้วยยาง (2 entries) | No | 1 | No — parent (unguarded, single-entry) always fires first |
| 11 | เวียงยอง | เวียง (2 entries) | No | 1 | No — same reason |
| 12 | บางกระสอบ | บางกระสอ | No | 1 | No |

Only pairs #2 and #6 have a `requiresCampingContext` PARENT — the exact CAM-611 guard — which is why only these two are an observed misfire: for the other 10, the unguarded, single-entry parent is checked first (sorted longest-first) and returns immediately, so its shorter sibling is never even reached in the loop. **This confirms the "longer wins" property already holds everywhere it can — the gap is specifically where a guard (or, hypothetically, an unresolved ambiguity) makes the longer candidate skip.**

## Fix — general rule, argued against a two-name patch

**Chosen: a general "shadowed by a longer surviving candidate" rule**, not a third/fourth hardcoded name pair, for the same reason CAM-611's own docblock already states the standing lesson (`.claude/rules/code.md`): substring collisions over Thai text "are obvious only afterwards." A hardcoded pair only protects the two names known TODAY; the next `scripts/generate-subdistrict-shortlist.mjs` regeneration (CAM-606 already grew the list 422→503 once) can introduce a NEW embedding pair with zero code change needed to notice it — the general rule is DATA-DRIVEN (computed from the same candidate list already built) and self-updating, closing the family instead of extending it by one more special case each time.

**Where it lives:** entirely inside `lib/ai/place-resolver.ts`'s own `buildSubDistrictCandidates`/`detectSubDistrict` — NOT `lib/geo/admin-area-match.ts`. That file's `matchAdminArea` is the DB-backed resolver for an ALREADY-DECIDED argument (the model's own `subDistrict` string, or an already-isolated free-text detection result) — it does exact/fuzzy lookup, never free-text substring scanning across arbitrary camper prose, so this exact collision shape (one candidate's spelling accidentally embedding another's, discovered only by scanning raw text) cannot occur there. Per the dispatch's own STOP rule (non-AI callers use that file), it is untouched.

**Implementation** (`lib/ai/place-resolver.ts`):
```ts
function buildSubDistrictShadowParents(
  candidates: readonly SubDistrictCandidate[]
): ReadonlyMap<string, readonly string[]> {
  const names = candidates.map((c) => c.nameTh);
  const shadowParents = new Map<string, string[]>();
  for (const name of names) {
    const parents = names.filter((other) => other !== name && other.includes(name));
    if (parents.length > 0) shadowParents.set(name, parents);
  }
  return shadowParents;
}

const SUBDISTRICT_SHADOW_PARENTS_BY_NAME = buildSubDistrictShadowParents(SUBDISTRICT_CANDIDATES_BY_LENGTH_DESC);

function isShadowedByLongerSubDistrict(nameTh: string, text: string): boolean {
  const parents = SUBDISTRICT_SHADOW_PARENTS_BY_NAME.get(nameTh);
  if (!parents) return false;
  return parents.some((parent) => text.includes(parent));
}
```
`detectSubDistrict`'s unmarked loop gains ONE new `continue` condition, checked before the existing camping-context guard (a correctness/precedence rule, not a context-intent rule):
```ts
if (!text.includes(candidate.nameTh)) continue;
if (isShadowedByLongerSubDistrict(candidate.nameTh, text)) continue;   // NEW (CAM-624)
if (candidate.requiresCampingContext && !hasCampingContextMarker(text)) continue;
```
The explicit `ตำบล`-marker path (`detectExplicitSubDistrictPrefix`) is untouched — verified, not assumed: the marker requires direct adjacency (`ตำบล` immediately followed by the name, no characters between), so for `text = 'ตำบลท่าทองหลาง'`, the substring `'ตำบลทองหลาง'` (marker directly followed by the CHILD name) is never present — the `ท่า` in between breaks it. No embedded-child collision can occur on the marked path by construction.

## Behavioral verification (every case run for real, no model call — this fix never touches the AI layer's tool-calling surface, only the deterministic free-text pre-pass)

### The two confirmed pairs
| Phrasing | Before this fix | After this fix |
|---|---|---|
| `ลานกางเต็นท์ท่าทองหลาง` (camping context) | `{subDistrict:"ท่าทองหลาง", district:"บางคล้า"}` | unchanged |
| `เมื่อวานนี้ไปท่าทองหลางเยี่ยมญาติมา` (no camping context) | `{subDistrict:"ทองหลาง", district:"บ้านนา"}` ❌ | `{}` ✅ |
| `ลานกางเต็นท์ทองหลาง` (genuine mention of the OTHER real place) | `{subDistrict:"ทองหลาง", district:"บ้านนา"}` | unchanged — still resolves |
| `ลานกางเต็นท์ท่าหินโงม` (camping context) | `{subDistrict:"ท่าหินโงม", district:"เมืองชัยภูมิ"}` | unchanged |
| `เมื่อวานนี้ไปท่าหินโงมเยี่ยมญาติมา` (no camping context) | `{subDistrict:"หินโงม", district:"เมืองหนองคาย"}` ❌ | `{}` ✅ |
| `ลานกางเต็นท์หินโงม` (genuine mention of the OTHER real place) | `{subDistrict:"หินโงม", district:"เมืองหนองคาย"}` | unchanged — still resolves |

### Representative already-safe pairs (unaffected, confirming the general rule doesn't over-reach)
`เมื่อวานนี้ไปปากน้ำแหลมสิงห์เยี่ยมญาติมา` → `{subDistrict:"ปากน้ำแหลมสิงห์", district:"แหลมสิงห์"}` (unchanged — parent unguarded, wins unconditionally, exactly as before) · `เมื่อวานนี้ไปเวียงยองเยี่ยมญาติมา` → `{subDistrict:"เวียงยอง", district:"เมืองลำพูน"}` (unchanged, despite embedding the 2-entry ambiguous `เวียง`).

### Standing regression set — re-run, all unchanged
CAM-600's six negatives (`ริมถนน`/`ใกล้ตลาด`/`ริมบ่อ`/`ทางเหนือ`/`ที่สะอาด`/`บรรยากาศสำราญ` → all `{}`) · CAM-609's `ตำนาน` pair (`เต็นท์รุ่นตำนาน` → `{}`; `ตำบลตำนาน` → resolves) · CAM-611's three words (`เหนือเมือง`/`เสาธง`/`รังนก`, bare → `{}`) · siblings `แม่ริม` (district) / `อำเภอปาย` (district) / `เชียงใหม่` (province) / `ใกล้เขาใหญ่` (`{}`) / `ป่าตอง` (sub-district) / `หมูสี` (sub-district) — all byte-identical. Full command: `__tests__/cam-624-nested-tambon-names.test.ts` (25 assertions) + the full suite (11,006 tests) green.

### Necessary, disclosed test-file consequence
`__tests__/cam-611-subdistrict-structural-guard.test.ts`'s own EC-5 block asserted the (buggy) neutral-phrasing result and explicitly labelled it "found, not fixed." Those 2 assertions are updated to the now-correct `{}` in this PR — the other 71 assertions in that file are untouched and still pass. This mirrors the standing precedent in `.claude/rules/qa.md`'s own rationalization table ("updating them to the new canonical class is correct, NOT weakening").

## New finding: the SAME family recurs across levels (reported, not fixed — see story.md "Out of scope")

Checked whether the general "longer wins" property also held at the DISTRICT level, and in doing so found a bigger, DIFFERENT-shaped gap: `resolvePlace` checks sub-district candidates BEFORE district candidates (CAM-600's own established precedence), so a shortlisted SUB-DISTRICT name that is a substring of an unrelated DISTRICT'S name can shadow the district entirely:
```
resolvePlace('เมื่อวานนี้ไปบ้านนาสารเยี่ยมญาติมา')   -> {subDistrict:"บ้านนา", district:"เมืองชุมพร"}   (real district: Ban Na San, Surat Thani — WRONG place)
resolvePlace('เมื่อวานนี้ไปบ้านนาเดิมเยี่ยมญาติมา')   -> {subDistrict:"บ้านนา", district:"เมืองชุมพร"}   (real district: Ban Na Doem, Surat Thani — WRONG place)
resolvePlace('เมื่อวานนี้ไปแม่ลาน้อยเยี่ยมญาติมา')     -> {subDistrict:"แม่ลา", district:"บางระจัน"}      (real district: Mae La Noi, Mae Hong Son — WRONG place)
```
**Confirmed pre-existing, not caused by this story's fix**: re-ran the identical probe against `origin/dev` (this branch's own merge-base, before any change in this PR) and got byte-identical results. This is a CROSS-LEVEL shape (sub-district shadowing district), distinct from this ticket's own scope (sub-district shadowing sub-district) — closing it would need either a cross-level shadow map or a change to `resolvePlace`'s own precedence order, a larger and more invasive change than this story's file surface, budget, and cost cap (real-model guardrail gate) allow. Reported here per the "report what you find even if you only fix this one" standard this arc has followed since CAM-606; not filed as a ticket by this dispatch (that decision belongs to the orchestrator/PO, per the dispatch's own instruction to report and stop rather than spend further).

Separately checked: 22 embedding pairs also exist WITHIN the district candidate list itself (same-level, e.g. `เขตจอมทอง`⊃`จอมทอง`, `บ้านนาสาร`⊃`บ้านนา`). Isolating them from the cross-level noise above, none is an observed same-level misfire — every district-level parent in the measured set is unguarded (`requiresCampingContext=false`, none starts with `เมือง`/`ท่า`) and effectively single-entry (`buildAdminAreaCandidates` dedupes by name with no ambiguity-resolution mechanism at all, unlike sub-district), so it always wins unconditionally, exactly the same "10 safe pairs" shape already measured at the sub-district level. No evidence of a live same-level bug there → no code added, per the standing "measured zero, not added" precedent (CAM-611 BR-3).

## ADRs
None new. Extends the existing "sort candidates longest-first, return on first match" idiom (already used for province/region/landmark/district/sub-district lists) with a shadow-parent guard that survives a guard/ambiguity skip on the longer candidate — the missing piece that idiom didn't yet cover. Confirmation: `__tests__/cam-624-nested-tambon-names.test.ts` (25 assertions, all AC/EC rows) + 2 updated assertions in `__tests__/cam-611-subdistrict-structural-guard.test.ts` (disclosed) + full existing suite (11,006 tests, 3 pre-existing skips) re-run green as the final act. No real-model guardrail gate run was needed to REACH this fix (the whole defect and its resolution live in the deterministic, synchronous pre-pass with zero DB/model calls) — the gate still runs once per the repo's standard CI gate on the PR itself, per `.claude/rules/api.md`/`.claude/rules/security.md`'s standing requirements, not looped.

## Links
`../CAM-611-subdistrict-structural-guard/tech.md` (found this, EC-5, deliberately left unfixed) · `../CAM-600-tambon-shortlist/tech.md` (the candidate-ranking mechanism extended here) · `../CAM-609-tamnan-false-hint/tech.md` (the "found it, said so, didn't fix it" precedent) · `lib/ai/place-resolver.ts` · `story.md`

## Changelog
- v1 (2026-07-28) — created; documents the measurement, the 12-pair table, the general shadow-parent fix, the full verification, and the new cross-level finding (reported, not fixed).
