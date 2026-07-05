---
linear: CAM-359
feature: platform-core
epic: e2e-regression-harness (CAM-46)
persona: platform
artifact: test
owner: qa-engineer
status: In Review
version: v1
updated: 2026-07-05
---
# Test — E2E regression suite — harness + first 6 specs + advisory CI (CAM-359)

## Summary

The harness (BR-1 guard, dev-server Playwright project, storageState login, seed
fixes, testids) is fully built and proven. **5 of 6 specs are green; AC-3 is
RED against a real, confirmed product defect** discovered live by the harness
(exactly the kind of escape this epic exists to catch — see `## Defects
found`). Per `.claude/rules/qa.md` this is left in the suite as a permanent
Prove-It regression guard, not weakened or deleted, and the story is reported
`blocked` pending that fix (owned by `frontend`/`backend`, not QA).

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (edit round trip) | H | e2e | `e2e/regression/ac1-edit-round-trip.spec.ts` | ✅ PASS |
| AC-2 (album image round trip) | H | e2e | `e2e/regression/ac2-album-image-roundtrip.spec.ts` | ✅ PASS |
| AC-3 (logo round trip) | H | e2e | `e2e/regression/ac3-logo-roundtrip.spec.ts` | ❌ FAIL (real defect — see below) |
| AC-4 (validation error banner) | H | e2e | `e2e/regression/ac4-validation-error-banner.spec.ts` | ✅ PASS |
| AC-5 (create camp) | H | e2e | `e2e/regression/ac5-create-camp.spec.ts` | ✅ PASS |
| AC-6 (spot lifecycle) | M | e2e | `e2e/regression/ac6-spot-lifecycle.spec.ts` | ✅ PASS |
| AC-7 (BR-1 localhost guard) | H | unit + e2e | `e2e/regression/db-guard.ts` (proven via `npx tsx -e ...`) + `e2e/regression/global.setup.ts` (proven via a deliberate non-local `DATABASE_URL` run) | ✅ PASS |
| AC-8 (advisory CI job) | M | CI config check | `.github/workflows/ci.yml` `e2e-regression` job | ✅ PASS (config-level: `continue-on-error: true`, no `needs`/required-check wiring, artifact upload present; the job itself has not run inside a real GitHub Actions runner as part of this dispatch — see `## Limitations`) |

Type mix: 0 unit-only / 1 unit+e2e hybrid (AC-7) / 7 e2e — deliberately e2e-heavy. This
story's whole point is exercising the real form→API→DB seam an inverted-pyramid
warning would normally flag; every other layer (zod, API route logic) already has
Vitest coverage from prior stories, and the harness itself is new infrastructure with
no unit-testable "logic" beyond the guard (which IS unit-tested).

## Guard proof (BR-1 / AC-7 / EC-1)

Proven at two levels, both real runs:

**1. Standalone (`e2e/regression/db-guard.ts` in isolation, before anything else was built):**

```
--- fake remote (staging-shaped) DATABASE_URL ---
✗ e2e-regression: DATABASE_URL host "db.prisma.io" is NOT localhost.
  Offending URL (masked): postgres://***@db.prisma.io:5432/postgres?sslmode=require
  ...
exit code: 1

--- unset DATABASE_URL (EC-1) ---
✗ e2e-regression: DATABASE_URL is not set.
exit code: 1

--- local DATABASE_URL ---
GUARD PASSED — proceeding
exit code: 0
```

**2. End-to-end through the real harness** (`--project=regression-setup`, a fake
remote `DATABASE_URL`):

```
✗ e2e-regression: DATABASE_URL host "db.prisma.io" is NOT localhost.
  Offending URL (masked): postgres://***@db.prisma.io:5432/postgres?sslmode=require
  This suite creates/deletes REAL rows and must NEVER run against a
  shared/staging/production database.
  ...
  ✘  1 [regression-setup] › .../global.setup.ts:34:6 › authenticate as the seeded host ... (0ms)
  1 failed
```

No seed/login/test ran; the invocation exited non-zero; no `storageState` file
was written. Restoring the local `DATABASE_URL` and re-running produced a
clean login + `storageState` capture.

## Seed fixes (BR-3)

- **(a) Idempotent `Location`** — `prisma/seed.ts`'s bare `prisma.location.create`
  inserted a new row every run and orphaned every previous run's rows. Replaced
  with an application-level `findFirst` (natural key: country+province+lat/lon)
  + update-or-create — no schema/migration change (Data section: seed-only).
- **(b) Save-validity** — `maxGuestsPerDay` (BR-3(b) as specified) **and**
  `maxTentsPerDay` (discovered live while proving AC-1 — see `## Deviations`)
  both default to `20`/`10` on any seeded camp that doesn't set them, since
  `campSiteSchema`'s `.min(1)` rule on both fields rejects the form's own
  `?? 0` initializer for an unset value.
- **(c) Runner** — `package.json` `prisma.seed`: `ts-node` → `tsx` (the seed's
  ESM `import.meta.url` fails under `ts-node` + `module:esnext` + no
  `type:"module"`; `tsx` runs it as-is, no seed-file change needed).

