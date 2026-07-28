---
linear: CAM-621
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Admin
artifact: story
owner: devops-release
status: in-progress
version: v1
updated: 2026-07-28
---

## Story
As the **Admin** (repo/release maintainer), I want the `e2e-regression` CI job's real current stability established with fresh evidence before its advisory `continue-on-error` is removed, so that flipping it to a required check does not immediately block an innocent PR on a defect the suite itself cannot yet reliably pass.
Why: `ci.yml`'s own ">=10 consecutive green runs" criterion is a proxy for stability, not stability itself — CI history alone cannot show whether a live defect exists but simply hasn't been hit yet; a fresh, CI-faithful local reproduction can, and did.
Scope: (1) measure the real CI consecutive-green count at the JOB level (not the workflow-level conclusion, which `continue-on-error` can mask); (2) resolve the `ac3-logo-roundtrip` red/green question with evidence; (3) run the full suite locally, at least twice, under conditions that faithfully match `.github/workflows/ci.yml`'s own execution model (fresh seed each time, `workers: 1`); (4) recommend flip/no-flip on the evidence, not the ticket's premise. Does not touch branch protection, any `.spec.ts` file, or app/lib code — a defect found here is reported to its owning role, never fixed in this dispatch.
Depends on: CAM-604 (found the CSP-vs-Next.js-streaming-relocation-script defect, reported not fixed) · CAM-607 (fixed it — verified only in a **production** build under CPU-pressure fault injection, never under `next dev`) · CAM-612 (tightened the CSP-violation cap referenced by ac3's neighbour spec, `cam-607-csp-nonce-agreement.spec.ts`) · CAM-360 (fixed the logo-clear defect `ac3-logo-roundtrip.spec.ts` guards)

## AC
<!-- This ticket has no end-user-visible AC (a CI-stability verdict is an ops decision, not a feature) — "Then" is what a developer/CI observes, matching the CAM-604 precedent for this class of ticket. -->
| # | Given | When | Then (developer/CI observes) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The `e2e-regression` CI job's run history on GitHub Actions | Every completed job's own `conclusion` (not the workflow-level conclusion, which `continue-on-error: true` can mask) is read directly via `gh run view --json jobs` across the last ~60 CI runs | The real, current consecutive-green count is stated as a measured number, never repeated from the ticket's own claim unverified | No code change — a measurement, recorded in `tech.md` | — (this AC is itself the negative-case guard: never restate an unverified figure) |
| AC-2 | `e2e/regression/README.md` documents `ac3-logo-roundtrip.spec.ts` as "currently **RED**" against a named product defect (`CampgroundForm.tsx` sending `logo: undefined` instead of an explicit `null`) | The suite is run fresh and the fix commit history for that named defect is checked (`git log -S`) | The spec's true current state is stated plainly: **green**, in CI (29/29 straight job-level passes) and in every local run; the README note is **stale documentation** — the underlying defect was fixed by CAM-360 (`d62608f`) well before this arc | No code change (the README is outside this ticket's file surface; staleness is reported, not corrected here) | — |
| AC-3 | The full regression suite is run **at least twice**, matching `ci.yml`'s own execution model exactly (fresh seed each run via `migrate deploy` + `prisma/seed.ts`, `CI=true` → `workers: 1`, `retries: 0`) | Both runs complete | Every non-green spec across both (in practice, three) runs is reported by name with its real, quoted Playwright error — or it is stated plainly that there were none | If a spec fails, its exact error text + file:line is quoted (never paraphrased), so the finding is independently checkable | — |
| AC-4 | A failure reproduces on a fresh, CI-faithful run | The failure's evidence (accessible names, DOM shape, console log) is compared against this codebase's own existing investigation record (`docs/specs/`) for the same symptom class | The likely root cause is named with a citation to the prior ticket/commit, not re-guessed from scratch, and the flip/no-flip verdict follows the evidence | `continue-on-error` is removed only if the evidence supports it; otherwise a reasoned refusal is recorded here, in `tech.md`, and in the PR body | — |

