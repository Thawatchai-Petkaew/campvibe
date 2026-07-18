---
linear: CAM-397
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — First press after login works: gates read the live client session (CAM-397)

## Test strategy note (read first)

`components/CampgroundDetailClient.tsx` is a large stateful client component with **no jsdom/RTL render harness** in this repo's Vitest config (`environment: 'node'`) — the established, repo-wide pattern for this exact component (`__tests__/cam-396-booking-login-gate.test.ts`, `__tests__/cam-394-stream-reviews.test.ts`, `__tests__/cam-368-photo-modal-a11y.test.ts`). Two layers:

1. **Source-inspection Prove-It** — `handleReserve`/`handleWishlistToggle` bodies and the `isLoggedInLive` derivation are extracted/matched from the shipped `.tsx` source; every assertion is proven to FAIL against the pre-fix source and PASS against the fix (§ Prove-It below).
2. **Cross-file server contract** — `app/api/bookings/route.ts` (BR-2), `app/layout.tsx` + `components/Providers.tsx` (BR-3) asserted directly.

**What this does NOT cover** (browser-only — requires Playwright e2e or an owner check on the real localhost/Staging URL): the actual login-modal-then-first-press-succeeds TRANSITION (EC-2) — `useSession()` re-rendering after `LoginModal.handleSubmit`'s `update()` call is a real React re-render/timing behavior that a source-inspection test structurally cannot exercise. This is marked `owner-verify` below (per the qa.md rule promoted from the CAM-396 retro: "a state-dependent gate needs its transition path tested; browser-only transitions become explicit owner-verify AC rows").

## AC→test matrix

| AC/EC/BR | risk (H/M/L) | type | test (it-block name) | file | pass/fail |
|---|---|---|---|---|---|
| BR-1 — component imports `useSession` from `next-auth/react` | H | unit (source-inspection) | `[unit] the component imports useSession from next-auth/react` | `cam-397-live-session-gate.test.ts` | PASS |
| BR-1 — `isLoggedInLive` derives from `useSession().status === "authenticated"` | H | unit | `[unit] isLoggedInLive is derived from useSession().status === "authenticated"` | same | PASS |
| BR-1 — the stale `isLoggedIn` PROP is no longer read as a gate input anywhere | H | unit (Prove-It) | `[unit] the isLoggedIn PROP is no longer destructured/read anywhere as a gate input` | same | PASS |
| BR-1 — prop stays in the type (existing callers keep compiling) | M | unit | `[unit] the prop stays declared in the type (so existing callers keep compiling)` | same | PASS |
| AC-2 / EC-2 — `handleReserve` gates on `isLoggedInLive` before the `/api/bookings` fetch | H | unit (source-inspection) | `[unit] gates on isLoggedInLive before the /api/bookings fetch` | same | PASS |
| AC-2 — guest branch still opens `LoginModal` (unchanged mechanism, new variable) | H | unit | `[unit] the guest branch still opens the existing LoginModal (setLoginOpen) and returns` | same | PASS |
| AC-2 — visible/system result: the very first press after modal login books in one press | H | **owner-verify** (browser-only transition, see note above) | manual: see § Owner-verify steps 1-4 below | — | pending owner check on dev |
| AC-3 / EC-2 — `handleWishlistToggle` passes the live session into `runWishlistToggle` (util untouched) | H | unit (Prove-It) | `[unit] passes isLoggedIn: isLoggedInLive into the runWishlistToggle call (util itself untouched)` | same | PASS |
| AC-3 — the `useCallback` dependency array tracks `isLoggedInLive`, not the stale prop | M | unit | `[unit] the hook's dependency array tracks isLoggedInLive, not the stale prop` | same | PASS |
| AC-3 — visible/system result: first heart-press after modal login toggles in one press | H | **owner-verify** (browser-only) | manual: see § Owner-verify step 5 below | — | pending owner check on dev |
| BR-3 — root layout resolves the session server-side via `auth()` and passes it to `Providers` | M | unit (source-inspection) | `[unit] app/layout.tsx resolves the session server-side via auth() and passes it to Providers` | same | PASS |
| BR-3 — `Providers` hydrates `next-auth`'s `SessionProvider` with that session | M | unit | `[unit] Providers hydrates next-auth's SessionProvider with that session (CAM-242)` | same | PASS |
| BR-2 — server `401` remains authoritative (client gate is UX only) | H | unit (source-inspection of `app/api/bookings/route.ts`) | `[unit] POST /api/bookings still requires an authenticated session server-side` | same | PASS |
| AC-1 / EC-1 — guest gate still opens the login modal before any request (mechanism swap, behavior preserved) | H | unit (regression guard, Prove-It) | `[unit] handleReserve gates on the live session before the /api/bookings fetch` | `cam-396-booking-login-gate.test.ts` (updated) | PASS |
| AC-1 / EC-1 (cont.) | H | unit | `[unit] the guest branch opens the existing LoginModal (setLoginOpen) and returns` | same | PASS |
| AC-1 / BR-1 — no new UI introduced, reuses the existing `LoginModal` instance (unaffected by this diff) | M | unit | `[unit] no new UI/component introduced — reuses the wishlist gate's LoginModal instance` | same (unchanged) | PASS |
| AC-1 / EC-1 — boundary: login gate still precedes the date-selection guard | H | unit | `[unit] EC-1 (no dates chosen yet): the login gate precedes the date-selection guard` | same | PASS |
| BR-1 — null/empty/default-deny: `isLoggedInLive` is `true` ONLY on `"authenticated"` (loading/unauthenticated/undefined all gate as guest) | H | unit (Prove-It, replaces the CAM-396 prop-default test) | `[unit] CAM-397 default-deny: isLoggedInLive is only true when the session status is "authenticated"` | same (replaced) | PASS |

