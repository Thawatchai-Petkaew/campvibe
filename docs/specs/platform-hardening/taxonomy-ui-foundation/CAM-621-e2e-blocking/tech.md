---
linear: CAM-621
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Admin
artifact: tech
owner: devops-release
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — is `e2e-regression` stable enough to block a merge? (CAM-621)

## 0. Verdict, up front

**Do not remove `continue-on-error: true` from the `e2e-regression` job yet.** `continue-on-error` at `.github/workflows/ci.yml:111` is unchanged in this PR. Across 3 fresh, CI-faithful local reproductions (identical execution model to the real CI job: a brand-new seeded DB + `workers: 1`, matching `playwright.config.ts`'s `workers: process.env.CI ? 1 : undefined`), **2 of 3 failed** — each on a different spec, both bearing the signature of an already-known, already-partially-fixed defect (§3). The ">=10 consecutive green CI runs" criterion is real and exceeded (§1), but it measures the wrong thing here: it can only report runs that happened to avoid a race window, never prove the race is gone.

## 1. The real consecutive-green count, measured at the job level

`ci.yml:111`'s `continue-on-error: true` makes a job that internally FAILED still report at the workflow level as green — so the ticket's "last 20 CI runs are all green" claim, and this ticket's own BR-1, insist on reading the `e2e-regression` JOB's own `conclusion`, not the workflow's.

Method: `gh run list --workflow=ci.yml --limit 60 --json ...` (all triggers: `push`/`pull_request` on `dev`/`staging`/`main`) → for each completed run, `gh run view <id> --json jobs --jq '.jobs[] | select(.name=="e2e-regression")'`.

Result (59 completed runs fetched, spanning 2026-07-28T05:27Z → 11:52Z):
- **The job's own `conclusion` is `failure` 3 times** in this window: `fix/cam-619-validation-asymmetry` @ 09:41:32Z, `fix/cam-616-failure-is-not-emptiness` @ 09:50:24Z and again @ 10:01:23Z. All three are **pre-merge iteration failures on an in-flight feature branch** (the developer's own branch going red before their fix landed, then green afterward) — not a failure on a merged/protected-branch commit.
- **The current unbroken streak is 29 consecutive job-level green runs**, counting back from the most recent COMPLETED run (`dev` push, 2026-07-28T11:52:03Z) to just after the last of those three failures (10:01:23Z). One further `dev` push (11:58:29Z) was still in progress at measurement time and is excluded (not yet `completed`).
- This **exceeds** both the ticket's claimed "last 20" and BR-6's `>=10` criterion — the numeric claim in the ticket was, if anything, an understatement, not an overstatement.

Raw per-run job conclusions are in the session scratchpad (`e2e-job-conclusions.txt`, 59 rows); not reproduced here per `efficiency.md` (detail → file, not pasted).

## 2. `ac3-logo-roundtrip.spec.ts` verdict

`e2e/regression/README.md:75` and its "## Known defect (AC-3)" section (lines 81-91) still document this spec as **currently RED** against: "`components/CampgroundForm.tsx` sends `logo: undefined` instead of an explicit `null`, so `app/api/campsites/[id]/route.ts`'s partial-update guard skips the column entirely."

Checked directly against the live code (`components/CampgroundForm.tsx:691`):
```ts
logo: formData.logo === "" ? (isEditing ? null : undefined) : formData.logo,
```
This is exactly the fix the README describes as missing. `git log -S`/`--grep` on this file:
```
d62608f fix(cam-360): clearing the camp logo persists (explicit null)
52e8ed6 Merge pull request #371 from Thawatchai-Petkaew/fix/cam-360-logo-clear
```
CAM-360 is well ahead of today's arc in history (predates CAM-374/423/429 in `git log`). **Verdict: the README note is stale documentation, not a live defect.** The spec is green — confirmed in CI (part of every one of the 29 straight `e2e-regression` job passes, since `ac3-logo-roundtrip.spec.ts` is not excluded from the `regression` Playwright project) and green on every isolated fresh local run (`ci-like-run-A`, first pass of `ci-like-run-B`/`C` before the DB carried state — see §4). It is **not** in this ticket's file surface to correct `e2e/regression/README.md` (out of the allowed surface: `.github/workflows/ci.yml` + this docs folder only) — flagged here as a follow-up, not fixed.