## Rules
- BR-1 The consecutive-green count is measured at the **job level** (`e2e-regression`'s own `conclusion` field via `gh run view --json jobs`), never the workflow-level `conclusion` — `continue-on-error: true` makes a job that actually failed still report the overall WORKFLOW as green, so only the job-level figure is trustworthy. (proves AC-1)
- BR-2 A local repro run is only comparable to CI if it matches `ci.yml`'s exact execution model: a **fresh** DB (`DROP DATABASE` + `migrate deploy` + `seed.ts`, never a DB already exercised by a prior run) and `workers: 1` (`playwright.config.ts`: `workers: process.env.CI ? 1 : undefined` — an unset `CI` env var runs multiple parallel workers locally, which is not what CI does and confounds any comparison). A run that violates either condition is reported as a separate, weaker signal, never conflated with a CI-faithful run. (proves AC-3, EC-1)
- BR-3 A found failure is reported with its full Playwright error text + file:line, not paraphrased, and cross-checked against existing `docs/specs/` investigation records for the same symptom class before being called "new." (proves AC-4)

## Edge cases
- EC-1 IF a local run uses `workers: undefined` (parallel) or re-runs against an already-seeded DB with no reset THEN its failures are reported as a separate, weaker signal (a local-repeatability caveat for developer workflows), never conflated with a CI-faithful (`workers: 1`, fresh seed) run's failures. (BR-2)
- EC-2 IF the suite is found unstable under CI-faithful conditions THEN `continue-on-error` is **not** removed, and the PR states the concrete, cited reason instead — an honest refusal is a complete and valid outcome of this ticket, not a failure to complete it. (BR-3)
- EC-3 IF the queue is non-empty when this work lands THEN it is reported explicitly (checked: `gh pr list --state open` returned none at dispatch time and again before opening this PR). (dispatch instruction)

## Data
- No schema/migration. No app/lib code touched. Candidate surface was `.github/workflows/ci.yml`'s `e2e-regression` job (`continue-on-error`) — **left unchanged**, see verdict in `tech.md`. This docs folder is new.

## Seams & refs
- Reuse: `scripts/setup-e2e-db.ts` (DB provisioning, unmodified) · `e2e/regression/db-guard.ts` (BR-1 localhost-only guard, reused unmodified) — no parallel tooling written.
- Refs: CAM-604 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/`) · CAM-607 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/`) — the CSP-vs-streaming-relocation-script defect this ticket's own local reproduction most likely re-encountered, specifically under `next dev` (CAM-607 verified its fix only under `next build && next start`).

## Out of scope
- Fixing the CSP-vs-streaming-relocation-script defect under `next dev` (`proxy.ts` / `app/dashboard/loading.tsx` are shared, security-critical infra, outside this ticket's file surface) → recommend a follow-up ticket, scoped to re-verifying CAM-607's fix specifically under `next dev` (the exact server the e2e-regression suite and every local developer run against).
- Applying the branch-protection required-checks change → the owner applies this directly, per the dispatch (`ops.md`: branch protection is repo-wide and immediately-blocking).
- Editing any `.spec.ts` file to make it pass → explicitly out of bounds per the dispatch; a spec needing a change to pass is a finding to report, not a fix to make here.

## Self-verify
- AC-1 → owner-verify: `gh run list` + `gh run view --json jobs` walked across the last ~60 CI runs (script + raw counts in `tech.md`).
- AC-2 → owner-verify: `git log -S "isEditing ? null : undefined"` / `git log --grep` + direct file read of `CampgroundForm.tsx`; see `tech.md`.
- AC-3 → e2e: 2 CI-faithful local runs (`ci-like-run-A` fresh seed pass, `ci-like-run-B` fresh seed fail) + 1 confirmatory third fresh run (`ci-like-run-C`, also fail, different spec) — logs referenced in `tech.md`; plus 2 earlier, non-CI-faithful runs (parallel workers / no reset) reported separately per BR-2.
- AC-4 → owner-verify: root-cause citation to CAM-604/CAM-607 in `tech.md`; verdict = **do not flip `continue-on-error` yet**.
- Gate = `/quality-gate` — `npm run lint` (0 errors, pre-existing warnings only) · `npm run typecheck` (clean). No app/lib code changed, so `npm test` / `npm run build` are unaffected by this diff (not re-run against an unrelated baseline — stated as N/A, not fabricated).

## Changelog
- v1 (2026-07-28) — created; investigated `e2e-regression` stability, found the suite reproducibly unstable under `next dev` (a recurrence of the CAM-604/CAM-607 CSP-vs-streaming-relocation-script defect class, whose fix was verified only under a production build) — did not flip `continue-on-error`.
