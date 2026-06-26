# Lessons Ledger — Scout team continuous learning

Append-only record of lessons distilled from **closed** stories by the `retro` skill (`/retro <CAM-###>`). The ledger is the audit trail, the dedupe source, and the prune driver. Lessons that are reusable + role-general get **promoted** into `.claude/rules/<role>.md` (a `## Common Rationalizations` row or a `## Standards` bullet) after **owner approval** — that is what makes the Scout sub-agents read them before their next task (Iron Rule #4).

**How to use this file**

- One row per lesson. Newest at the top of the table.
- `Status`: `proposed` (in the ledger, not yet in a rule) → `promoted` (owner-approved, now in the named rule) → `pruned` (merged/retired during a prune pass; keep the row for history).
- Before adding a row, scan for a near-duplicate → **strengthen/merge** the existing one instead of twinning it.
- `Destination`: the rule file it landed in, or `memory` (orchestrator), `docs/context`, `DESIGN.md`, or a skill — per the `retro` routing rules.
- Every promoted lesson cites its origin CAM ticket (the WHY) so a future reader knows why the rule exists.

## Ledger

| Date | CAM | Role | Type | Lesson (mistake → better rule) | Destination | Status |
|---|---|---|---|---|---|---|
| 2026-06-27 | CAM-201 | code | process | "Works on local, breaks on Staging/Prod" was chased as app logic for 3 rounds. → For an environment-specific bug, suspect env differences/HTTP cache headers/case-sensitivity (macOS→Linux) **before** app logic. | `.claude/rules/code.md` | promoted |
| 2026-06-27 | CAM-201 | performance | perf | Walk-sprite frames swapped via `background-image` flickered only on deployed because `/public` defaults to `Cache-Control: max-age=0, must-revalidate` → a network revalidation per frame. → Runtime-swapped static assets need an **immutable** long cache; preload+decode frames that animate. | `.claude/rules/performance.md` | promoted |
| 2026-06-27 | CAM-201 | qa | process | The v0.10.1 guard tests were source-inspection only, so they passed while the bug persisted. → A guard test must **fail on the real defect**; prove teeth (remove the fix → test goes red) and prefer a behavioral/measurable check (e.g. the deployed asset's header) over source-grep. | `.claude/rules/qa.md` | proposed |
| 2026-06-27 | CAM-201 | devops | process | Two sessions ran git in the same working tree → branch/tree collisions; Vercel also deduped a staging deploy when the merge tree equaled a branch-preview tree. → Isolate concurrent work in a `git worktree`; force a tree-changing commit when a staging deploy dedups. | memory (project-status, one-off) | proposed |

> Seeded 2026-06-27 from CAM-201 as the proof-of-loop. The first two rows were promoted (owner-approved) into the named rules; the qa/devops rows are candidates for the next prune/promote pass.