**Idempotency proof** (real runs, local DB):

```
$ DATABASE_URL=...local... npx prisma migrate reset --force --skip-generate   # run #1
🎉 Seeding completed successfully!
$ DATABASE_URL=...local... npx prisma migrate reset --force --skip-generate   # run #2
🎉 Seeding completed successfully!

$ psql ... -c 'select count(*) from "Location";'   →  12
$ psql ... -c 'select count(*) from "CampSite";'    →  12
```

Ran a 3rd bare `npx tsx prisma/seed.ts` (no reset) on top — still exactly 12/12,
zero orphans, zero duplicates, zero crash.

## Login / storageState proof (BR-4)

`e2e/regression/global.setup.ts` (a Playwright "setup project" — see
`## Deviations` for why this replaced a shared top-level `globalSetup`) drives
the real `/login` form as `hoster@campvibe.com`, waits for the real
post-login navigation, sets `campvibe_lang=th` in `localStorage` (so every
spec loads pre-set to Thai — `contexts/LanguageContext.tsx` otherwise
defaults to `"en"`), then **proves** the session before saving it: navigates
straight to `/dashboard` (an auth-gated route per `lib/auth.config.ts`
`isRouteAllowed`) and asserts the nav renders (`แคมป์ไซต์ของฉัน` visible), only
then captures `storageState`. Verified real run:

```
✓  1 [regression-setup] › .../global.setup.ts:34:6 › authenticate as the seeded host ... (2.7s)
1 passed (6.6s)
```

`e2e/regression/.auth/state.json` inspected directly: 3 cookies, 1 origin
(`http://localhost:3100`), `localStorage: [{ name: 'campvibe_lang', value: 'th' }]`.

## Testids added (BR-5)

| testid | file |
|---|---|
| `input--campground-name-th`, `input--campground-name-en`, `input--campground-price-low`, `input--campground-price-high`, `btn--campground-save`, `alert--campground-validation` | `components/CampgroundForm.tsx` |
| `dropzone--logo`, `btn--logo-remove` | `components/LogoUpload.tsx` |
| `dropzone--album`, `btn--album-image-remove` | `components/ImageUpload.tsx` |
| `input--login-email`, `input--login-password`, `btn--login-submit` | `app/login/page.tsx` |
| `row--campsite-<id>` | `app/dashboard/campsites/page.tsx` |

All additive attributes only — zero behavior/markup-structure change to any
component. `row--spot-<id>` / `btn--spot-delete-<id>` / `select--availability-spot`
etc. already existed (CAM-352/CAM-56) and are reused as-is per the story's
Seams & refs.

## Coverage

Not a Vitest coverage number — this story adds a Playwright e2e harness, not
new `lib`/`app` production logic (the seed/component changes are additive
testids + a save-validity default + an idempotent upsert, each individually
tiny and covered by the very e2e specs that depend on them passing). New-code
coverage in the `≥80% on new code` Vitest sense: **not applicable** to the e2e
harness files themselves (Playwright specs aren't instrumented by
`v8`/Vitest coverage); the existing Vitest suite's coverage gate is unaffected
by this story (no new `lib`/`app` logic added, only additive testids + the
CampgroundForm/api-route behavior already covered by `__tests__/cam-356-*`).

## Full local regression run (real, after a clean `prisma migrate reset --force`)

```
$ PW_REGRESSION=1 npx playwright test --project=regression

Running 7 tests using 5 workers

  ✓  1 [regression-setup] › global.setup.ts:34:6 › authenticate as the seeded host ... (1.7s)
  ✓  2 [regression] › ac4-validation-error-banner.spec.ts:18:5 › ... (2.6s)
  ✓  3 [regression] › ac2-album-image-roundtrip.spec.ts:23:5 › ... (5.9s)
  ✓  4 [regression] › ac5-create-camp.spec.ts:12:5 › ... (5.4s)
  ✘  5 [regression] › ac3-logo-roundtrip.spec.ts:41:5 › ... (5.6s)   ← real defect, see below
  ✓  6 [regression] › ac1-edit-round-trip.spec.ts:16:5 › ... (5.0s)
  ✓  7 [regression] › ac6-spot-lifecycle.spec.ts:21:5 › ... (7.7s)

  6 passed, 1 failed (16.2s)
```

## Defects found

**DEFECT-1 — Clearing a campsite's logo does not persist (silent no-op on save)**

- **Severity:** Important (data-integrity / confusing UX on an existing,
  shipped dashboard feature — not a security/crash issue, but the host's
  save silently does not do what the UI shows).
- **Failing AC:** AC-3 (`CampSite.logo updated on each save (set → cleared →
  set)`), specifically the "cleared" step.
