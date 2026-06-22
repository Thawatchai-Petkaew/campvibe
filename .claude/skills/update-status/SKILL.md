---
name: update-status
description: Atomically update ticket status in Linear (team Campvibe/CAM) — change state/label, attach awaiting-you when a human gate is reached, log decisions, mark Done(staging)/released(prod). Use on every work transition (start/open PR/merge→staging/reach gate/release prod/gate fail). Do NOT use for summarizing overall team status (use /status), creating new issues at intake (do that in Discovery), or promoting/deploying across env (use /promote-release)
---

# update-status

## Overview

Record a ticket's state transition into Linear with real, executable commands — not remembered intent. Linear is the single source of truth and a closed loop: every git/gate event maps to one concrete `linear-sync.mjs` command so status never drifts from reality.

Read first: `ai-planning/SYNC-ARCHITECTURE.md` (Linear = SoT + closed loop), `std/ops.md` (Done vs Released, 3-env), `scripts/linear-sync.mjs` (usage header).

## When to Use

Use on every work transition: start work, open a PR, merge→`staging`, reach a human gate, release to prod, or when a gate fails.

Preconditions:

- `LINEAR_API_KEY` present in env (no MCP binding); team = `CAM` (override with `LINEAR_TEAM_KEY`).
- Know the `<CAM-id>` of the issue to change (a story = an issue whose title contains `·`) and the transition that just happened (git/gate event).
- Linear = single source of truth — never hand-edit `STATUS.json` / `linear-snapshot.json` (they are snapshots from `status:pull`).

**NOT for:**

- Summarizing overall team status → use `/status`.
- Creating new issues at intake → do that in Discovery.
- Promoting / deploying across env → use `/promote-release`.

## Workflow

Pick the transition, then run the real command.

1. **Start work** (post-G1/G2) → `node scripts/linear-sync.mjs set <CAM-id> --state "In Progress"`
2. **Open PR** (G3 pending) → state `In Review` (the Linear↔GitHub integration does this itself if branch = `gitBranchName`, or include `CAM-id` / `Closes CAM-id` in the PR).
3. **Done** (= merged into `staging` + quality-gate green + staging migration passed + **AC verified on the real Staging URL**) → `node scripts/linear-sync.mjs set <CAM-id> --state Done --remove-label awaiting-you` (or let the PR merge→`staging` trigger it via the integration).
4. **Released** (= promote `staging`→`main` + prod deploy + smoke + tag + changelog via `/promote-release`) → `node scripts/linear-sync.mjs release <CAM-id>` (= state Done + label `released`) — **`released` is a label, not a new state**.
5. **Reach a human gate G1–G5** → `node scripts/linear-sync.mjs set <gate-id> --add-label awaiting-you` + post a **Gate Review Packet** as a comment (G1 brief + gap · G2 spec + design · G3 PR diff + gate results + preview · G4 Staging URL + AC · G5 changelog + rollback).
6. **Check whether the human has approved yet** → `npm run status:gates` (still has `awaiting-you` = exit 0, waiting; removed = `CLEARED → CONTINUE` **exit 10**).
7. **Human approves** (removes `awaiting-you` in Linear) → `node scripts/linear-sync.mjs set <gate-id> --state Done`, then spawn the next stage.
8. **Gate fail / post-deploy bug** → open a new Linear issue + link back to the original ticket (re-enter the loop).

## Standards

1. **Done(staging) ≠ Released(prod)** — multiple stories can be Done (on Staging) before being bundled into a prod release; the dashboard shows 2 dimensions (state `Done` + label `released`).
2. State changes on the **git/gate event (global), not bound to env**; `released` is attached only when promoting to prod.
3. **gate = the `awaiting-you` convention** — removing the label in Linear = approval; never spawn the next stage before `status:gates` confirms exit 10.
4. Record every transition with a real command (orchestrator discipline to prevent "forgetting to sync") — not just remembered in your head.
5. `--add` / `--remove` are aliases of `--add-label` / `--remove-label`; a mistyped state errors out with a list of available states.

Postconditions:

- The Linear issue's state/label changes per the transition (pushed into SoT) → dashboard `/status` reflects it within 60s.
- A gate waiting on a human carries `awaiting-you` + has a Gate Review Packet comment ready for the decision.
- Stories that are Done sit on Staging awaiting G4; released ones are on prod with a tag.
- The decision/rationale is logged as a comment on the issue (traceable).

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I'll remember to sync the state later." | Drift starts the moment you skip the command. Record every transition with a real `linear-sync.mjs` call now. |
| "The story is on Staging, so mark it Released." | Done(staging) ≠ Released(prod). `released` is a label attached only when promoting `staging`→`main` via `/promote-release`. |
| "The human said yes in chat, so spawn the next stage." | Approval = the `awaiting-you` label removed in Linear, confirmed by `status:gates` exit 10. Never proceed on chat alone. |
| "I'll just fix `STATUS.json` directly to reflect the new state." | Those files are snapshots from `status:pull`. Hand-editing breaks the closed loop — push the change through Linear. |
| "It's merged into `staging`, so it's Done." | Done also requires quality-gate green + staging migration passed + AC verified on the real Staging URL. |

## Verify (exit criteria)

- [ ] `npm run status:linear` — confirm the issue is in the intended state/label.
- [ ] `npm run status:gates` — exit 10 before proceeding (gate truly cleared); exit 0 = still waiting on a human.
- [ ] `node scripts/linear-sync.mjs audit` — story issues must have `## Story` + `## AC` (exit 11 = bad template, fix before handoff).
- [ ] (automatic) a watcher lets the orchestrator proceed on its own when a gate clears: `/loop 10m npm run status:gates` or `/schedule`.
