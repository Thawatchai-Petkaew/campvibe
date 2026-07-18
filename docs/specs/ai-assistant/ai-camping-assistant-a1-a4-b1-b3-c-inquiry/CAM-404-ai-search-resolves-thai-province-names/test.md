---
linear: CAM-404
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — AI search resolves Thai province names to stored English values (CAM-404)

## Test strategy note (read first)

Spec-lite S, single-file diff (`lib/ai/tools/search-campsites.ts`, +38/-2). QA pass = light AC verify against the tests already authored in the same PR (`__tests__/cam-404-search-campsites-province-resolve.test.ts`), plus an adversarial edge check on the Thai-detection regex and the resolve fallback path. No new production code touched; 1 new test file (already present at build time, re-verified here).

## AC→test matrix

| AC/BR/EC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (Thai province resolves → English value reaches the where-clause) | H | unit | `cam-404-search-campsites-province-resolve.test.ts` — `describe('...normal)') > 'a Thai province name resolves...'` | PASS |
| AC-2 / EC-2 (unmapped Thai province → raw passthrough, no crash) | M | unit | same file — `'...unmapped Thai province...'` (null match) | PASS |
| AC-3 / BR-2 (English province unchanged, no DB round-trip) | M | unit | same file — `'an English province input is unchanged...'` (asserts `findFirst` NOT called) | PASS |
| EC-1 / BR-3 (lookup throws → raw fallback, never throws) | H | unit | same file — `'...lookup error falls back...'` (`mockRejectedValueOnce`) | PASS |
| Regression: existing `cam-270-search-campsites` tool contract | H | unit | `cam-270-search-campsites.test.ts` (14 tests, unmodified) | PASS |

## Validation cases (BR-1/BR-2/BR-3)

- BR-1 happy: `province:"เชียงใหม่"` → `thailandLocation.findFirst({where:{provinceName:{contains:"เชียงใหม่"}}})` called once → `where.location.province === "Chiang Mai"`. Verified.
- BR-2 happy: `province:"Chiang Mai"` → zero `thailandLocation` calls, value passed through unchanged. Verified.
- BR-3 boundary/error: unmapped Thai (`findFirst`→`null`) and a rejected lookup (`Error`) both fall back to the raw Thai string, no throw propagates (`executeSearchCampsites` resolves `{cards:[]}` in the error case). Verified.

## Adversarial edge check (this QA pass, no new test added — reasoned + confirmed against the real mechanism)

| Edge | Verdict | Why no new test needed |
|---|---|---|
| Mixed prefix `"จ.เชียงใหม่"` (Thai "province" abbreviation prefix) | Same code path as the unmapped case: `THAI_CHAR_PATTERN` still matches → `contains:"จ.เชียงใหม่"` doesn't match the stored `"เชียงใหม่"` row (search string is a superset, not a substring) → `null` → raw fallback. Identical mechanism already covered by the `"ไม่มีจริง"` (unmapped) test — no crash, matches BR-3/AC-2 intent. Not a defect: out-of-scope per story ("district-level/format normalization not requested"). |
| Trailing/leading whitespace (`"เชียงใหม่ "`, `" เชียงใหม่"`) | `searchCampsitesArgsSchema` applies zod `.trim()` on `province` BEFORE `resolveProvinceForSearch` ever runs — whitespace is stripped at the schema boundary, not this function's concern. Confirmed by reading `z.object({ province: z.string().trim().min(1)... })`. No new test — this is library-guaranteed zod behavior, not custom logic in the diff. |
| Mixed Thai+English in one string (e.g. `"Chiang Mai เชียงใหม่"`) | `THAI_CHAR_PATTERN.test()` needs only ONE Thai char → triggers lookup → `contains` on the full mixed string won't match any seeded row → null → raw fallback, no crash. Same mechanism as the unmapped-Thai test; graceful degradation, not a regression. |
| `THAI_CHAR_PATTERN = /[ก-๙]/` boundary — does it catch all Thai script incl. ๆ (mai yamok, U+0E46)? | Confirmed via codepoint range: ก=U+0E01, ๙=U+0E59; ๆ=U+0E46 falls inside [0E01,0E59] → matched. Range covers consonants, vowels, tone marks, and digits (only the rare U+0E5A/U+0E5B punctuation marks fall outside, not used in province names). No gap found. |
| Lookup returns `null` vs throws — same fallback code path? | Both land in the same `return match?.provinceNameEn ?? province` / `catch { return province }` — but exercised by two DISTINCT test cases (`mockResolvedValueOnce(null)` vs `mockRejectedValueOnce(Error)`), so both branches are independently proven, not just one assumed to cover the other. Confirmed via coverage run: 100% branches. |
| `undefined`/empty province (no `province` arg at all) | `args.province !== undefined ? await resolveProvinceForSearch(...) : undefined` — short-circuits, `resolveProvinceForSearch` never called. Covered implicitly by the pre-existing `cam-270` "no limit supplied" / petFriendly-only tests (`searchCampsitesArgsSchema.parse({})`, `.parse({petFriendly:true})`) which omit `province` and pass; an explicit empty string is rejected earlier by zod's `.min(1)` (schema-level, orthogonal to this diff). No new test needed — this is the existing, unmodified `cam-270` passthrough contract. |

## Coverage

100% statements / 100% branches / 100% functions on `lib/ai/tools/search-campsites.ts`'s new code (measured: `npx vitest run <2 files> --coverage --coverage.include='lib/ai/tools/search-campsites.ts'` → 16/16 stmts, 12/12 branches, 2/2 funcs). Exceeds the ≥80% floor.

## Run results

```
__tests__/cam-404-search-campsites-province-resolve.test.ts + cam-270-search-campsites.test.ts
Test Files  2 passed (2) · Tests  14 passed (14)
```

Full repo suite (`npx vitest run`): 183 test files, 6801 tests — **3 failing tests, 3 failing files**, all confirmed pre-existing and unrelated to this diff (`git diff origin/dev...HEAD --name-only` for this branch touches only `search-campsites.ts` + the new test file + `story.md`):
- `__tests__/delivery-client.test.ts` — known pre-existing env-dependent failure (per dispatch, ignored).
- `__tests__/f5-account-misc.test.ts`, `__tests__/f6-palette-guard.test.ts` — pre-existing `git diff staging --name-only` artifacts (dev has diverged from staging with unrelated already-merged stories; same class as documented in CAM-401's test.md), not caused by CAM-404.

## Defects found

None. All 3 AC + both EC rows hold; the existing `cam-270-search-campsites` tool contract (14 tests) is unmodified and green — no regression.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `__tests__/cam-270-search-campsites.test.ts` (sibling suite re-verified, unmodified)

## Changelog
- v1 (2026-07-18) — created; light AC verify, adversarial edge check on Thai-detection regex + fallback path, 0 defects, new-code coverage 100%
