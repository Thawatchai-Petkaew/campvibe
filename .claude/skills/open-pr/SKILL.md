---
name: open-pr
description: Create branch + commit (Conventional Commits) + open a PR based on `dev` with a checklist via the gh CLI — 1 PR per 1 atomic story. Use when a story is ready to send for review/merge toward Done. Do NOT use when promoting across envs (`dev`→`staging` or `staging`→`main` — use /promote-release)
---

# open-pr

Close one atomic story by opening a branch + Conventional Commits commit + a PR based on `dev` (= toward Done) via the `gh` CLI.

Read first: `CLAUDE.md` (Git) · `.claude/rules/ops.md` (4-layer flow, Done vs Released) · `.claude/rules/code.md` (PR size).

## Overview

One PR carries exactly one atomic story toward Done. The PR always targets `dev` (never `staging`/`main`); `dev` has NO deploy — the story becomes Done once the quality gate is green + the AC is verified on localhost against the dev DB + the PR merges. Staging exposure comes later via the batched `dev`→`staging` promote (label `on-staging`); releasing to prod is `staging`→`main` — neither is this skill.

## Quick Reference

Run in order (real commands; replace the placeholders with your `<type>`/`<kebab>`/scope/subject):

1. Branch off `dev` — `git switch dev && git pull && git switch -c feature/<kebab>` (type ∈ `feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`); in a worktree, branch off `origin/dev`.
2. Commit in atomic units with Conventional Commits — `git add -p && git commit -m "type(scope): subject"` (one logical change per commit; refactor separate from feature).
3. Push the branch — `git push -u origin feature/<kebab>`.
4. Open the PR based on `dev` — `gh pr create --base dev --fill` then complete the body (ticket · AC · gate result · checklist).
5. Wait for CI — `gh pr checks --watch` until `.github/workflows/ci.yml` is green before requesting merge (`main`/`staging`/`dev` are protected).

## When to Use

Use when a story is finished and ready to send for review/merge toward Done:

- A referenceable ticket/story exists (a delivery ticket at story level, with `## Story` + `## AC`). No spec → stop, write the spec first.
- The code is actually complete for one atomic story — code + states + validation + self-test — with no dead code and no future-proofing.
- The quality gate is fully green (lint · typecheck · test + coverage ≥80% · build · audit · design gate if UI). Run `/quality-gate` first if unsure.
- `gh` is authenticated and you are on a `feature/*` branch (never commit directly into `dev`/`staging`/`main`).

**NOT for:**

- Promoting across envs — batched `dev`→`staging` or `staging`→`main` use `/promote-release`.
- Running the pre-merge gate — use `/quality-gate`.

## Prerequisites

- The quality gate is green first — run the `quality-gate` skill (lint · typecheck · test + coverage ≥80% · build · audit · design gate if UI). A red gate is not ready for a PR.
- You know the branch type (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) and have the ticket/story (delivery ticket with `## Story` + `## AC`) to reference.
- `gh` is authenticated and you are off `dev` on a `<type>/<kebab>` branch (never on `dev`/`staging`/`main` directly).

## Workflow

1. Branch `<type>/<kebab>` using the Conventional type palette: `feature/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`, `release/`, `hotfix/`.
2. Commit in atomic units with Conventional Commits (`type(scope): subject`), each commit traceable back to the ticket/AC. Keep refactors in their own commits, separate from feature changes — never mix a behavior change and a rename/move in one commit.
3. Open the PR based on `dev`: `gh pr create --base dev` (feature → `dev` = toward **Done**).
4. Fill the PR body completely: ticket link · AC covered · quality-gate result · self-verify checklist. Include a short change summary (what changed and why) so a reviewer can read the PR before the diff. (No Vercel preview exists for `dev` — the deploy quota allow-list blocks it; the owner reads via localhost.)
5. Record the PR # into the story's `release.md` under `## PR & preview` (durable ship record — see the `delivery-artifacts` skill).
6. Wait for CI (`.github/workflows/ci.yml`) to go green before requesting merge (`main`/`staging`/`dev` are protected).

## Examples

- ✅ Branch `feature/booking-cancel`, commit `feat(booking): add ยกเลิกการจอง flow`, then `gh pr create --base dev` for one atomic story → reviewable, traceable, targets `dev`.
- ❌ `git commit` straight onto `dev` (or `staging`/`main`) — bypasses review; feature work never commits to a protected branch.
- ❌ One PR bundling two stories / >~400 lines — non-atomic, hides regressions; split into one PR per story.

## Reference Files

- `.claude/rules/code.md` — PR size + atomic-commit guidance.
- `delivery-artifacts` skill — the story's `release.md` where the PR # is recorded (`## PR & preview`).
- `quality-gate` skill — runs first; the gate must be green before this skill.
- `promote-release` skill — runs after Done; batched `dev`→`staging` (on-staging) and `staging`→`main` (Released) — do not use this skill for those.
- `CLAUDE.md` (Git section) — branch naming, Conventional Commits, `feature → dev` (Done) → `dev`→`staging` (on-staging) → `staging`→`main` (Released).

## Next Steps

- After merge into `dev`: the story is **Done** (quality-gate green + AC verified on localhost/dev DB before the merge). No deploy fires — the owner reads `dev` via localhost.
- Later, the batched `dev`→`staging` promote (via `promote-release`) deploys Staging + smoke → label `on-staging`; G4 sits on the real Staging URL; then `staging`→`main` (G5) = Released.

## Standards

1. **1 PR = 1 atomic story, ≤ ~400 lines.** Over that, or multiple stories → split the PR.
2. **Base is always `dev`, never `staging`/`main`.** Cross-env movement is only `/promote-release` (batched `dev`→`staging`, then `staging`→`main`), not this skill.
3. **No secret / env value may leak** in the diff or any commit message.
4. **Atomic commits.** One logical change per commit; a refactor and the feature it supports go in separate commits so each can be reviewed and reverted independently.
5. **AC verified on localhost BEFORE merge.** Done = gate green + localhost AC verify (dev DB) + merged into `dev`; browser-only ACs get the owner's check on dev after merge.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's all one feature, I'll ship it in one big PR." | 1 PR = 1 atomic story, ≤ ~400 lines. Bundling stories hides regressions and blocks reviewers — split it. |
| "I'll base it on `staging`/`main`, closer to release." | Feature PRs always base on `dev`. Envs are reached only via `/promote-release`. |
| "Refactor and feature touch the same files, one commit is cleaner." | Mixed commits cannot be reviewed or reverted independently. Keep refactor commits separate from feature commits. |
| "CI will re-run the gate, I can skip it locally." | The gate must be green before you push; CI is a backstop, not the first check. A red push wastes a review cycle. |
| "It merged into `dev`, so it's on staging." | `dev` never deploys. Staging exposure needs the batched `dev`→`staging` promote (label `on-staging`); G4 sits there. |
| "The commit subject is enough, the body can be empty." | A reviewer needs ticket link, AC covered, gate result, and checklist to review before the diff. |

## Verify (exit criteria)

- [ ] `gh pr view` shows base=`dev` and a complete body: ticket/AC/gate result/checklist.
- [ ] CI is green.
- [ ] Diff ≤ ~400 lines, one atomic story.
- [ ] No secret in the diff or any commit message.
- [ ] Commits are atomic with Conventional Commit subjects; refactors are separate from feature changes.
- [ ] `node scripts/ticket-sync.mjs audit` passes (ticket has `## Story` + `## AC`).
- [ ] AC verified on localhost (dev DB) before the merge; after merge the ticket state is `Done`.