24/24 automated tests pass (11 in `cam-397-live-session-gate.test.ts` + 13 pre-existing/updated in `cam-396-booking-login-gate.test.ts`, 4 of which changed in this diff). 2 rows are `owner-verify` — both are EC-2, the one genuinely browser-only transition this story exists to fix; every other AC/BR/EC row is proven structurally.

### Coverage-matrix bucket justification (per `.claude/rules/qa.md` §7)

| Bucket | BR-1 (gate mechanism) | AC-2/AC-3 (reserve/wishlist gates) | EC-2 (transition) | BR-2/BR-3 |
|---|---|---|---|---|
| normal | ✅ `isLoggedInLive` correctly derived from `"authenticated"` | ✅ both handlers read the live value, not the prop | ⚪ N/A — see owner-verify | ✅ 401 guard + SessionProvider hydration both proven present |
| null/empty | ✅ default-deny test: `status` unresolved/`"loading"`/`undefined` all fail the strict `===` check → gated as guest | ⚪ N/A — same invariant, one derivation point | ⚪ N/A | ⚪ N/A — no null-input surface changed |
| boundary | ✅ EC-1: login gate still precedes the date-selection guard (guest w/ no dates chosen) | ⚪ N/A — unchanged branch order, only the variable swapped | ⚪ N/A | ⚪ N/A |
| error/validation | ⚪ N/A — this story is a variable-source swap, not a new validation surface (BR-1's default-deny test above IS this bucket for the derivation) | ⚪ N/A | ⚪ N/A | ✅ BR-2: server 401 stays authoritative regardless of the client gate |
| concurrent/ordering | ⚪ N/A — the race this story targets (login → immediate retry) is **exactly EC-2**; a source-inspection test cannot exercise a React re-render race, so it is not silently skipped, it is named the owner-verify row above | — | **This IS the concurrent/ordering case** — covered as owner-verify, not skipped | ⚪ N/A |

## Prove-It (red-before-green evidence — actually re-run, not asserted from the commit message)

Copied the post-fix `components/CampgroundDetailClient.tsx` aside, then overwrote it with `git show d2b89c8^:components/CampgroundDetailClient.tsx` (the CAM-396-fixed, pre-CAM-397 state — has the stale `isLoggedIn` prop gate, no `useSession`), and re-ran both test files:

```
npx vitest run __tests__/cam-397-live-session-gate.test.ts __tests__/cam-396-booking-login-gate.test.ts
 Test Files  2 failed (2)
      Tests  4 failed | 9 passed (13)
```

- `cam-397-live-session-gate.test.ts` — the **entire file fails to collect** (0 tests run): `extractHandleWishlistToggle`'s own guard `expect(end).toBeGreaterThan(start)` throws (`expected -1 to be greater than 15156`) because the pre-fix source has no `}, [isLoggedInLive` marker at all. This is the strongest possible red — every one of this file's 11 assertions depends on the fix.
- `cam-396-booking-login-gate.test.ts` — exactly the **4 touched tests** (the 3 gate-pin updates + the 1 replaced default-deny test) go RED; the other 9 (i18n, AC-2/AC-3 unrelated branches, BR-3 server contract) stay green because they don't touch this diff's lines:
  - `[unit] handleReserve gates on the live session before the /api/bookings fetch` (no `isLoggedInLive` string in pre-fix source → -1)
  - `[unit] the guest branch opens the existing LoginModal (setLoginOpen) and returns`
  - `[unit] EC-1 (no dates chosen yet): the login gate precedes the date-selection guard`
  - `[unit] CAM-397 default-deny: isLoggedInLive is only true when the session status is "authenticated"`

Restored the post-fix file from the saved copy → re-ran → **24/24 green** again. `git status --short` confirmed a clean tree before and after — no stray diff left in the component.

## Scrutiny of the 3 "updated" cam-396 assertions (dispatch instruction)

The dispatch names 3 updated pins; a 4th test in the same block was **replaced** (not just re-pointed) because its old invariant ("the `isLoggedIn` prop defaults to `false`") no longer applies — that prop is not read as a gate input at all post-fix. All 4 were verified above to fail red against the pre-fix source and pass green against the fix — re-pointing the pin to the new canonical gate variable (`isLoggedInLive`) is a **correct update**, not a weakening: the assertions still fail on a reverted/missing/misordered gate, which is the only thing they exist to catch.

Also independently verified no stray reference to the old `isLoggedIn` gate remains anywhere in the file (`grep -n "isLoggedIn" components/CampgroundDetailClient.tsx` → only the type declaration, comments, and the correctly-named `isLoggedIn: isLoggedInLive` argument passed into `runWishlistToggle`, whose parameter name is unrelated to this story's prop). Existing callers (`app/campgrounds/[slug]/page.tsx:111`, `app/wishlist/page.tsx:96`) still pass `isLoggedIn={...}` and compile unaffected.

## Coverage (metric honesty)

```
npx vitest run __tests__/cam-397-live-session-gate.test.ts __tests__/cam-396-booking-login-gate.test.ts --coverage --coverage.include="components/CampgroundDetailClient.tsx"

Statements   : 0% ( 0/240 )
Branches     : 0% ( 0/305 )
Functions    : 0% ( 0/67 )
Lines        : 0% ( 0/219 )
```

Real, measured, reported honestly as 0% — not "not measured." Identical structural reason as `CAM-396/test.md`: every assertion reads the component's source as a **string** (`fs.readFileSync`), so V8 instrumentation never sees the file execute. The behavioral floor for this diff is the **AC→test matrix above (24/24 automated tests PASS)** + the **Prove-It red/green demonstration**, not the v8 %. The story's diff to `components/CampgroundDetailClient.tsx` is 25 insertions / 5 deletions (`git show d2b89c8 --stat`); every changed line (the `useSession` import, the `isLoggedInLive` derivation, both `if (!isLoggedInLive)`/`isLoggedIn: isLoggedInLive` call sites, and the dependency array) is traced to a direct 1:1 assertion above.

## Full-suite run

```
npx vitest run
 Test Files  5 failed | 158 passed (163)
      Tests  4 failed | 6408 passed (6412)
```

No new failures introduced by this story's diff. All 5 failing files share **one root cause**: `@/prisma/delivery/generated/delivery-client` is not generated in this local env (no `DELIVERY_DATABASE_URL`) — confirmed pre-existing and unrelated to this story via `git diff origin/dev...HEAD --stat -- lib/delivery prisma/delivery __tests__/cam-215-sec-a-access-control.test.ts __tests__/delivery-client.test.ts __tests__/delivery-tickets-api.test.ts` (zero diff; last touched by an unrelated commit, `63ed6b6`, already on `dev` before this branch existed):

- `__tests__/delivery-client.test.ts` — 2 tests fail (`DELIVERY_DATABASE_URL is not set` / singleton caching) — named in the dispatch.
- `__tests__/delivery-tickets-api.test.ts` — whole suite fails to collect (`Cannot find module .../delivery-client`) — named in the dispatch.
- `__tests__/cam-215-sec-a-access-control.test.ts` — whole suite fails to collect, **same** missing-module error, via `lib/delivery/status-adapter.ts` → `lib/delivery/client.ts` — not explicitly named in the dispatch by filename, but confirmed same root cause, same family, zero relation to this story's diff.
- `__tests__/f5-account-misc.test.ts`, `__tests__/f6-palette-guard.test.ts` — worktree `git diff staging --name-only` artifacts (named in the dispatch).

## Quality gate summary (self-verify)

- `npm run lint`: 0 errors, 246 pre-existing warnings (none new, none in any touched test/component file).
- `npm run typecheck`: 22 pre-existing errors, all in `lib/delivery/*` / `__tests__/delivery-tickets-api.test.ts` — same missing-generated-client root cause as above; **zero** errors in `components/CampgroundDetailClient.tsx` or either test file this story touches.
- `npx vitest run __tests__/cam-397-live-session-gate.test.ts __tests__/cam-396-booking-login-gate.test.ts`: 24/24 pass.
- `npx vitest run` (full suite): 6408/6412 pass, 5 known env-dependent failing files (see above), no new failures.
- `npm run build`: not run — QA scope is test authorship/verification only per this dispatch; no production code was changed by QA (the fix already landed in commit `d2b89c8` before this dispatch).
- `npm audit`: out of scope for QA — routes to `security`.

## Defects found

None. The shipped fix (commit `d2b89c8`) matches every AC/BR/EC in `story.md`: both gates read `isLoggedInLive`, the stale prop is no longer a gate input anywhere, BR-3's `SessionProvider` hydration precondition already held (no change needed), and BR-2's server-side 401 is untouched. No production code was touched by QA — the 4 updated `cam-396` assertions + the new `cam-397` test file are the only additions, and all are test-suite changes, not fixes to a defect in the shipped code.

## Owner-verify (localhost, dev DB) — before Done

EC-2 is a browser-only React re-render TRANSITION (`useSession()` updating after `LoginModal.handleSubmit`'s `update()` call) that a source-inspection test structurally cannot exercise. Per the qa.md rule promoted from the CAM-396 retro, this is named an explicit owner-verify row, not silently skipped. Exact steps on `localhost` (dev DB):

1. As a guest (no session), open a campground detail page, select check-in/check-out dates. Confirm AC-1 still holds: pressing "จอง" opens `LoginModal`, no request fires (regression check, not new behavior).
2. Log in through the modal with valid credentials — do **not** manually reload/refresh the page.
3. Immediately after the modal closes, press "จอง" **one time**. Expected (AC-2): navigates straight to the booking confirmation page on this **first** press — no re-opened login modal, no second press needed. Check the Network tab: exactly one `POST /api/bookings`, no unauthenticated attempt first.
4. Repeat steps 1-2 (fresh guest session, log in via modal, no reload), then press the wishlist heart button **one time**. Expected (AC-3): the saved/heart-filled state flips immediately on this first press — no reload, no second press.
5. Record pass/fail for each step against this row in the AC→test matrix above; AC-1's regression check (step 1) is lower-risk since the unit tests already cover it structurally — spot-check only.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` (transition-testing rule, promoted from the CAM-396 retro) · `__tests__/cam-397-live-session-gate.test.ts` · `__tests__/cam-396-booking-login-gate.test.ts` (4 assertions updated) · `components/CampgroundDetailClient.tsx` (`handleReserve`, `handleWishlistToggle`) · `app/api/bookings/route.ts` (unchanged, BR-2) · `app/layout.tsx` + `components/Providers.tsx` (unchanged, BR-3 precondition) · precedent: `docs/specs/.../CAM-396-guest-booking-dead-end-pressing-book-shows-a-raw-f/test.md`

## Changelog
- v1 (2026-07-18) — created: AC→test matrix, Prove-It red/green re-run, coverage + full-suite run, owner-verify steps for EC-2
