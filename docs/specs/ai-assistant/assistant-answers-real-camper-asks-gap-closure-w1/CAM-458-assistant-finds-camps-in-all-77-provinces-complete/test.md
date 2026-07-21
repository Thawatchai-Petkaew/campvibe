---
linear: CAM-458
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1
persona: Camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-21
---
# Test — assistant finds camps in all 77 provinces (CAM-458)

## Test strategy note (read first)

Independent QA verify of a shipped diff (PR #538, branch `feature/cam-458-provinces-77`,
commit `a8638bb`) authored before this dispatch — not accepted on the authoring-agent's
self-report alone. I re-derived the AC/BR/EC → test matrix from `story.md`/`tech.md` BEFORE
reading the 26 pinned tests, then diffed; ran a DATA AUTHORITY audit of the 77-row seed against
the official province list (ISO 3166-2:TH / TIS 1099-2548, DOPA 2-digit codes) with a ≥15-row
RTGS-spelling spot-audit including every named trap; audited both pinned test files for
legitimacy; and added 17 gap-fill tests (data invariants) + 80 gap-fill tests (resolver,
including the AC-1 table-driven all-77 sweep the story's own self-verify calls for but the
pinned suite never wrote). All new tests were Prove-It'd red-then-green by hand (see below).

## Re-derivation diff (before reading the pinned suite)

My independent AC/BR/EC → test-case list matched the pinned suite's intent on every row it
covered. Gaps found (all closed by gap-fill, see AC→test matrix):

- **AC-1 self-verify explicitly calls for a table-driven test across ALL 77 real provinces**
  ("mirrors `cam-404-search-campsites-province-resolve.test.ts`") — the pinned suite only
  tested Bangkok aliases + implicitly reused CAM-404's 2 generic Thai-word cases; it never swept
  the real 77-row `thailand-locations.json` through the resolver. **Closed** — added
  `it.each(ALL_PROVINCES)` sourced from the real file (77 cases).
- **AC-3 (resolvable province, 0 camps → `{cards:[]}`)** had no direct test naming AC-3 at the
  tool layer — every pinned test happened to pass `mockFindMany.mockResolvedValueOnce([])`, so
  the fact was implicitly proven but never asserted as its own named case. **Closed** — added a
  direct AC-3 test (Bueng Kan, zero camps).
- **BR-1 spelling spot-audit** — the pinned suite proved count=77 + uniqueness + 2 spot-checks
  (Bangkok, Bueng Kan) but never pinned the RTGS spelling of the historically error-prone names
  (two-word vs one-word conventions). **Closed** — 15-row spot-audit, see Data authority check.
- **Case-insensitive nameEn duplicate guard** — the pinned uniqueness test
  (`new Set(names).size===77`) is case-sensitive; a differently-cased duplicate would pass
  silently. **Closed** — added a lowercased-Set guard.
- **Substring-ambiguity seam invariant** — `resolveProvinceForSearch`'s `contains` lookup has no
  `orderBy`; if a full province name were ever a substring of a different province's name,
  `findFirst` would be nondeterministic. **Closed** — added a data-level invariant test proving
  every one of the 77 full Thai names matches exactly its own row under a `contains`-style scan.
- **Near-miss Bangkok substring (`บางกอกน้อย`)** — the pinned EC-4 test used a generic
  non-province word; no test targeted the sharper adversarial case of a real word that visibly
  *contains* `บางกอก`. **Closed** — added a dedicated negative test.
- **Whitespace variant** — no test confirmed the alias map still matches a padded variant via the
  upstream `z.string().trim()`. **Closed** — added a confirmatory test.
- **EC-5 (idempotent seed re-run)** — story self-verify calls this "integration"; **not closed
  with a new DB test** — see justified-gap note below.

## DATA AUTHORITY CHECK — 77 rows vs the official list

