---
linear: CAM-585
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: qa-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# Assert the geocode key invariant by behaviour, not by file path (CAM-585)

<!-- QA guard-hardening story. Test file (2 assertions) + finishing CAM-572's consolidation. -->

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want the 2 source-inspection assertions in `__tests__/cam-554-geocode-routes.test.ts` that block moving `app/api/geocode/_shared.ts`'s Google-fetch wrapper rewritten to pin the actual security invariant (behaviour) instead of which file the code lives in, so that the remaining duplicate wrapper can be consolidated and a future correct refactor never has to choose between "leave the duplicate" and "silently edit another story's tests".
Why: CAM-572 consolidated 2 of 3 Google-geocode wrapper duplicates onto `lib/geo/google-geocode.ts` and stopped at the third specifically because moving it turned these 2 assertions red with zero behaviour change (`tech.md`'s "What was tried and reverted") — the correct call at the time (STOP RULES forbid silently editing a sibling story's tests), but the underlying test defect (asserting file location, not behaviour) still needed a ticket of its own.
Scope: rewrite the 2 named assertions in `__tests__/cam-554-geocode-routes.test.ts` to assert the key-safety invariant behaviourally (never file-path-coupled); finish CAM-572's consolidation by moving `_shared.ts::callGoogleGeocode` onto `lib/geo/google-geocode.ts`'s `callGoogleGeocodeCore` as a thin translation (same pattern already used for `extractComponent`/`normalizeAdminName`); prove the rewritten assertions have teeth (red on a deliberate break, green once restored) both BEFORE and AFTER the file move.
Depends on: CAM-554 (`__tests__/cam-554-geocode-routes.test.ts`, PR #640) · CAM-572 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-572-shared-geocode-wrapper/`, PR #663 — named this exact follow-up in its `## Out of scope`) · CAM-581 (same family: a guard rule tightened after it blocked working code).

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 2 flagged assertions (`toContain('process.env.GOOGLE_GEOCODING_API_KEY')` in `_shared.ts`'s own source; a `console.error(...)` regex scan of the same file) | Traced against CAM-554's spec (`story.md`'s stated invariant: key is server-only, never `NEXT_PUBLIC_`-prefixed, never in a response body or a server log) | The invariant they protect is real, but is ALREADY behaviourally proven elsewhere in the same `describe` block (missing-key → no `fetch` call; a Google failure → response+log never contain the key) — the two flagged assertions add only a file-location coupling, not new protection | Documented in this story's `tech.md`/PR body: which half of each assertion is redundant vs real | EC-1 |
| AC-2 | The "read ONLY in `_shared.ts`" half of assertion 1 | Rewritten | That half is DELETED (redundant with the missing-key behavioural test); the "never referenced in `LocationPicker.tsx`/`LocationMapPin.tsx`/`CampgroundForm.tsx`" half is KEPT unchanged (a real, distinct, client-leak invariant nothing else covers) | The rewritten test no longer reads `_shared.ts`'s own source text at all | EC-2 |
| AC-3 | The `console.error(...)` regex-scan assertion | Rewritten | Replaced by an `it.each` that drives the real reverse-route handler through all 3 failure branches (HTTP error, Google non-OK status, thrown/network exception) and asserts the mocked `console.error` calls never contain the fake API key or the outgoing request's host (`maps.googleapis.com`) | The rewritten test executes real code paths instead of grepping source text — it survives the implementation moving to any file | EC-3 |
| AC-4 | The rewritten assertions (AC-2/AC-3), first run against the UNCHANGED (pre-move) implementation | `npx vitest run __tests__/cam-554-geocode-routes.test.ts` | Both pass green — confirms the rewrite is not a regression before anything else changes | Baseline captured before the consolidation move | EC-4 |
| AC-5 | The rewritten assertions | The invariant is deliberately broken (a temporary `console.error(url.toString())` added to the HTTP-error branch) | The AC-3 rewrite goes RED on exactly that branch; reverting the deliberate break turns it green again | Proves the guard has teeth (Prove-It), captured in the PR body, not left in the diff | EC-5 |
| AC-6 | `_shared.ts::callGoogleGeocode` (the last of the 3 original duplicates, per CAM-572's inventory) | Moved onto `lib/geo/google-geocode.ts`'s `callGoogleGeocodeCore` as a thin translation | `_shared.ts` no longer reads `process.env.GOOGLE_GEOCODING_API_KEY` itself; both geocode routes (`reverse`/`forward`) keep their exact existing return contract (`{results}` \| `null`) with zero caller-visible change | A grep for `GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com` repo-wide now shows exactly 1 definition (was 2: the shared module + the `_shared.ts` exception) | EC-6 |
| AC-7 | The move (AC-6) | CAM-554's (rewritten), CAM-562's, CAM-571's, and CAM-572's existing suites run | All pass green — no behaviour regression visible to any existing caller, and the rewritten AC-2/AC-3 assertions (AC-4's baseline) still pass unchanged after the file move | Confirmed by an actual `npx vitest run` against all 4 files + the full suite as the last act | EC-7 |

## Rules
- BR-1 A source-inspection test that greps ONE specific file's text for a literal string is a proxy for "the key is read securely" — it is not the invariant itself. The real invariant (key never returned, never logged, never `NEXT_PUBLIC_`-prefixed, never in a client component) must be provable independent of which server-side file performs the read (proves AC-1).
- BR-2 Where a source-inspection assertion checks a DIFFERENT surface than the one being refactored (client component files, which are not moving), keep it — it is not file-path-coupled to the implementation under change, it is a real, distinct, and still-cheap-to-check invariant (proves AC-2).
- BR-3 Where a behavioural test can exercise every branch a source-inspection assertion was trying to catch (here: all 3 `console.error` call sites, via mocked `fetch` failures), prefer the behavioural version — it proves the same thing by running the real code, and it does not go stale when the implementation moves (proves AC-3, per `.claude/rules/qa.md`'s "prefer a behavioral/measurable assertion over a source grep where the env allows").
- BR-4 A rewritten guard is proven with Prove-It: it must be shown green against current behaviour, then RED against a deliberately reconstructed violation, then green again once reverted — never trust a rewrite that has not been demonstrated to fail (proves AC-4/AC-5).
- BR-5 `_shared.ts::callGoogleGeocode`'s thin wrapper preserves its EXACT prior return contract (`{results: GoogleGeocodeResult[]} | null`) and its exact prior default-`region`/`language` behaviour — a strict behaviour-preserving translation onto `callGoogleGeocodeCore`, the same pattern CAM-572 already used for the 2 backfill scripts (proves AC-6).

## Edge cases
- EC-1 IF an assertion's protected invariant turns out to be covered nowhere else THEN it is rewritten, never deleted outright (BR-1/BR-3).
- EC-2 IF the "never in a client component" half were also deleted THEN a future accidental `GOOGLE_GEOCODING_API_KEY` reference inside `LocationPicker.tsx`/`LocationMapPin.tsx`/`CampgroundForm.tsx` would go undetected — it is kept precisely to prevent that (BR-2).
- EC-3 IF a future edit adds a `console.error(url...)` call on ANY of the 3 failure branches (HTTP error, Google status error, thrown exception) THEN the rewritten `it.each` fails on that branch specifically — not just the one branch the old regex happened to read (BR-3).
- EC-4 IF the rewrite were itself a silent behaviour change THEN it would fail against the CURRENT (pre-move) implementation — it does not; captured as the AC-4 baseline before any other file changes (BR-4).
- EC-5 IF the deliberate break (temporary `console.error(url.toString())`) were left in the diff THEN the shipped code would violate the very invariant this story hardens — it is reverted before commit; only the red-then-green proof is reported, never a to-be-reverted change staged (BR-4).
- EC-6 IF `_shared.ts`'s thin wrapper changed the `region`/`language` default behaviour THEN the 2 existing route suites' `[normal]`/`[boundary]` cases (unedited) would fail — they do not (BR-5).

## Data
No schema/DB change. Touched: `__tests__/cam-554-geocode-routes.test.ts` (2 assertions rewritten only), `app/api/geocode/_shared.ts` (`callGoogleGeocode` becomes a thin translation; header comment updated), `lib/geo/google-geocode.ts` (header comment updated — no functional change to `callGoogleGeocodeCore`/`extractComponent`). Migration: none.

## Seams & refs
- Reuse: `lib/geo/google-geocode.ts`'s `callGoogleGeocodeCore` (CAM-572) stays the single owner of the low-level fetch; `_shared.ts` becomes a thin translation on top of it, mirroring the pattern CAM-572 already used for both backfill scripts and for `extractComponent`. No parallel implementation created.
- Refs: CAM-572 `tech.md` ("Why `_shared.ts::callGoogleGeocode` stays a separate, documented exception" + "What was tried and reverted" — the exact failure this story closes) · CAM-554 `story.md` (the original key-safety invariant statement) · `.claude/rules/qa.md` ("The guard test asserts the fix's source is present" rationalization row) · CAM-581 `story.md` (same family: a guard that blocked working code, tightened rather than removed).

## Out of scope
- Any change to `scripts/**` or `e2e/**` — other agents are live there (CAM-578/579 per this dispatch's note); not touched.
- Assertion 5 (`NEXT_PUBLIC_GOOGLE` absence check) — unaffected by the file move (a not-contain assertion stays vacuously true either way) and not one of the 2 flagged assertions; left unedited.
- Any change to `scripts/backfill-cam-562-*.mjs` / `scripts/backfill-cam-571-*.mjs` / their consumers (`cam-575`/`cam-583`) — CAM-572 already consolidated these; re-run unedited only, to confirm nothing broke.

## Self-verify
- AC-1..3 → `tech.md`/PR body (the invariant trace + which half of each assertion was redundant vs kept).
- AC-4/AC-5 → `npx vitest run __tests__/cam-554-geocode-routes.test.ts` (green baseline) → deliberate break → red → revert → green (Prove-It, reported in the PR body).
- AC-6/AC-7 → `npx vitest run __tests__/cam-554-geocode-routes.test.ts __tests__/cam-562-geocode-backfill.test.ts __tests__/cam-571-coordinates-inside-thailand.test.ts __tests__/cam-572-google-geocode.test.ts` all green post-move; a repo-wide grep confirms exactly 1 `GOOGLE_GEOCODE_ENDPOINT` definition.
- Story-specific: no real Google API call anywhere in any test (global `fetch` always mocked, per the ticket's cost constraint); full `npx vitest run` as the LAST act; `npm run typecheck` clean; `npm run lint` 0 errors.
- Gate = `/quality-gate` · Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-27) — created.
