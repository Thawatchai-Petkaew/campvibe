---
linear: CAM-596
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v3
updated: 2026-07-28
---
# Tech — Asking for a district by name still finds nothing (CAM-596)

## Data model
No new entity/field. Reuses `prisma/data/thailand-locations.json` (already imported by `lib/ai/place-resolver.ts` for province detection) — confirmed the exact seed source of the live `AdminArea` table (`prisma/seed.ts:177`, `S5: Country + AdminArea tree`), i.e. the same data `matchAdminArea` (CAM-566) queries at runtime. This is why the pre-pass can safely detect against the static JSON without a DB round-trip: the candidate set can never contain a name the live `AdminArea` table doesn't also have.

## Why the pre-pass does not call `matchAdminArea` directly (reused, not forked)
The ticket's "reuse `matchAdminArea`, don't add a fourth place-lookup path" is satisfied by NOT adding any new DB query at all, rather than by calling `matchAdminArea` from inside the free-text scanner:

- The pre-pass's job is narrower than resolution — it only decides *whether the message plausibly names a district* so it can inject a MANDATORY hint. `matchAdminArea` is exact-equality-only against an *already-isolated* value (a single trimmed string) — it has no way to find *which substring of an unspaced Thai sentence* to test in the first place. Making it a scanner would mean calling it once per candidate per turn (900+ awaits), which is both slow and pointless since the candidate list already IS the exact data `matchAdminArea` would match against.
- The REAL resolution — the part that must stay correct and is explicitly out of this story's bounds — never moves: `resolveDistrictAdminAreaIds`/`resolveSubDistrictAdminAreaId` (`lib/ai/tools/search-campsites.ts`, CAM-587) still call `matchAdminArea` exactly as before. A pre-pass false positive is not a correctness bug: the model calls the tool with the hinted `district`, the tool's own `matchAdminArea` fails to resolve it, and the existing honest-empty path (`unresolvedNamedPlace = true` → `cards = []`) fires — proven already by CAM-587's own tests, unchanged here.
- `resolvePlace` stays a **pure, synchronous** function (unchanged contract, unchanged signature) — this is a deliberate, load-bearing decision: it is called from 3 production sites in `openrouter-client.ts` (lines ~1319/1362/1744) with no `await`, and roughly 40 existing test cases across `cam-501`/`cam-502`/`cam-503`/`cam-504` call it synchronously and assert an exact returned object. Making it async to call `matchAdminArea` would force `await` onto every call site AND every existing test — a large, high-risk blast radius explicitly flagged by the ticket's own self-verify instruction ("a pre-pass change is exactly the kind that breaks sibling source pins") for a change that buys no additional correctness (the static-gazetteer candidate list is already provably identical to what `matchAdminArea` would match, since it's the same seed data).

## Detection algorithm (`lib/ai/place-resolver.ts`)

New module-load-time candidate build, mirroring the existing `PROVINCES_BY_TH_LENGTH_DESC` idiom — **district-only** (see "Scope narrowed after measurement" below for why sub-district was cut):

1. Flatten `thailandLocations` into one list: every district `{ nameTh, provinceNameTh }` (deduplicated by `nameTh` via a `Map`).
2. Apply exclusion filters, in order, dropping the candidate entirely (never generated) when:
   - `nameTh.length < 4` (mirrors `AMBIGUOUS_PROVINCE_NAMES_TH`'s existing "≤4-char" risk floor). Measured: excludes 17 district names.
   - `nameTh` is a member of the existing `AMBIGUOUS_PROVINCE_NAMES_TH` set (reused, not duplicated). Measured: 0 district names hit this (kept for defensive symmetry — a future data change could add one).
   - `nameTh` is a substring of ANY province's own `nameTh` — INCLUDING an exact match. Measured: excludes อุทัย, หนองบัว, พนม (each a district in a DIFFERENT province than the one whose name contains it: อุทัย → Ayutthaya not Uthai Thani, หนองบัว → Nakhon Sawan not Nong Bua Lamphu, พนม → Surat Thani not Nakhon Phanom) and "พระนครศรีอยุธยา" (a district that is an EXACT duplicate of its own province's name). The self-equality case was discovered mid-build: the FIRST version of this guard explicitly excluded `p.nameTh === name` (to avoid trivially "excluding itself"), which let "เชียงใหม่" as a SUB-DISTRICT candidate (itself, unrelatedly, a real sub-district of Roi Et) slip through and break 4 pinned `cam-502`/`cam-503`/`cam-504` regression tests — fixed by removing that self-exclusion (a candidate equal to any province name is always redundant with the existing province detector, never a reason to skip the guard).
   - `nameTh === 'เมือง' + provinceNameTh` (the provincial-capital-district naming pattern). Measured: 75 of Thailand's 77 provinces have this exact pattern. Excluded because the plain province name is *always* co-present as a substring wherever this candidate would match, so the existing (unchanged) province detector already covers the camper's intent — firing the district on top of it is a silent over-narrowing, not an improvement. Proven RED on "อยากไปเที่ยวเมืองเชียงใหม่" before this guard existed.
