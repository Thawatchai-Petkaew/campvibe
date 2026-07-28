---
linear: CAM-611
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Sub-district detection is missing the structural guard its district sibling has (CAM-611)

## Data model
No new entity/field, no migration. `lib/ai/place-resolver.ts` only:
- `SubDistrictCandidate` interface gains `requiresCampingContext: boolean`, computed in `buildSubDistrictCandidates()` from data already imported (`prisma/data/subdistrict-shortlist.json`).
- `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` gains three entries: `เหนือเมือง`, `เสาธง`, `รังนก`.
- `resolveAmbiguousSubDistrictEntry`'s parameter type widened from the concrete `SubDistrictCandidate` to `Pick<SubDistrictCandidate, 'nameTh' | 'entries'>` — a pure type-level change (no behavior change) required because it is called with BOTH `SubDistrictCandidate` (now carrying the new field) and `ExplicitSubDistrictPrefixCandidate` (which deliberately does not).

## Guard vs vocabulary — the decision, and why (ticket's own required call)
Two independent mechanisms already exist in this file, and this story adds to each exactly once, never blurring which is which:

1. **Structural guard** (`requiresCampingContext`, reused from CAM-596's `AdminAreaCandidate`/`buildAdminAreaCandidates`, `CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH = ['เมือง', 'ท่า']`) — protects a whole CLASS of names built from a very common component. Ported to `SubDistrictCandidate` unchanged: same constant, same `hasCampingContextMarker` check, same "skip and keep scanning" idiom `detectDistrict` already uses. Zero new prefixes, zero new logic shape.
2. **Vocabulary skip-set** (`AMBIGUOUS_SUBDISTRICT_VOCAB_TH`) — protects INDIVIDUAL ordinary words that are not a `เมือง`/`ท่า`-prefixed name at all.

**Verified before writing any vocabulary entry** (not assumed): `เหนือเมือง`, `เสาธง`, `รังนก` were checked against `CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH` — none starts with `เมือง` or `ท่า` (they start with `เหนือ`/`เสา`/`รัง`). The structural guard therefore **cannot** subsume any of the three; each needs its own vocabulary entry. This is the ticket's own required decision, answered by measurement rather than by inspection alone — reversed, adding all three as vocabulary entries WITHOUT first checking the structural guard's reach would have been the "duplicates what a guard already covers" failure mode the ticket warned against; measuring first shows there is no overlap to worry about (confirmed: none of `เหนือ`/`สะอาด`/`สำราญ`/`ตำนาน`, the four pre-existing vocab entries, starts with `เมือง`/`ท่า` either — the two mechanisms have never overlapped and still don't after this story).

## Guard #4 equivalent — measured, not added (ticket's own explicit instruction)
CAM-596's district-level guard #4 (`nameTh === 'เมือง' + province.nameTh`, the provincial-capital-naming redundancy pattern, 75/77 provinces at the district level) was checked against the CURRENT 503-row `subdistrict-shortlist.json`:

```
matches = shortlist.filter(e => e.nameTh === ('เมือง' + e.provinceNameTh))
-> [] (0 rows)
```

Per the ticket's own instruction ("if none exists today, say so rather than adding a guard for nothing"), this guard is **not added**. The two `เมือง`-prefixed survivors in the current shortlist are `เมืองปอน` (Khun Yuam district, Mae Hong Son) and `เมืองเก่า` (Mueang Sukhothai district, Sukhothai) — neither is `เมือง` + its own province's full name, so guard #4 has nothing to catch here. This is recorded so a future shortlist regeneration that DOES introduce such a name has a documented place to look, rather than a silent, un-investigated gap.

## Detection algorithm — the one change, reusing CAM-596's mechanism verbatim
`buildSubDistrictCandidates()` now tags every surviving candidate:
```
requiresCampingContext: CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH.some((prefix) => nameTh.startsWith(prefix))
```
`detectSubDistrict()`'s unmarked loop gains one line, identical in shape to `detectDistrict`'s own:
```
if (candidate.requiresCampingContext && !hasCampingContextMarker(text)) continue;
```
Nothing in `lib/geo/admin-area-match.ts` (the shared `matchAdminArea`) changes — this pre-pass stays exactly as synchronous/DB-free as CAM-596/CAM-600 established, per those stories' own tech.md reasoning (unchanged, re-confirmed, not re-derived).

The explicit `ตำบล`-marker path (`detectExplicitSubDistrictPrefix`/`buildExplicitSubDistrictPrefixCandidates`, CAM-609) is **untouched** — it never carried a `requiresCampingContext` field (mirrors CAM-599's district-level explicit-marker candidate, which also has none) — an explicit marker is itself sufficient context. Confirmed behaviorally below (`ตำบลท่าเรือ`-class markers still resolve with zero camping words in the sentence).

## Verification — measured against the CURRENT 503-row shortlist, every case run for real

### The three named words (BR-4)
| Word | Ordinary phrasing (no marker) | Explicit `ตำบล` marker |
|---|---|---|
| `เหนือเมือง` | `resolvePlace('เมื่อวานนี้ไปเหนือเมืองเยี่ยมญาติมา')` → `{}` ; `resolvePlace('ลานกางเต็นท์เหนือเมือง')` (camping word present, still bare) → `{}` | `resolvePlace('ลานกางเต็นท์ตำบลเหนือเมือง')` → `{subDistrict:"เหนือเมือง", district:"เมืองร้อยเอ็ด"}` |
| `เสาธง` | `resolvePlace('เมื่อวานนี้ไปเสาธงเยี่ยมญาติมา')` → `{}` ; `resolvePlace('ลานกางเต็นท์เสาธง')` → `{}` | `resolvePlace('ลานกางเต็นท์ตำบลเสาธง')` → `{subDistrict:"เสาธง", district:"ร่อนพิบูลย์"}` |
| `รังนก` | `resolvePlace('เมื่อวานนี้ไปรังนกเยี่ยมญาติมา')` → `{}` ; `resolvePlace('ลานกางเต็นท์รังนก')` → `{}` | `resolvePlace('ลานกางเต็นท์ตำบลรังนก')` → `{subDistrict:"รังนก", district:"สามง่าม"}` |

### The exposed names — measured directly against `prisma/data/subdistrict-shortlist.json` (503 rows) after the existing length-floor/vocab/substring-of-province guards: **23 names survive and start with `เมือง`/`ท่า`** (2 + 21 — the ticket's "~24" estimate, confirmed close by direct count rather than trusted from a prior story's own tally). Each checked individually, neutral phrasing (no camping word) vs camping phrasing (`ลานกางเต็นท์<name>`):

| # | Name | District (or ambiguous) | Neutral phrasing | Camping phrasing |
|---|---|---|---|---|
| 1 | เมืองปอน | ขุนยวม (แม่ฮ่องสอน) | `{}` | `{subDistrict, district:"ขุนยวม"}` |
| 2 | เมืองเก่า | เมืองสุโขทัย | `{}` | `{subDistrict, district:"เมืองสุโขทัย"}` |
| 3 | ท่าม่วง | ท่าม่วง (กาญจนบุรี) | `{}` | `{subDistrict, district:"ท่าม่วง"}` |
| 4 | ท่าขุนราม | เมืองกำแพงเพชร | `{}` | `{subDistrict, district:"เมืองกำแพงเพชร"}` |
| 5 | ท่าตะเกียบ | ท่าตะเกียบ (ฉะเชิงเทรา) | `{}` | `{subDistrict, district:"ท่าตะเกียบ"}` |
| 6 | ท่าทองหลาง | บางคล้า (ฉะเชิงเทรา) | **`{subDistrict:"ทองหลาง", district:"บ้านนา"}`** — see EC-5 finding below, not `{}` | `{subDistrict:"ท่าทองหลาง", district:"บางคล้า"}` |
| 7 | ท่าเทววงษ์ | เกาะสีชัง (ชลบุรี) | `{}` | `{subDistrict, district:"เกาะสีชัง"}` |
| 8 | ท่าชัย | เมืองชัยนาท | `{}` | `{subDistrict, district:"เมืองชัยนาท"}` |
| 9 | ท่าหินโงม | เมืองชัยภูมิ | **`{subDistrict:"หินโงม", district:"เมืองหนองคาย"}`** — see EC-5 finding below, not `{}` | `{subDistrict:"ท่าหินโงม", district:"เมืองชัยภูมิ"}` |
| 10 | ท่าเรือ | ปากพลี(นครนายก) / เมืองนครศรีธรรมราช — collides, CAM-600's own 13 | `{}` | `{district:"ท่าเรือ"}` (falls through to district level, unchanged, already pinned CAM-596/CAM-600 test) |
| 11 | ท่าจำปี | เมืองพะเยา | `{}` | `{subDistrict, district:"เมืองพะเยา"}` |
| 12 | ท่าช้าง | พรหมพิราม (พิษณุโลก) | `{}` | `{subDistrict, district:"พรหมพิราม"}` |
| 13 | ท่างาม | วัดโบสถ์ (พิษณุโลก) | `{}` | `{subDistrict, district:"วัดโบสถ์"}` |
| 14 | ท่ายาง | ท่ายาง (เพชรบุรี) | `{}` | `{subDistrict, district:"ท่ายาง"}` |
| 15 | ท่าแร้งออก | บ้านแหลม (เพชรบุรี) | `{}` | `{subDistrict, district:"บ้านแหลม"}` |
| 16 | ท่าตูม | เมืองมหาสารคาม | `{}` | `{subDistrict, district:"เมืองมหาสารคาม"}` |
| 17 | ท่าสองคอน | เมืองมหาสารคาม | `{}` | `{subDistrict, district:"เมืองมหาสารคาม"}` |
| 18 | ท่านัด | ดำเนินสะดวก (ราชบุรี) | `{}` | `{subDistrict, district:"ดำเนินสะดวก"}` |
| 19 | ท่าศาลา | ภูเรือ (เลย) | `{}` | `{subDistrict, district:"ภูเรือ"}` |
| 20 | ท่าเกษม | เมืองสระแก้ว | `{}` | `{subDistrict, district:"เมืองสระแก้ว"}` |
| 21 | ท่าสว่าง | เมืองสุรินทร์ | `{}` | `{subDistrict, district:"เมืองสุรินทร์"}` |
| 22 | ท่าอิฐ | เมืองอุตรดิตถ์ | `{}` | `{subDistrict, district:"เมืองอุตรดิตถ์"}` |
| 23 | ท่าลาด | วารินชำราบ (อุบลราชธานี) | `{}` | `{subDistrict, district:"วารินชำราบ"}` |

**21 of 23 close cleanly** (`{}` in neutral phrasing, correct resolution restored under camping phrasing, exactly the fix the ticket asked for).

**EC-5 finding, found during this verification, not fixed here (per story.md "Out of scope"):** `ท่าทองหลาง` and `ท่าหินโงม` each literally CONTAIN, as a trailing substring, a SECOND, independently-real, already-shortlisted sub-district name that does NOT start with `เมือง`/`ท่า` and therefore carries no guard of its own: `ทองหลาง` (บ้านนา, นครนายก) and `หินโงม` (เมืองหนองคาย, หนองคาย). Before this story, the longer name always matched first (sorted longest-first) and returned immediately, so the shorter, embedded, unguarded candidate was NEVER reached — this story's guard correctly makes the OUTER candidate skip on a neutral sentence, and the existing "skip and keep scanning" idiom (unchanged, reused, not redesigned) then reaches the INNER candidate, which fires on its own — because it is independently a real, camp-holding tambon with no guard of its own, exactly as it would if a camper had typed it bare with nothing else around it. This is a DIFFERENT collision class (two independently-valid shortlisted names, one a substring of the other) from anything this ticket's own guard is built to catch (a common-component prefix pattern) — closing it would need a new, broader mechanism (cross-candidate overlap suppression), explicitly out of this story's "reuse, don't fork" instruction and its own file/complexity budget. Named here, per the ticket's own "report what you find even if you only fix this one" standard this arc has followed all day (CAM-606, CAM-609). Not a regression relative to any PINNED test — no existing test names either `ท่าทองหลาง`/`ท่าหินโงม`/`ทองหลาง`/`หินโงม` — and not a worse outcome than before in the general case (a bare `ทองหลาง`/`หินโงม` mention with nothing else around it already fired unconditionally before this story, unrelated to it).

### CAM-600's six negatives, re-checked individually
`ลานกางเต็นท์ริมถนน` → `{}` · `ใกล้ตลาด` → `{}` · `ริมบ่อ` → `{}` · `ทางเหนือ` → `{}` · `ที่สะอาด` → `{}` · `บรรยากาศสำราญ` → `{}` — all six unchanged.

### CAM-609's ตำนาน cases, re-checked
`เต็นท์รุ่นตำนาน` → `{}` · `ลานกางเต็นท์ตำบลตำนาน` → `{subDistrict:"ตำนาน", district:"เมืองพัทลุง"}` — both unchanged.

### Siblings, re-checked (bare, unqualified text — matches the ticket's own literal phrasing)
`แม่ริม` → `{district:"แม่ริม"}` · `อำเภอปาย` → `{district:"ปาย"}` · `เชียงใหม่` → `{province:"Chiang Mai"}` · `ใกล้เขาใหญ่` → `{}` (pre-existing, documented behavior — CAM-596's own G3 review note already recorded this exact bare-mention result as correct/unaffected, since `เขาใหญ่` is context-guarded and `ใกล้` alone is not itself a camping-context marker; unchanged by this story, which touches no landmark logic) · `ลานกางเต็นท์ป่าตอง` → `{subDistrict:"ป่าตอง", district:"กะทู้"}` · `ลานกางเต็นท์หมูสี` → `{subDistrict:"หมูสี", district:"ปากช่อง"}` — all six unchanged.

## ADRs
None new. Extends CAM-596's pre-pass structural-guard mechanism to the sub-district level, closing the parity gap CAM-609's own re-scan named — the ONLY new mechanism-level artifact is the type-narrowing on `resolveAmbiguousSubDistrictEntry` (no behavior change, described above).
Confirmation: `__tests__/cam-611-subdistrict-structural-guard.test.ts` (all AC-1..5/EC-1..5 rows) + the full existing suite (CAM-501/502/503/504/596/599/600/605/606/609, unmodified) re-run green as the final act + `npm run ai:guardrail-gate` run ONCE against the real model (cost-capped per the dispatch).

## Links
`../CAM-596-district-through-the-model/tech.md` (the guard mechanism this story reuses) · `../CAM-600-tambon-shortlist/tech.md` (the sub-district detector + its own guards) · `../CAM-609-tamnan-false-hint/tech.md` (the re-scan that found this gap + the explicit-marker precedent) · `lib/ai/place-resolver.ts` · `story.md`

## Changelog
- v1 (2026-07-28) — created; documents the guard-vs-vocabulary decision, the measured-zero guard #4 equivalent, the full 23-name verification table, and the EC-5 substring-embedding finding (reported, not fixed).
