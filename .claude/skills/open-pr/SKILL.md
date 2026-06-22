---
name: open-pr
description: Create branch + commit (Conventional Commits) + open a PR based on `staging` with a checklist via the gh CLI — 1 PR per 1 atomic story. Use when a story is ready to send for review/merge toward Done. Do NOT use when promoting `staging`→`main` to prod (use /promote-release --to prod)
---

# open-pr

Close one atomic story by opening a branch + Conventional Commits commit + a PR based on `staging` (= toward Done) via the `gh` CLI.

Read first: `CLAUDE.md` (Git) · `.claude/rules/ops.md` (3-env, Done vs Released) · `.claude/rules/code.md` (PR size).

## Overview

One PR carries exactly one atomic story toward Done. The PR always targets `staging` (never `main`); merging into `staging` triggers an auto deploy + smoke, and the story only becomes Done after the AC is verified on the real Staging URL. Releasing to prod is a separate `staging`→`main` promotion — not this skill.

## Quick Reference

Run in order (real commands; replace the placeholders with your `<type>`/`<kebab>`/scope/subject):

1. Branch off `staging` — `git switch staging && git pull && git switch -c feature/<kebab>` (type ∈ `feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`).
2. Commit in atomic units with Conventional Commits — `git add -p && git commit -m "type(scope): subject"` (one logical change per commit; refactor separate from feature).
3. Push the branch — `git push -u origin feature/<kebab>`.
4. Open the PR based on `staging` — `gh pr create --base staging --fill` then complete the body (ticket · AC · gate result · checklist · Preview URL).
5. Wait for CI — `gh pr checks --watch` until `.github/workflows/ci.yml` is green before requesting merge (`staging`/`main` are protected).

## When to Use

Use when a story is finished and ready to send for review/merge toward Done:

- A referenceable ticket/story exists (Linear issue at story level, with `## Story` + `## AC`). No spec → stop, write the spec first.
- The code is actually complete for one atomic story — code + states + validation + self-test — with no dead code and no future-proofing.
- The quality gate is fully green (lint · typecheck · test + coverage ≥80% · build · audit · design gate if UI). Run `/quality-gate` first if unsure.
- `gh` is authenticated and you are on a `feature/*` branch (never commit directly into `staging`/`main`).

**NOT for:**

- Promoting `staging`→`main` to prod — use `/promote-release --to prod`.
- Running the pre-merge gate — use `/quality-gate`.

## Prerequisites

- The quality gate is green first — run the `quality-gate` skill (lint · typecheck · test + coverage ≥80% · build · audit · design gate if UI). A red gate is not ready for a PR.
- You know the branch type (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) and have the ticket/story (Linear issue with `## Story` + `## AC`) to reference.
- `gh` is authenticated and you are off `staging`/`main` on a `<type>/<kebab>` branch.

## Workflow

1. Branch `<type>/<kebab>` using the Conventional type palette: `feature/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`, `release/`, `hotfix/`.
2. Commit in atomic units with Conventional Commits (`type(scope): subject`), each commit traceable back to the ticket/AC. Keep refactors in their own commits, separate from feature changes — never mix a behavior change and a rename/move in one commit.
3. Open the PR based on `staging`: `gh pr create --base staging` (feature → `staging` = toward **Done**).
4. Fill the PR body completely: ticket link · AC covered · quality-gate result · self-verify checklist · Vercel Preview URL. Include a short change summary (what changed and why) so a reviewer can read the PR before the diff.
5. Wait for CI (`.github/workflows/ci.yml`) to go green before requesting merge (`staging`/`main` are protected).

## Examples

- ✅ Branch `feature/booking-cancel`, commit `feat(booking): add ยกเลิกการจอง flow`, then `gh pr create --base staging` for one atomic story → reviewable, traceable, targets `staging`.
- ❌ `git commit` straight onto `staging` (or `main`) — bypasses review; feature work never commits to a protected branch.
- ❌ One PR bundling two stories / >~400 lines — non-atomic, hides regressions; split into one PR per story.

## Reference Files

- `.claude/rules/code.md` — PR size + atomic-commit guidance.
- `quality-gate` skill — runs first; the gate must be green before this skill.
- `promote-release` skill — runs after Done; `staging`→`main` to prod (do not use this skill for that).
- `CLAUDE.md` (Git section) — branch naming, Conventional Commits, `feature → staging` (Done) → `staging`→`main` (Released).

## Next Steps

- After merge: auto deploy → Staging + smoke → verify the AC on the real Staging URL → Linear state `Done`. A merge into `staging` alone is not Done.
- Later, batch the Done stories and promote `staging`→`main` to prod via `promote-release --to prod` (G5 go-live) = Released.

## Standards

1. **1 PR = 1 atomic story, ≤ ~400 lines.** Over that, or multiple stories → split the PR.
2. **Base is always `staging`, never `main`.** Releasing to prod is a `staging`→`main` PR via `/promote-release --to prod`, not this skill.
3. **No secret / env value may leak** in the diff or any commit message.
4. **Atomic commits.** One logical change per commit; a refactor and the feature it supports go in separate commits so each can be reviewed and reverted independently.
5. **Merging into `staging` is not yet Done.** Done also requires the AC verified on the real Staging URL.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "It's all one feature, I'll ship it in one big PR." | 1 PR = 1 atomic story, ≤ ~400 lines. Bundling stories hides regressions and blocks reviewers — split it. |
| "I'll base it on `main`, it's where prod lives." | Feature PRs always base on `staging`. Prod is reached only via `/promote-release --to prod`. |
| "Refactor and feature touch the same files, one commit is cleaner." | Mixed commits cannot be reviewed or reverted independently. Keep refactor commits separate from feature commits. |
| "CI will re-run the gate, I can skip it locally." | The gate must be green before you push; CI is a backstop, not the first check. A red push wastes a review cycle. |
| "It merged into `staging`, so the story is Done." | Done requires the AC verified on the real Staging URL after the auto deploy + smoke. A merge alone is not Done. |
| "The commit subject is enough, the body can be empty." | A reviewer needs ticket link, AC covered, gate result, checklist, and Preview URL to review before the diff. |

## Verify (exit criteria)

- [ ] `gh pr view` shows base=`staging` and a complete body: ticket/AC/gate result/Preview URL.
- [ ] CI is green.
- [ ] Diff ≤ ~400 lines, one atomic story.
- [ ] No secret in the diff or any commit message.
- [ ] Commits are atomic with Conventional Commit subjects; refactors are separate from feature changes.
- [ ] `node scripts/linear-sync.mjs audit` passes (ticket has `## Story` + `## AC`).
- [ ] After merge: auto deploy → Staging + smoke → AC verified on the Staging URL → Linear state `Done`.