- **Repro (exact steps):**
  1. Sign in as `hoster@campvibe.com` / `password123`, open
     `/dashboard/campsites/{any camp}/edit`.
  2. Upload a logo (any valid image) via the logo dropzone, click "อัปเดต"
     (Save). Reopen the edit form — logo shows correctly (this half works).
  3. Click the logo's remove (X) button — the dropzone reverts to empty in
     the UI. Click "อัปเดต" (Save).
  4. Reopen the edit form (or `GET /api/campsites/{id}`).
- **Expected:** `CampSite.logo` is `null`/empty; the form shows the empty
  dropzone.
- **Actual:** `CampSite.logo` is unchanged — still the URL from step 2. The
  UI's "clear" is not persisted at all; the old logo silently reappears on
  reopen.
- **Root cause (pointer only — QA does not fix):**
  `components/CampgroundForm.tsx` `handleSubmit` builds the PUT payload with
  `logo: formData.logo || undefined` — clearing sets `formData.logo` to `""`,
  which this line turns into `undefined`, and `JSON.stringify` drops
  `undefined` keys entirely. Server-side, `app/api/campsites/[id]/route.ts`
  guards the update with `...(data.logo !== undefined && { logo: data.logo ||
  undefined })` — since the key is absent, `data.logo` is `undefined` and the
  whole spread is skipped, so the column is never touched. This is the exact
  "explicit `null` to clear" bug class CAM-341 already fixed for
  `extraFeeLabel`/`cancellationPolicy` (see the code comment at that line) —
  `logo` was missed.
- **Trace excerpt** (real Playwright failure, no secrets):
  ```
  Error: expect(received).toBeFalsy()
  Received: "/uploads/campvibe-upload-1783215410503-458706842.png"
    at e2e/regression/ac3-logo-roundtrip.spec.ts:69:31
  ```
- **Regression guard:** `e2e/regression/ac3-logo-roundtrip.spec.ts` stays in
  the suite, currently RED, and will go green (and stay as a permanent guard)
  the moment `frontend`/`backend` sends an explicit `null` for a cleared
  `logo` the same way CAM-341 already does for `extraFeeLabel`.
- **Handoff:** not fixed here (QA does not write production code). Route to
  `frontend`/`backend` as a sub-ticket under this epic (CAM-46) — no ticket
  DB access in this dispatch; the orchestrator opens the real sub-ticket from
  this report.

No other defects found. AC-1, AC-2, AC-4, AC-5, AC-6 are all green against
real, freshly-seeded data.

## Deviations from the story's pointer-only Seams & refs (build owns the internals)

1. **`e2e/regression/global.setup.ts` is a Playwright "setup project"
   (official `dependencies` pattern), not a shared top-level `globalSetup`
   hook.** Verified empirically (see PR body) that Playwright invokes
   `globalSetup` — and starts every `webServer` array entry — unconditionally
   for the WHOLE run regardless of `--project` filtering. A shared
   `globalSetup` (the BR-1 guard + a real `/login`) or an unconditional
   second `webServer` (the dev server) would have been forced onto the
   existing advisory `chromium` visual-a11y project too, which has no local
   DB/dev-server and must stay completely unaffected (BR-2). Instead: a
   `regression-setup` project (`testMatch: /global\.setup\.ts/`) that only
   `regression` depends on — a dependency only runs when the project
   depending on it is selected, proven with a throwaway 2-project Playwright
   config before touching the real one. `webServer` stays a single object,
   chosen once via the `PW_REGRESSION` env var, so at most one server ever
   starts per invocation.
2. **`.github/workflows/ci.yml`'s existing `visual-a11y` job gained one
   explicit `--project=chromium`** on its `npx playwright test` line — a
   required, minimal consequence of #1 (without it, that job would now also
   attempt the `regression`/`regression-setup` projects and fail on the
   missing local DB). No other change to that job.
3. **`prisma/seed.ts` also defaults `maxTentsPerDay`** (BR-3(b) only named
   `maxGuestsPerDay`) — discovered live while proving AC-1: EVERY seeded
   camp's save previously failed the exact same whole-camp-guard-adjacent
   `campSiteSchema.min(1)` rule on the sibling field, which none of the 12
   camps set (defaults to `0` client-side). Same rule, same fix, same reason
   as `maxGuestsPerDay`.
4. **AC-3 is red** — a real, confirmed product defect (DEFECT-1 above), not a
   harness/test-authoring problem. Left in the suite per Prove-It.

## Quality gate

- `npm run lint` — see PR self-verify section.
- `npm run typecheck` — see PR self-verify section.
- `npm test` (Vitest) — see PR self-verify section (unaffected by this story;
  testid additions checked against any source-inspection guard).
- `npx playwright test --project=regression` — 6/7 real run (1 known,
  documented, filed defect — AC-3).
- `npm run build` — see PR self-verify section.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/ops.md` §Gate
policy v2 (advisory-first rollout, BR-6's flip criterion)

## Changelog

- v1 (2026-07-05) — created: harness built + proven (BR-1 guard, seed fixes,
  storageState login, testids, 6 specs, advisory CI job). 5/6 specs green;
  AC-3 red against a real, confirmed defect (DEFECT-1) — story reported
  `blocked` pending that fix.
