---
linear: CAM-621
feature: platform-hardening
epic: taxonomy-ui-foundation (CAM-522)
persona: Platform
artifact: story
owner: devops-release
status: backlog
version: v2
updated: 2026-07-28
---

## Story
As the **Platform** (delivery team), I want `e2e-regression` to actually block a merge when a real behavioural test in it goes red, so that the careful e2e assertions this team keeps writing (CAM-594's scale check, CAM-598/CAM-601's truncation checks, CAM-603's keep-alive guard, CAM-604's render-once check, CAM-607/CAM-610's CSP-nonce checks) are enforced rather than advisory-only forever.
Why: `.github/workflows/ci.yml` states the suite "flips to blocking only after BR-6 stability (>=10 consecutive green runs)" — a criterion long since met at the CI-job level — but the flip is a deliberate, evidence-gated action, not a formality: this ticket exists specifically to verify the suite is trustworthy enough to carry that weight before removing `continue-on-error`, not just to count green runs.
Scope: decide whether to remove `continue-on-error: true` from the `e2e-regression` CI job and state the required-checks list to apply, based on a fresh, CI-faithful, isolated-database re-measurement performed by whoever picks up this ticket — never on an inherited number. Does not touch `app/**`/`lib/**`/`components/**`/`prisma/**`, and does not edit any e2e spec except the two named as settle-wait candidates (and only if argued for).
Depends on: CAM-359 (BR-6, the >=10-consecutive-green-runs criterion) · CAM-626 (investigated this ticket's own first refusal and supplied the isolated-DB method + root causes) · CAM-629 (opened by this retry — a third spec's single-occurrence flake, unresolved)

## AC
<!-- This is CI/release-governance tooling, not end-user product UI — the "Then" column is what the operator (owner) sees on the ticket/PR, matching the CAM-603/CAM-579 precedent. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The `e2e-regression` job has run green at CI-job level for many consecutive runs on `dev` | Whoever is deciding whether to flip it to blocking re-runs the suite themselves — fresh isolated local DB, `.next` cleared, `workers:1`, 3 full runs — rather than trusting the CI streak alone | The PR/ticket record states the ACTUAL 3 run results measured in that sitting (pass/fail counts, not "should be green") | If all 3 are clean: `continue-on-error` is removed and the exact required-checks list is stated for the owner to apply. If not: the flip is refused again and the specific failure is reported | EC-1 |
| AC-2 | A PR opens a deliberately broken e2e assertion after the flip | CI runs `e2e-regression` on that PR | The PR's checks show `e2e-regression` failed and the merge is blocked (verified, not assumed) | The required-checks list on branch protection includes `e2e-regression` | — (not yet reached — this ticket has not flipped the switch; deferred to whichever retry does) |
| AC-3 | The PR queue on `dev` has one or more open PRs at the moment the flip would land | The flip is about to be applied | The flip is deferred until the queue is empty (never applied against an in-flight branch) | No in-flight PR is retroactively required to carry a check it was opened without | EC-2 |

## Rules
- BR-1 The flip is gated on a run-set measured IN THE SAME SITTING as the decision — an inherited count (e.g. "29 green runs," CAM-621's own first mistake) never substitutes for re-measuring. (proves AC-1)
- BR-2 A single failure anywhere across the 3 CI-faithful runs — regardless of which spec, and regardless of whether it matches a previously-named failure — is enough to refuse the flip. The bar is "clean," not "clean on the specs we already suspected." (proves AC-1)
- BR-3 The flip only happens with the PR queue empty (ops.md's pull_request/push trigger-list trap: a newly-required check on an in-flight branch deadlocks the queue). (proves AC-3)
- BR-4 Branch protection is never written by the agent doing the investigation — the exact required-checks list is stated in the PR/ticket record for the owner to apply themselves. (proves AC-1, keeps the revert path in the owner's hands)

## Edge cases
- EC-1 IF the local run-set is not clean THEN the story refuses the flip again, opens/updates a watch-item ticket for any newly-found failure signature, and states the settle-wait decision (argued, not silent) for next time (BR-2)
- EC-2 IF a PR appears in the queue while this investigation is in progress THEN it is reported, not silently absorbed into the decision (BR-3)
- EC-3 IF the settle-wait (`body > div[id^="S:"]` before a DOM-count assertion) is added to a spec THEN it must wait on the real condition clearing, never a fixed `sleep` (`.claude/rules/qa.md`)

## Data
- No schema/migration. Touches only `.github/workflows/ci.yml` (`e2e-regression` job — `continue-on-error` line only, and only on a clean flip) and, only if argued for, a settle-wait in `e2e/regression/cam-540-dialog-select-dismiss.spec.ts` / `e2e/regression/ac6-spot-lifecycle.spec.ts`.

## Seams & refs
- Reuse: CAM-626's isolated-DB method (`docs/specs/.../CAM-626-csp-under-dev/tech.md` §Finding 3) is the re-measurement procedure this story's every retry re-runs — not re-invented per attempt.
- Refs: CAM-359 BR-6 (the original green-run-count criterion) · CAM-626 (root-caused the first refusal's contradiction) · CAM-629 (this retry's own new watch-item finding) · `.claude/rules/ops.md` §Gate policy v2 (advisory-first rollout + the in-flight-queue deadlock trap) · `.claude/rules/qa.md` (flaky test = defect report until root-caused; no fixed sleeps).

## Out of scope
- Fixing CAM-629's cam-598 race → follow-up: CAM-629 (watch item; investigate on recurrence, per the CAM-555/CAM-603 pattern).
- Investigating the single job-level CI failure at run 30319601633 (2026-07-28T01:12, `dev`, 21+ hours before this retry's measurement) → out of this ticket's scope; noted as context for the green-count claim, not re-investigated here.
- Actually applying branch protection → the owner applies the stated required-checks list themselves (BR-4).

## Self-verify
- AC-1 → owner-verify (investigation record): this retry's 3 isolated-DB runs are Run 1 = 83/84, Run 2 = 84/84, Run 3 = 84/84 — NOT clean, so the flip is refused again this round (tech.md carries the full evidence).
- AC-2 → deferred — no flip happened this retry, so there is nothing yet to verify by opening a deliberately-broken PR. The NEXT retry that actually flips the switch owns this verification.
- AC-3 → owner-verify: no PR appeared in `dev`'s queue during this retry's investigation window (confirmed via `gh pr list --base dev` at the time of writing).
- Story-specific: current CI job-level `e2e-regression` green streak, measured fresh via `gh run view --json jobs` (not reused from a prior story): 36 consecutive successes.
- Gate = `/quality-gate` (this retry touches only docs — `npm run lint`/`npm run typecheck` unaffected; verified green regardless).

## Changelog
- v1 (2026-07-28) — first investigation (no docs authored at the time; reasoning lived only in the ticket's description + comments). Measured 29 consecutive CI-job-level green runs against 2 failures (cam-540-dialog-select-dismiss, ac6-spot-lifecycle — both the "duplicate-DOM" signature) in 3 CI-faithful local runs (fresh seed, `workers:1`) — an unexplained contradiction. Refused to flip `continue-on-error` off rather than trust either signal blindly; handed the contradiction to CAM-626.
- v2 (2026-07-28, this retry) — CAM-626 explained the contradiction: CI was accurate throughout (fresh DB per run); the local failures traced to a DB-accumulation confound in the shared local harness DB (16 accumulated camps vs. a clean seed), and a separate, real-but-bounded Turbopack dev-compile timing window (~200-250ms, self-resolving, not CSP). Against a freshly isolated DB, CAM-626 measured 84/84 three times. Re-ran that exact method myself before touching anything: 83/84, 84/84, 84/84 — one failure, in a THIRD spec (cam-598-card-location-ellipsis) neither this ticket nor CAM-626 had previously named. Opened CAM-629 as a watch-item (single sighting, per the CAM-586 convention). Refused the flip a second time on this new evidence; left `continue-on-error` untouched; decided NOT to add CAM-626's recommended settle-wait to cam-540/ac6 this round (both passed 3/3 clean in isolation — no reproduced failure to guard against yet); stated the required-checks list (`quality-gate`, `ai-guardrail-gate`, `e2e-regression`) for the owner to apply once a future retry's run-set is actually clean; authored this story.md/tech.md for the first time, folding in both refusals into one durable record.