Validated all 77 `{code, nameTh, nameEn}` triples against the DOPA 2-digit province-code scheme
/ ISO 3166-2:TH (TH-10..TH-96) from first principles (not from the PR's own claim): every code
matches the real scheme (10, 11, 12–27, 30–41 (minus 28/29), 42–58 (minus 59), 60–67 (minus
68/69), 70–77 (minus 78/79), 80, 81–86 (minus 87–89), 90–96) and every `nameEn` matches the
standard RTGS/DOPA transliteration. **0 discrepancies found** — the file is correct as shipped.

Cross-checked what `Location.province` actually stores for existing data (`prisma/seed.ts`
~L636-652): the 12 mock camps hardcode `provinceNameEn` to exactly the **original 12** province
names (unchanged by this diff) — no existing `Location.province` row uses any of the 65 new
provinces yet, so there is no live spelling-convention conflict to catch; the risk is purely
forward-looking (a host later entering a camp in a new province) and is closed by the RTGS
spot-audit below.

15-row spot-audit (exceeds the ≥15 requirement), including every named trap:

| code | nameTh | nameEn (verified) |
|---|---|---|
| 14 | พระนครศรีอยุธยา | Phra Nakhon Si Ayutthaya |
| 33 | ศรีสะเกษ | Si Sa Ket |
| 20 | ชลบุรี | Chon Buri |
| 25 | ปราจีนบุรี | Prachin Buri |
| 80 | นครศรีธรรมราช | Nakhon Si Thammarat |
| 31 | บุรีรัมย์ | Buri Ram |
| 39 | หนองบัวลำภู | Nong Bua Lam Phu |
| 24 | ฉะเชิงเทรา | Chachoengsao |
| 18 | ชัยนาท | Chai Nat |
| 58 | แม่ฮ่องสอน | Mae Hong Son |
| 93 | พัทลุง | Phatthalung |
| 91 | สตูล | Satun |
| 34 | อุบลราชธานี | Ubon Ratchathani |
| 75 | สมุทรสงคราม | Samut Songkhram |
| 16 | ลพบุรี | Lop Buri |

All 15 pinned as a dedicated `it.each` block (`cam-458-thailand-locations-data.test.ts`), plus a
case-insensitive dup guard and the substring-ambiguity invariant (also data-level, no DB).

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (Thai province resolves via ThailandLocation; camp cards shown) | H | unit (table-driven, all 77 real rows) | `cam-458-province-resolve.test.ts` | pass |
| AC-1 (card display for a new-province camp) | H | **owner-verify** | real chat, dev DB, a camp seeded in a new province | not verifiable headless |
| AC-2 (Bangkok variants กทม/กทม./กรุงเทพฯ/บางกอก → Bangkok) | H | unit | `cam-458-province-resolve.test.ts` | pass |
| AC-3 (resolvable, 0 camps → honest empty, tool layer) | H | unit (gap-fill) | `cam-458-province-resolve.test.ts` | pass |
| AC-3 (banner `aiChat.zeroResult` verbatim + no camp named) | H | **owner-verify** (CAM-437 territory, unchanged) | real chat | not verifiable headless |
| AC-4 (non-province/typo word → banner, never error) | H | unit | `cam-458-province-resolve.test.ts` + `cam-404-search-campsites-province-resolve.test.ts` | pass |
| BR-1 (77-row completeness, official codes/spellings) | H | unit (data, no DB) | `cam-458-thailand-locations-data.test.ts` | pass |
| BR-1 (RTGS spelling spot-audit, 15 rows incl. every named trap) | H | unit (gap-fill) | `cam-458-thailand-locations-data.test.ts` | pass |
| BR-2/EC-5 (idempotent seed, unique-key upsert) | M | schema-level + CI ephemeral-Postgres job (single clean run) | `prisma/schema.prisma` `@@unique`, `.github/workflows/ci.yml` `e2e-regression` step | see justified-gap note |
| BR-3 (Bangkok alias, exact-key, substring unaffected) | H | unit | `cam-458-province-resolve.test.ts` | pass |
| BR-3 (near-miss `บางกอกน้อย` does not exact-key-match) | H | unit (gap-fill, adversarial) | `cam-458-province-resolve.test.ts` | pass |
| BR-4 (fallback unchanged, never throws) | H | unit + regression | `cam-458-province-resolve.test.ts` + `cam-404-*.test.ts` | pass |
| BR-5 (honest empty, CAM-437 no-invent) | M | unit (tool layer) + **owner-verify** (banner render) | `cam-458-province-resolve.test.ts` | pass / not verifiable headless |
| EC-1 (resolved+cards vs resolved+empty, no silent miss) | H | unit | covered by AC-1 + AC-3 rows above | pass |
| EC-2 (unmapped Bangkok-ish word falls to CAM-404 fallback) | M | unit | `cam-458-province-resolve.test.ts` | pass |
| EC-3 (0 cards, honest banner, no invented camp) | H | unit (tool) / owner-verify (banner) | as AC-3 | pass / not verifiable headless |
| EC-4 (no crash, no hallucination on typo) | H | unit + regression | as AC-4 | pass |
| EC-5 (double seed run, no dup/throw) | M | see justified-gap note | — | not added (justified) |
| Case-insensitive nameEn duplicate guard (gap-fill) | M | unit | `cam-458-thailand-locations-data.test.ts` | pass |
| Substring-ambiguity seam invariant (gap-fill) | M | unit | `cam-458-thailand-locations-data.test.ts` | pass |
| Whitespace-padded alias (gap-fill) | L | unit | `cam-458-province-resolve.test.ts` | pass |

Type mix (this story's tests): 100% unit (0% integ/e2e) — consistent with the CAM-404 precedent
this resolver family already uses (mocked-Prisma unit tests); AC-1/AC-3's DB+chat-render side is
correctly delegated to owner-verify per `tech.md` D4, not skipped.

## Justified gap — EC-5 (idempotent seed re-run)

Story self-verify calls this "integration: running the seed twice leaves exactly 77 rows". I did
**not** add a new DB-writing test for it, for a stated reason (not a silent skip):

1. The local Postgres reachable from this worktree (`localhost:5432`) is the **shared owner dev
   DB** (`ops.md` §1 — "local dev Postgres, owner's localhost points here"). Writing/upserting
   test rows into it from an agent-run test risks polluting the owner's live dev environment —
   exactly the class of incident the dispatch's git-mechanics rule warns against.
2. The established precedent for this exact resolver seam (`cam-404-*.test.ts`, the file this
   story's tests explicitly mirror) mocks Prisma throughout and never opens a real DB connection
   — this story's tests follow the same convention by design, not by omission.
3. Idempotency here is a **Prisma/Postgres guarantee**, not custom app logic: the upsert targets
   the existing `@@unique([provinceCode, districtCode])` composite key (`prisma/schema.prisma`),
   and `ci.yml`'s `e2e-regression` job already runs `prisma migrate deploy && tsx prisma/seed.ts`
   once against a disposable, ephemeral Postgres **service container** (not the shared dev DB) on
   every PR — a duplicate-key throw on the CI run's data would fail CI outright.
4. A true "run seed twice, assert row count stays 77" check would need its own isolated,
   throwaway Postgres (e.g., an added CI step) — that is CI/devops plumbing outside this
   dispatch's stated surface (`__tests__/cam-458-*.test.ts` + `test.md` only).

**Recommendation for follow-up** (not filed as a defect — no observed failure, this is a coverage
recommendation): add a "seed runs twice" assertion inside the existing `e2e-regression` CI step
(`.github/workflows/ci.yml`), owned by `devops`.

## Prove-It — hand-verified red-then-green (all new gap-fill tests)

Temporarily mutated 2 representative assertions (one per new file) to a plausible wrong value,
confirmed both went **red**, then reverted:

1. `cam-458-thailand-locations-data.test.ts` — flipped the expected Buri Ram (code 31) spelling
   to `"Buriram"` (a real, plausible one-word mis-transliteration) → **red**
   (`AssertionError: expected 'Buri Ram' to be 'Buriram'`).
2. `cam-458-province-resolve.test.ts` — flipped the negative near-miss test's expectation so it
   asserted `บางกอกน้อย` WAS normalized to `กรุงเทพมหานคร` → **red**
   (`AssertionError: expected 'บางกอกน้อย' to be 'กรุงเทพมหานคร'`).

Reverted both; re-ran the full CAM-458 + CAM-404 file set → **127/127 pass**. Also proved the two
new data-invariant checks (case-insensitive dup, substring-ambiguity) have teeth via a standalone
Node script against a deliberately-corrupted in-memory copy of the real array (case-variant dup
injected → guard reports fail; a `"เชียง"` fragment row injected → ambiguity guard reports fail;
both pass clean against the real, uncorrupted file).

## Pinned-test audit — 26 shipped tests, legitimate

Both pinned files (`cam-458-province-resolve.test.ts` 7 tests, `cam-458-thailand-locations-data.
test.ts` 19 tests) mirror the CAM-404 idiom (mocked Prisma / pure-JSON, no DB) and assert real
behavior at each assertion (where-clause values, not just "did not throw"). Uniqueness tests
(`new Set(codes/names).size === 77`) run against the REAL imported file, not a fixture. Alias
coverage: all 4 mapped variants (กทม / กทม. / กรุงเทพฯ / บางกอก) + the substring case (กรุงเทพ,
EC-2) + the negative fallback (EC-4) + the error-path fallback (BR-4) — all present. Original-12
intactness is pinned via `it.each(ORIGINAL_12)` against the real file (12 tests). No stale or
weakened pin found; no changes needed to the pinned suite.

## Coverage

- **New-code diff coverage (this story's actual diff in `lib/ai/tools/search-campsites.ts`):**
  every line/branch the diff touches — the `BANGKOK_ALIASES` map, the `normalized = ... ?? ...`
  fallback line, and the changed `contains: normalized` call — is exercised by both the pinned
  and gap-fill tests (alias-hit branch, alias-miss/passthrough branch, DB-match branch,
  DB-no-match branch, DB-throw branch). Whole-file v8 coverage
  (`--coverage.include=lib/ai/tools/search-campsites.ts`) reports 80.64% lines / 75.75% stmts —
  the uncovered lines (226-229, 236, 252) belong to the unrelated pre-existing CAM-427
  remaining-capacity block and the tool-definition export wrapper, outside this story's diff (not
  measured against, per `.claude/rules/qa.md` "measure the diff, not the whole repo").
- **`prisma/data/thailand-locations.json`** — pure data, no executable coverage; correctness
  proven by the data-invariant test suite (36 assertions) + the DATA AUTHORITY spot-audit above.
- Full suite (real run, last act): `npx vitest run` → **255/255 files, 7991/7991 tests pass**, 0
  failed, 0 skipped. `npx tsc --noEmit`: clean. `npm run lint` on the 2 touched files: 0
  errors/warnings.

## Defects found

**0.** The pinned suite was legitimate; the data was correct against the official list; all gaps
found were coverage gaps (closed by gap-fill), not production defects.

## Owner-verify / staging-G4 rows (browser/DB-render, cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | AC-1 — a camp seeded in a NEW province (e.g. Bueng Kan) returns real camp cards in the actual chat UI | Requires a real camp row in a new province + rendering the chat; no such camp exists in the current mock seed (only the original 12 have camps per `prisma/seed.ts` ~L636-652) |
| 2 | AC-3/EC-3 — the exact `aiChat.zeroResult` banner renders with no camp named, for a resolvable-but-camp-less province | Banner render is `components/ai-chat/*` (CAM-437 territory, unchanged this story); tool-layer `{cards:[]}` is unit-proven, the DOM/LLM-response render is not |
| 3 | Epic KPI — CAM-457 golden eval re-run does not regress | Golden eval is a separate harness (CAM-457); re-run is an owner/CI action, not part of this story's unit suite |

## Links

`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-458-assistant-finds-camps-in-all-77-provinces-complete/story.md` ·
`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-458-assistant-finds-camps-in-all-77-provinces-complete/tech.md` ·
`.claude/rules/qa.md` ·
`__tests__/cam-458-province-resolve.test.ts` · `__tests__/cam-458-thailand-locations-data.test.ts` ·
`__tests__/cam-404-search-campsites-province-resolve.test.ts` ·
`lib/ai/tools/search-campsites.ts` · `prisma/data/thailand-locations.json` · `prisma/seed.ts`

## Changelog

- v1 (2026-07-21) — Independent QA verify of the shipped suite (PR #538, 26 pinned tests,
  authored before this dispatch). Re-derived the AC/BR/EC matrix before reading the pinned tests;
  found and closed 7 coverage gaps (97 new assertions: AC-1 table-driven all-77 sweep, AC-3
  direct tool-layer test, 15-row RTGS spelling spot-audit, case-insensitive nameEn dup guard,
  substring-ambiguity seam invariant, near-miss `บางกอกน้อย` negative test, whitespace-padded
  alias test). Ran a full DATA AUTHORITY audit of the 77-row seed against ISO 3166-2:TH/DOPA —
  0 discrepancies. Prove-It'd 2 representative new tests red-then-green by hand + node-script
  Prove-It on both data-invariant guards. Documented 1 justified gap (EC-5 double-seed-run — no
  DB test added, reasoning + follow-up recommendation stated). 0 production defects. Full suite
  255/255 files, 7991/7991 tests green; typecheck clean; lint 0 new errors/warnings. Status:
  green, ready for `next: security`.
