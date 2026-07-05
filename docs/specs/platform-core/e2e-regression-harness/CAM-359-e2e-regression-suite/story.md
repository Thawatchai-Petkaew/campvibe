---
linear: CAM-359
feature: platform-core
epic: e2e-regression-harness (CAM-46)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-07-05
class: full
---
# E2E regression suite — harness + first 6 specs + advisory CI (CAM-359)

## Story
As the **Platform** (delivery team), I want a Playwright E2E regression harness plus a first suite of 6 specs that drive the **real** host create/update flows against a **local** database, so that behavioral regressions in the host forms (edit round-trip, image/logo persistence, validation UX, create, spot lifecycle) are caught before merge instead of by a user on staging (the project has zero behavioral tests of real flows today; recent escapes it would have caught: groundType serialization, album `images.split`, upload URL contract — not measured).
Why: every existing Vitest test is node-env unit / source-inspection — none exercises a real form → API → DB → re-render round-trip, which is exactly where the recent escapes lived.
Scope: stand up the harness (Playwright dev-server project · storageState login helper · localhost-only DB guard · idempotent/deterministic seed) and the first 6 regression specs, plus one **advisory** CI job. Does NOT flip CI to blocking, add visual baselines, or cover cross-browser.
Depends on: CAM-358 (upload URL contract fix — makes the dev-fallback upload URL valid; specs AC-2/AC-3 assume it is merged first).

## AC
<!-- Then = observable outcome; verbatim Thai copy where a fixed UI string is the assertion. AC-7/AC-8 are developer/CI-facing (dev-tooling messages are English by design — the Thai-copy rule governs end-user UI, not a test-harness abort). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Logged-in host on the edit form of a seeded, save-valid camp | Changes `nameTh` and `priceLow`, saves, then reopens the edit form | Lands back on the campsites list showing the new name; reopened form shows the new name and price (values persisted across the round-trip) | `CampSite.nameTh` + `priceLow` updated for that row; no new row | EC-6 |
| AC-2 | Edit form of a seeded camp that has ≥1 album image | Removes an album image, re-uploads a fixture image, saves, then reopens | Reopened form shows the album with the re-uploaded image present and the removed one gone | `Image` rows for that camp reflect the remove + add (relation updated, not the old CSV) | EC-2 |
| AC-3 | Edit form of a seeded camp | Uploads a logo, saves, reopens, removes the logo, re-uploads, saves, reopens | Reopened form shows the persisted logo after each save (present, then the re-uploaded one) | `CampSite.logo` updated on each save (set → cleared → set) | EC-2 |
| AC-4 | Edit form of a seeded, save-valid camp | Clears `nameTh` (empties the required field) and submits | Error banner `กรอกข้อมูลไม่ถูกต้อง: ชื่อแคมป์กราวด์ (ภาษาไทย)`, an inline error on the name field, and the view scrolls/focuses the Basic-Info card | No write; the PUT is not sent (client pre-check blocks) or returns 400; camp row unchanged | EC-6 |
| AC-5 | Logged-in host on the create-camp form | Fills the required fields with valid data and saves | Lands on the campsites list; the newly created camp appears in the list by name | One new `CampSite` row created, owned by the signed-in host | EC-2 |
| AC-6 | Logged-in host on a camp's spots page | Creates a spot, opens the availability page, then soft-deletes the spot from the spots page (`ลบจุดนี้ใช่หรือไม่ ประวัติการจองจะยังถูกเก็บไว้`) | New spot row appears on the spots page and as an option in the availability spot picker; after delete, toast `ลบจุดแล้ว`, the spot row is gone from the spots page AND gone from the availability picker | `Spot` created, then `deletedAt` set (soft-delete); gone from every list read | EC-4 |
| AC-7 | `DATABASE_URL` host is NOT localhost/127.0.0.1/::1 (e.g. the staging DB the main `.env` points at) | The e2e run starts | Run aborts before any seed/login/test with a clear message naming the offending host and how to point at a local DB (dev-facing, English) | Non-zero exit; no seed, no login, no mutation against the non-local DB | EC-1 |
| AC-8 | A PR into `staging` | CI runs | The new `e2e-regression` job runs and reports; a flake/red never blocks the merge gate (it is not a required check) | Job is `continue-on-error: true` + non-required; the Playwright report is uploaded as an artifact | EC-3, EC-5 |