3. Every SURVIVING candidate carries a `requiresCampingContext: boolean` — `true` only if `nameTh` starts with `'เมือง'` (the 4 non-capital-pattern names: เมืองยาง, เมืองจันทร์, เมืองสรวง, เมืองปาน) or `'ท่า'` (23 names, e.g. ท่าเรือ, ท่าใหม่ — "ท่า" alone is ordinary Thai for "pier/dock/wharf", a measured collision class per the ticket).
4. The list is sorted longest-`nameTh`-first (the same "longer/more specific wins" idiom `detectProvince`/`detectRegion`/`detectLandmark` already use).
5. `detectDistrict(text)`: scans the sorted list; for each candidate whose `nameTh` is a substring of `text`, skip it (continue scanning) if `requiresCampingContext` is true and `hasCampingContextMarker(text)` is false; otherwise return `nameTh` immediately (first match wins, same idiom as `detectLandmark`). No match anywhere → `undefined`.

`resolvePlace`'s existing dispatch order gains ONE new step, inserted after the landmark + Bangkok-bare-mention checks (both unchanged) and before the existing plain-province check:

```
landmark?              -> unchanged (near + nearIsLandmark)
isBareBangkokMention?   -> unchanged (near or province)
detectDistrict(text)?   -> NEW: { district: nameTh },
                           PLUS an accompanying province: detectProvince(text) result,
                           if the SAME message also names one (BR-2 scoping, AC-4)
detectProvince(text)?   -> unchanged (province, or near if a proximity marker is present)
detectRegion(text)?     -> unchanged (region)
else {}                 -> unchanged
```

Because the district branch only ever fires on a candidate that SURVIVED the BR-4 exclusions above, and none of those exclusions can ever match a BARE province mention with no real district substring, every existing `cam-501`/`cam-502`/`cam-503`/`cam-504` test input is provably unaffected — confirmed by re-running those suites green, not merely reasoned about (this is exactly how the two self-equality regressions above were caught and fixed before the diff was final).

**CAM-599 update (2026-07-28) — the dispatch order above is now the SECOND step, not the first.** During this story's own G3 review the orchestrator flagged a real gap this table did not yet cover: "แคมป์ที่อำเภอปาย" carries an explicit อำเภอ prefix — the camper names a district by word — yet it resolved as the ปาย LANDMARK's 250km radius, because ปาย also sits in the landmark gazetteer and the landmark check above runs first. That gap is now closed by CAM-599, which inserts ONE more step ahead of everything in this table:

```
detectExplicitDistrictPrefix(text)? -> NEW (CAM-599): { district: nameTh },
                                        PLUS an accompanying province, same BR-2 scoping rule,
                                        when an "อำเภอ"/"อ." marker sits in front of a real
                                        district name — checked BEFORE the landmark? step above
landmark?                           -> unchanged for a BARE mention (no marker) — CAM-503's
                                        multi-province reasoning still holds there
isBareBangkokMention? / detectDistrict(text)? / detectProvince(text)? / detectRegion(text)? / else {}
                                     -> all unchanged, exactly as documented above
```

The two detectors are deliberately separate functions over separate candidate lists (not one function with a flag) because their safety argument differs in kind: THIS story's `detectDistrict` candidates need the four BR-4 guards above because a bare name carries no other signal; CAM-599's marker-prefixed candidates skip three of those four guards on purpose, because the "อำเภอ"/"อ." marker in the text IS the disambiguating context those guards stand in for. Full rationale, the sibling-pin sweep, and the golden-case addition: `../CAM-599-named-district-beats-landmark/tech.md`.

`ResolvedPlace` gains ONE new OPTIONAL field: `district?: string` — additive only (`api.md` rule 12), every existing field/shape unchanged.

## Scope narrowed after measurement: sub-district detection cut entirely