## 3. What the sweep found sitting inside the suite — the real, reproducible instability

### 3.1 Method: two run classes, deliberately not conflated (BR-2)

`playwright.config.ts:64`: `workers: process.env.CI ? 1 : undefined`. Running `npm run test:e2e:regression` **without** setting `CI` locally uses MULTIPLE parallel workers (not CI's behavior) — so two run classes were kept strictly separate:

- **Local-dev run** (`workers: undefined`, i.e. parallel; DB seeded once, run twice back-to-back with NO reset in between) — a realistic developer-repeat scenario, but NOT equivalent to CI. Reported as a weaker, confounded signal (EC-1).
- **CI-faithful run** (`CI=true` set → `workers: 1`; DB **dropped and re-seeded fresh** before every single invocation, exactly matching the CI job's own ephemeral-Postgres-per-job model) — this is the comparison that actually matters.

### 3.2 Local-dev run (parallel, no reset) — weaker signal, reported per BR-2/EC-1

- Run 1 (fresh seed): **82/82 passed.**
- Run 2 (same DB, immediately after, no reset): **2 failed.**
  - `ac3-logo-roundtrip.spec.ts` — `expect(page.getByTestId("dropzone--logo")).toBeVisible()` timed out; "element(s) not found." Root cause: run 1 left the seeded camp WITH a logo set (its own last step re-uploads one); run 2's Step 1 assumes the dropzone is showing (i.e., no logo yet), which the form only renders when no logo is present. This falsifies the spec's own header comment ("stays repeatable even if run twice ... without a reset in between") for a same-DB re-run — a real repeatability gap in the spec's own claim, but **not** something the CI job can ever hit (CI seeds fresh exactly once per job, never runs the suite twice against the same DB).
  - `ac6-spot-lifecycle.spec.ts` — `getByTestId('btn--availability-add')` resolved to **2 elements**: one named `เพิ่มช่วงวันปิด` (Thai, correct), one named `Add blocked dates` (the literal English string for the same i18n key, `locales/translations.json:883`). Same signature reproduced again in the CI-faithful run (§3.3) — see there for the root-cause analysis.

### 3.3 CI-faithful runs (fresh seed + `workers: 1`, matching `ci.yml` exactly) — the decisive signal

- **Run A** (fresh seed): **82/82 passed.** (WebServer log shows a benign hydration-mismatch console warning on `/` — a `placeholder-camp-dark.svg` vs `placeholder-camp.svg` `src` mismatch — and one `ECONNRESET`/`aborted` (the known CAM-603 keep-alive race, already retried/guarded); neither failed a test.)
- **Run B** (DB dropped, re-seeded fresh): **1 failed** — `cam-540-dialog-select-dismiss.spec.ts:65`:
  ```
  Error: expect(locator).toHaveCount(expected) failed
  Locator:  locator('[role="dialog"]')
  Expected: 1
  Received: 2
  Call log: 14 × locator resolved to 2 elements — unexpected value "2"
  ```
  This assertion fires immediately after opening the home-page search modal — before any of the spec's actual AC-1/2/3 sequence. Two `[role="dialog"]` nodes existed transiently.
- **Run C** (DB dropped, re-seeded fresh again): **1 failed** — `ac6-spot-lifecycle.spec.ts:55`, the **exact same signature** as §3.2's local-dev run 2: `btn--availability-add` resolved to 2 elements, `เพิ่มช่วงวันปิด` (Thai) vs `Add blocked dates` (English), on a completely fresh DB this time — ruling out "leftover state from a prior run" as the cause.

**Net: 2 of 3 fresh, CI-faithful runs failed**, on two different specs, both showing the same class of symptom: a Playwright strict-mode "resolved to 2 elements" duplicate-DOM violation.

### 3.4 Root-cause citation — this is a known, only-partially-verified defect class, not a new mystery

`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/` (found, reported, not fixed there) and `.../CAM-607-csp-streaming-script/` (fixed) already documented this exact mechanism: our CSP (`proxy.ts`) blocks Next.js's own inline streaming-segment-relocation `<script>`, so a streamed page segment is never moved into place and a **stray duplicate copy of the page subtree** is left behind in a Flight container (`<div id="S:1">`) under `<body>` — "affects EVERY `/dashboard/**` route... a duplicated DOM subtree means duplicated ids, duplicated form controls" (CAM-607 ticket body).

Critically, CAM-607's own `tech.md` states its verification method **explicitly**: "`next build && next start` on a spare port... 7 saturating `child_process.fork` busy-loop workers... polling `page.locator('body > div[id^="S:"]')`" — **a production build, under deliberate CPU-pressure fault injection.** It was never verified against `next dev`. `playwright.config.ts`'s `regression` project runs the suite against **`npm run dev`** ("the Next.js DEV server instead," comment at line ~124) — the exact mode CAM-607's fix has never been checked in.

The evidence lines up:
- `ac6-spot-lifecycle`'s duplicate button shows the SAME testid/class with TWO DIFFERENT accessible names (Thai vs the literal English string for the identical i18n key) — consistent with a stray, un-relocated SERVER-streamed copy (rendered before the e2e harness's forced `campvibe_lang=th` localStorage value takes effect client-side) sitting alongside the corrected client-hydrated copy, rather than two genuinely independent buttons.
- `cam-540`'s duplicate `[role="dialog"]` is the same shape on a **different route** (`/`, not `/dashboard/**`) — CAM-604's own "Out of scope" note already flagged this mechanism as "route-agnostic... plausibly affects OTHER" routes; the Home page's own React tree uses a `<Suspense fallback={<div>}>` boundary (visible in an unrelated hydration-warning stack trace captured in run 1 and run A), the exact boundary type CAM-607's fix targets.
- Both CI-faithful passing AND failing runs' WebServer logs show benign (non-fatal) hydration-mismatch console warnings on `/` unrelated to the specific failing assertion (badge text, image `src`) — the same "server default state vs client-corrected state disagree" family, occurring under ordinary load with no fault injection needed.

**This is very likely the CAM-604/CAM-607 defect class recurring specifically under `next dev`**, a server mode CAM-607's fix was never verified against. It reproduces under ordinary load (no CPU-pressure injection required) at roughly a 2-in-3 rate across this small local sample — high enough that promoting this suite to a required check today would very likely fail an innocent PR within its first few runs, exactly the "revert by lunchtime" scenario `.claude/rules/ops.md`'s report-mode-then-blocking rule warns against.

## 4. Recommendation

1. **Do not remove `continue-on-error` now.** (done in this PR: `ci.yml` unchanged)
2. Open a follow-up ticket (backend/devops) to re-verify CAM-607's fix specifically under `next dev` — the server this suite and every local developer actually run against — and to trace whether the Home page (`/`) is also in the defect's blast radius (CAM-604 only speculated about other `/dashboard/**` routes).
3. Correct the stale `e2e/regression/README.md` "Known defect (AC-3)" note (§2) — separately, outside this ticket's file surface.
4. Once the `next dev` gap is closed, re-run this same CI-faithful method (fresh seed + `workers: 1`) several times with **zero** failures before reconsidering the flip.

## Required-checks list (for the owner to apply — not applied here)

**No change recommended yet.** Today's required-checks list (`quality-gate`, `ai-guardrail-gate`) should stay as-is. Once §4's steps are complete and re-verified stable, the target list becomes: `quality-gate`, `ai-guardrail-gate`, **`e2e-regression`** (added) — with `continue-on-error: true` removed from the job in the same change.

## ADRs
None — this is an evidence-gathering/verdict ticket, not an architecture decision.
Confirmation: n/a (no code changed; the claim this file makes is falsifiable by re-running §3.3's method).

## Links
`../../feature.md` · `.github/workflows/ci.yml` · `e2e/regression/README.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/tech.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` · `story.md`

## Changelog
- v1 (2026-07-28) — created; full investigation + verdict (do not flip).
