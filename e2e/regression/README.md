# e2e/regression — E2E regression harness (CAM-359)

Drives the **real** host create/update/delete flows (edit round-trip, image/
logo persistence, validation UX, create, spot lifecycle) against a
**LOCAL-ONLY** database + the Next.js **dev server** (so `/api/upload`'s
dev-fallback path works with zero secrets). Never blocks a merge — the CI job
runs with `continue-on-error: true` (`.claude/rules/ops.md` §Gate policy v2
advisory-first rollout).

## CRITICAL — localhost-only, non-negotiable (BR-1)

This suite creates/deletes real rows. It **aborts before doing anything** —
before any seed/login/test — unless `DATABASE_URL`'s host is
`localhost`/`127.0.0.1`/`::1` (`e2e/regression/db-guard.ts`). Never point it
at a staging/shared/production `DATABASE_URL`.

## Running locally

**CAM-578 — this now actually works.** Before CAM-578, this section described
`.env.e2e` but no such file (not even a template) existed anywhere in the
repo, so the suite could not run for anyone who followed it literally. The
steps below are proven end-to-end (a clean `.env.e2e` → `npm run e2e:db:setup`
→ `PW_REGRESSION=1 npm run test:e2e:regression`, all 38 specs green) — see
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-578-local-e2e-harness/story.md`.

```bash
# One-time: install Playwright's chromium browser (shared with the visual-a11y project).
npx playwright install chromium

# 1. Copy the template and fill in your own local Postgres user.
#    DATABASE_URL is a DEDICATED e2e database (campvibe_e2e) — separate from
#    the `campvibe` DB your own `npm run dev` points at. This suite
#    creates/deletes real rows; it must never touch the DB you use for other
#    local work.
cp .env.e2e.example .env.e2e

# 2. Migrate + seed the dedicated e2e database (idempotent — safe to re-run;
#    creates the database itself if it does not exist yet; runs the guard
#    from step 3 first; never invokes `prisma generate`).
npm run e2e:db:setup

# 3. Run the suite (playwright.config.ts auto-loads .env.e2e when
#    PW_REGRESSION=1 is set; starts its own dev server on port 3100 by
#    default, override with E2E_PORT — never collides with your own
#    `npm run dev` on 3000):
PW_REGRESSION=1 npm run test:e2e:regression

# Run one spec only:
PW_REGRESSION=1 npx playwright test --project=regression e2e/regression/ac1-edit-round-trip.spec.ts
```

**No `.env.e2e` set up yet, or no local Postgres?** See `e2e/README.md`
§"When the seeded-DB harness isn't set up" for a zero-config direct-browser
fallback that needs neither.

**The language trap (read this before writing a new spec here).**
`global.setup.ts` forces `campvibe_lang=th` into the shared `storageState` —
**every regression spec renders Thai, never English.** A spec that looks up
an English accessible name (`getByRole(..., { name: "Previous image" })`)
will silently find 0 elements; it does not throw, it just fails the
assertion with a confusing "not found". This exact mechanism broke 6 specs
under CAM-570. If you need to assert English copy, drive a separate page
with `page.evaluate(() => localStorage.setItem("campvibe_lang", "en"))`
before navigating — never assume the shared storageState is English.

## What is in here

| File | Purpose |
|---|---|
| `db-guard.ts` | BR-1 localhost-only safety guard (also unit-testable directly via `npx tsx -e ...`) |
| `global.setup.ts` | The `regression-setup` project's setup test — runs the guard, signs in as `hoster@campvibe.com` via the real `/login` form, forces Thai copy (`campvibe_lang`), proves the session on `/dashboard`, persists `storageState` |
| `helpers.ts` | `findCampBySlug` / `getCampSite` — look up a seeded camp deterministically via the real API (no reliance on list sort order) |
| `ac1-edit-round-trip.spec.ts` | AC-1 — edit nameTh + priceLow, save, reopen: both persist |
| `ac2-album-image-roundtrip.spec.ts` | AC-2 — remove seeded album image, upload the fixture, save, reopen: Image relation reflects the swap |
| `ac3-logo-roundtrip.spec.ts` | AC-3 — logo set → cleared → set across 3 saves (currently **RED** — see `## Known defect`) |
| `ac4-validation-error-banner.spec.ts` | AC-4 — clearing required `nameTh` blocks save with the exact Thai banner + inline error + scroll/focus |
| `ac5-create-camp.spec.ts` | AC-5 — create-camp form creates one new owned `CampSite` row |
| `ac6-spot-lifecycle.spec.ts` | AC-6 — create a spot, see it in the spots list + availability picker, soft-delete, gone from both |
| `.auth/state.json` | Generated `storageState` (gitignored — real session cookies, never commit) |

## Known defect (AC-3)

`ac3-logo-roundtrip.spec.ts` is a deliberate **Prove-It** regression guard,
currently failing against a real, confirmed product defect: clearing a
campsite's logo and saving does not persist the clear (`components/
CampgroundForm.tsx` sends `logo: undefined` instead of an explicit `null`, so
`app/api/campsites/[id]/route.ts`'s partial-update guard skips the column
entirely). See `docs/specs/platform-core/e2e-regression-harness/CAM-359-
e2e-regression-suite/test.md` for the full repro + root-cause pointer. Do
**not** weaken or delete this test to make the suite green — it will go green
on its own once the fix lands.

## Why a Playwright "setup project" instead of `globalSetup`

`globalSetup` and every `webServer` array entry run/start **unconditionally**
for the whole `playwright test` invocation, regardless of `--project`
filtering (verified empirically). Sharing either with the existing advisory
`chromium` (visual-a11y) project would force this suite's local-DB guard and
dev server onto a job that has neither. Instead, `regression-setup` is a
normal Playwright project whose one test *is* the guard + login; `regression`
declares it as a `dependencies` entry, so it only runs when `regression`
itself is selected.

## CI job

The `e2e-regression` job in `.github/workflows/ci.yml`:
- `continue-on-error: true` + not a required check (advisory-first).
- Spins up its own `postgres:16` service container (never shared/staging).
- `prisma migrate deploy` + `tsx prisma/seed.ts` before the suite runs.
- Uploads `playwright-report/` as `e2e-regression-report`.

Flipping this job to a blocking, required check is a **separate future
decision**, gated on `>= 10 consecutive green runs with zero flakes`
(`story.md` BR-6) — out of scope here.