v1 of this story planned a `subDistrict` branch too, gated by an ALWAYS-required camping-context marker (the sub-district pool is 5,835 names — far denser with common-word collisions than the 926 district names, e.g. 343 sub-districts start with "หนอง", 270 with "บ้าน", 235 with "บาง"). Building it and running it against the existing `cam-501` suite proved the guard gives **no real protection** at this scale: real sub-district names "เหนือ" (above/north), "กลาง" (middle), and "ตากแดด" (sunbathe — literally a real sub-district in Ubon Ratchathani, Phang Nga, AND Chumphon, 3 separate provinces) all fired even WITH `hasCampingContextMarker` returning true, because every one of the failing fixture sentences already contained an ordinary camping word ("ที่กางเต็นท์"/"กางเต็นท์") — this assistant's OWN domain vocabulary defeats the exact guard that protects `detectLandmark`'s "เขาใหญ่" (rare outside camping talk). Rather than ship a hint mechanism proven to misfire on ordinary Thai vocabulary, sub-district free-text detection was removed from `place-resolver.ts` entirely — `ResolvedPlace` carries no `subDistrict` field, and a bare ตำบล mention gets no pre-pass hint (unchanged from before this story; the model may still set it on its own initiative per the tool's own, separately-softened parameter description).

## API contract (tool-surface, prompt-only changes)

`lib/ai/tools/search-campsites.ts` — no zod/schema change (CAM-587 already added `district`/`subDistrict` to `searchCampsitesArgsSchema`); two text-only edits:

1. **Headline description** (`searchCampsitesTool.description`, was: "…by province, region, type, price range, …") now reads "…by province, region, district, sub-district, type, price range, …" — this is the sentence the model reads FIRST when deciding a parameter is relevant at all (the ticket's root-cause point 1). Sub-district is still named here even though it has no pre-pass hint — the model can and does set it on its own initiative (CAM-587 already proved the resolver works for it); only the deterministic pre-pass hint was cut.
2. **Per-parameter descriptions** for `district`/`subDistrict` — the existing "if you do not recognise it, do NOT guess — leave this unset" sentence is reconciled (not deleted) with an added sentence: if this turn's own instructions already tell the model to set `district`, that is a confirmed match and it MUST follow it; guessing on the model's OWN initiative, with no such instruction, is still discouraged exactly as before. `subDistrict`'s description keeps the original "do NOT guess" framing unconditionally (no pre-pass hint exists for it). This preserves BR-4/AC-6 of CAM-587 (an unresolved district/sub-district still returns zero rows honestly, never a guess) for the case where no pre-pass hint fired.

`lib/ai/openrouter-client.ts`'s `buildPlaceHintBlock` gains ONE new branch (`place.district`), inserted into the existing near→province→region if-chain at the position matching BR-1's ladder (checked before `place.province`, after `place.near`): the MANDATORY-hint block instructs the model to set `district` this turn (mirroring the existing province/region blocks' wording: "you MUST set district=X … never omit it … never change it to a different district … a terrain/facility word is NOT a place"), and — when `place.province` is ALSO set on the same `ResolvedPlace` — appends one sentence telling the model to ALSO pass `province=Y` alongside it for scoping (never as a replacement).

## ADRs
None new. Extends CAM-501's original pre-pass ADR-equivalent decision (a deterministic, mandatory hint removes a guess from the model) to the district level CAM-587 added to the tool but never wired into that mechanism.
Confirmation: `__tests__/cam-596-place-resolver-district.test.ts` (unit, pre-pass detector + all BR-4 guards, red-then-green per guard) + `__tests__/cam-596-openrouter-hint.test.ts` (the new hint-block branch) + `__tests__/cam-596-tool-description.test.ts` (the tool-surface text) + a new guardrail golden case (`GEO-5-CAM596-DISTRICT`, `scripts/ai-eval/golden-cases.json`) that runs against the REAL model in CI (`ai-guardrail-gate.yml`, triggers automatically on this PR since it touches `lib/ai/**`) — a real-model run was not reproducible in this environment (no `OPENROUTER_API_KEY` available; the worktree sandbox blocks sourcing the main tree's `.env`), so this golden case is the actual behavioral verification for AC-1, not a claim made without evidence.

## Links
`../../feature.md` (## Architecture overview) · `lib/ai/place-resolver.ts` · `lib/ai/tools/search-campsites.ts` · `lib/ai/openrouter-client.ts` · `lib/geo/admin-area-match.ts` · `story.md` · CAM-587 tech.md (the resolution layer this story reaches, unchanged)

## Changelog
- v1 (2026-07-28) — created (planned district + sub-district detection).
- v2 (2026-07-28) — rewritten to match the shipped, district-only implementation; documents the two self-equality regressions found and fixed (`isSubstringOfAnyProvince`'s self-exclusion removal) and the sub-district scope-narrowing decision with its measured evidence.
- v3 (2026-07-28) — reconciled with CAM-599: the dispatch-order table above is now the SECOND step, not the first — an explicit "อำเภอ"/"อ." district marker now wins over the landmark check ahead of it. See the new "CAM-599 update" note inline and `../CAM-599-named-district-beats-landmark/tech.md` for the full rationale.