## Rules
- BR-1 (safety guard — NON-NEGOTIABLE) The harness MUST abort before any seed/login/test unless `new URL(process.env.DATABASE_URL).hostname` ∈ {`localhost`, `127.0.0.1`, `::1`}. On violation: print a clear message naming the offending host + the fix (point `DATABASE_URL` at a local Postgres), then exit non-zero. If `DATABASE_URL` is unset, also abort. Reuse the refuse-on-prod pattern from `scripts/db-reset.mjs` (guard + masked URL). Rationale: the main `.env` points at the STAGING DB and this suite creates/deletes real rows — it must never run there. (proves AC-7 / EC-1)
- BR-2 (dev-server mode) The regression project runs against `npm run dev` (dev `webServer`), NOT the production build, so the `/api/upload` **dev-fallback** path works with zero secrets (no `BLOB_READ_WRITE_TOKEN`; the fallback branch is `NODE_ENV==='development'`-only per `app/api/upload/route.ts`). The existing advisory visual-a11y project stays on the prod build, unchanged. (proves AC-2/AC-3)
- BR-3 (seed determinism + save-validity) Seeding for e2e must be repeatable: running it against a freshly-reset local DB yields the same baseline every run. (a) Fix the non-idempotent `prisma.location.create` in `prisma/seed.ts` (line ~658 creates a new `Location` every run and orphans the previous ones) — use an upsert, or always reset-then-seed. (b) Seeded camps must be **save-valid** under the current `campSiteSchema` + form business rules: set `maxGuestsPerDay ≥ 1` (whole-camp) so an edit-save does not trip the whole-camp guard *before* reaching name/price validation. (c) Switch the seed runner in `package.json` `prisma.seed` from `ts-node` to `tsx` — the seed uses ESM `import.meta.url` and under `module:esnext` + no `type:"module"` the `ts-node` runner fails; `tsx` (already a devDep) runs it as-is. (proves AC-1/AC-4/AC-5; protects EC-4/EC-6)
- BR-4 (login helper via storageState) The Playwright `globalSetup` signs in ONCE as `hoster@campvibe.com` / `password123` (the seeded OPERATOR) by driving the real `/login` form (fill email + password, submit, wait for the post-login navigation) and persists `storageState` to a file; the 6 specs reuse it. One login per run stays under the `authorize()` rate limit (10 attempts / 15 min per IP, `lib/auth.ts`). Driving the UI lets the NextAuth v5 client `signIn` helper handle CSRF — do not hand-craft the CSRF token. (enables AC-1..AC-6)
- BR-5 (testid convention for new selectors) Every element a spec asserts that lacks a stable selector today gets a `data-testid` following `<type>--<module>-<detail>` (`.claude/rules/code.md`). The new ids to add are listed in `## Data`. Existing ids on the spots page, `SpotFormDialog`, and availability page are reused as-is.
- BR-6 (advisory-first CI + flip criterion) The new `e2e-regression` CI job is **advisory**: `continue-on-error: true` AND not a required status check, so a flake never blocks the merge gate (`.claude/rules/ops.md` §Gate policy v2 rollout: report-mode → clear the backlog to 0 → only then flip to blocking). Flipping to blocking is a **separate future owner decision**, gated on a stated stability criterion: **≥ 10 consecutive green `e2e-regression` runs with zero flakes** on staging-bound PRs. That flip is out of scope here.

## Edge cases
- EC-1 IF `DATABASE_URL` is unset OR its host is not localhost/127.0.0.1/::1 THEN the harness aborts before seeding with a clear dev-facing message and a non-zero exit (BR-1)
- EC-2 IF the upload fixture image is missing/unreadable THEN the upload/create spec fails fast with a clear "fixture not found" error, not a silent skip — commit a tiny valid PNG under `e2e/fixtures/` (BR-2)
- EC-3 IF the dev-server port (3000) is already in use THEN locally `webServer.reuseExistingServer` attaches to the running server; in CI (a fresh runner) it starts its own — the config must not hard-fail on a busy local port (BR-2)
- EC-4 IF the seed is re-run against an already-seeded DB THEN it must not crash or duplicate/orphan the baseline (idempotent upsert, or reset-then-seed) (BR-3)
- EC-5 IF the CI Postgres service is not yet ready THEN `migrate deploy` + seed wait on the service health-check before running; a not-ready DB surfaces as a real (advisory) failure with the artifact, never a false green (BR-6)
- EC-6 IF a seeded camp lacks `maxGuestsPerDay` THEN the whole-camp save guard fires before name/price validation and the round-trip/validation specs assert the wrong banner — the seed must set `maxGuestsPerDay ≥ 1` (BR-3)

## Data
- **Seed changes only — NO production schema change, NO migration.** `prisma/seed.ts`: make `Location` idempotent (upsert or reset-then-seed), set `maxGuestsPerDay ≥ 1` on whole-camp seeded camps (save-validity), and confirm the runner (`tsx`). The images-CSV → `Image`-relation and CSV-taxonomies → `options` conversions already exist in the seed (lines ~676–711) — no change needed there.
- **Test fixture:** a small valid PNG committed under `e2e/fixtures/` (the upload route validates magic bytes, so the fixture must be a real image).
- **New `data-testid`s** (added to existing components; no data-model impact) — see `## Seams & refs` for the file each lives in:
  - `input--campground-name-th`, `input--campground-name-en`, `input--campground-price-low`, `input--campground-price-high`, `btn--campground-save`, `alert--campground-validation` (CampgroundForm)
  - `dropzone--logo`, `btn--logo-remove` (LogoUpload)
  - `dropzone--album`, `btn--album-image-remove` (ImageUpload)
  - `input--login-email`, `input--login-password`, `btn--login-submit` (login page — needed only if the login helper does not use accessible label/role selectors)
  - `row--campsite-<id>` or `text--campsite-name-<id>` (campsites list row, so AC-5 can assert the created camp appears)

## Seams & refs
- Guard to reuse: `scripts/db-reset.mjs` (refuse-on-prod + masked URL) → adapt to a localhost-only check in the Playwright `globalSetup`.
- Harness files (G2/build owns the internals — pointers only): `playwright.config.ts` (add a `regression` project: `testDir: e2e/regression`, dev `webServer`, `storageState`, `globalSetup`; keep the existing chromium visual/a11y project intact) · `e2e/global-setup.ts` (guard + login) · `e2e/regression/*.spec.ts` (the 6 specs) · `e2e/fixtures/` (PNG) · `prisma/seed.ts` + `package.json` `prisma.seed` runner · `.github/workflows/ci.yml` (new advisory `e2e-regression` job — mirror the `visual-a11y` job template + a `postgres` service container).
- Login seam: NextAuth v5 Credentials at `/login`; the client `signIn` helper handles CSRF; persist `storageState`. Refs: `lib/auth.ts`, `app/login/page.tsx`.
- Forms/pages under test: `components/CampgroundForm.tsx` · `components/LogoUpload.tsx` · `components/ImageUpload.tsx` · `app/login/page.tsx` · `app/dashboard/campsites/page.tsx` (list) · `app/dashboard/campsites/[id]/spots/page.tsx` + `components/spot-form-dialog.tsx` + `app/dashboard/campsites/[id]/availability/page.tsx` (spots/availability selectors already present — reuse).
- Upload dev-fallback: `app/api/upload/route.ts` (dev-only local-FS branch). Dependency: **CAM-358** (upload URL contract).
- Rule refs: `.claude/rules/ops.md` §Gate policy v2 (advisory-first rollout) · `.claude/rules/qa.md` (test pyramid — e2e for critical flows only; assert Thai copy verbatim).

## Out of scope
- Flip `e2e-regression` CI to blocking → future owner decision after the stability criterion in BR-6 → follow-up ticket under CAM-46.
- Visual-regression baselines / screenshot diffing → that is CAM-230's advisory `visual-a11y` job; keep the two separate.
- Cross-browser matrix (firefox/webkit) → chromium only for now → follow-up under CAM-46.
- Prod smoke / staging E2E → this suite is localhost-only by BR-1; the existing `smoke` CI job covers deployed URLs.
- Suites beyond the first 6 flows (booking, review, search) → follow-on stories under CAM-46.
- Fixing the groundType / images.split / upload bugs themselves → already fixed; this suite GUARDS against their return.

## Self-verify
- AC-1..AC-6 → e2e (Playwright, dev-server, storageState) · AC-7 → e2e/unit (the guard aborts on a deliberate non-localhost `DATABASE_URL`) · AC-8 → CI config check (job present, `continue-on-error: true`, absent from required checks).
- Story-specific: guard runs BEFORE seed/login (BR-1); seed run twice → identical baseline, no orphan `Location` (BR-3/EC-4); a seeded camp is save-valid (`maxGuestsPerDay` set) so AC-1/AC-4 assert the correct banner (EC-6); login helper stays under the auth rate limit (BR-4); new testids follow `<type>--<module>-<detail>` (BR-5); the existing `visual-a11y` job + the blocking quality-gate stay green.
- Gate = `/quality-gate` (lint/typecheck/unit-test/build/audit; the new e2e job is advisory, NOT part of the blocking gate). **Done = the 6 specs pass locally against a localhost DB AND the advisory `e2e-regression` job runs on the PR (green, or advisory-red with an uploaded artifact).** The usual "verify AC on the real Staging URL" clause is **N/A for the harness itself** — it is intentionally localhost-bound (that IS BR-1); the harness is verified by its own green run, and AC-7 by a deliberate non-localhost abort.

## Changelog
- v1 (2026-07-05) — created (harness + first 6 specs + advisory CI; seed modernization scoped from the ground-truth trace).
