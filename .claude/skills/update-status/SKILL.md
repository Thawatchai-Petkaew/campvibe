---
name: update-status
description: Atomically update ticket status in the self-hosted delivery ticket DB (team CAM) — change state/label, attach awaiting-you when a human gate is reached, log decisions, mark Done(staging)/released(prod). Use on every work transition (start/open PR/merge→staging/reach gate/release prod/gate fail). Do NOT use for summarizing overall team status (use /status), creating new issues at intake (do that in Discovery), or promoting/deploying across env (use /promote-release)
---

# update-status

## Overview

Record a ticket's state transition into the delivery ticket DB with real, executable commands — not remembered intent. The ticket DB (ADR-010, `lib/delivery/`) is the single source of truth and a closed loop: every git/gate event maps to one concrete `ticket-sync.mjs` command so status never drifts from reality.

Read first: `.claude/SYNC-ARCHITECTURE.md` (the ticket DB = SoT + closed loop), `.claude/rules/ops.md` (Done vs Released, 3-env), `scripts/ticket-sync.mjs` (usage header).

## Quick Reference

One transition → one real `node scripts/ticket-sync.mjs` command. Cheat-sheet:

| Transition | Command |
| --- | --- |
| Start work (post-G1/G2) | `node scripts/ticket-sync.mjs set <CAM-id> --state "In Progress"` |
| Reach a human gate G1–G5 | `node scripts/ticket-sync.mjs set <gate-id> --add-label awaiting-you` |
| Hand off to the next role | `node scripts/ticket-sync.mjs handoff <CAM-id> --role <role>` |
| Done (merged→`staging`, AC verified on Staging URL) | `node scripts/ticket-sync.mjs set <CAM-id> --state Done` |
| Released (promote `staging`→`main` via `/promote-release`) | `node scripts/ticket-sync.mjs release <CAM-id>` |
| Read current state | `node scripts/ticket-sync.mjs list` / `npm run tickets:list` |
| Confirm gate cleared | `npm run tickets:gates` (exit 10 = a rejected ticket is ready to resume; a clean list with only `AWAITING_GATE` rows = still waiting) |
| Verify template integrity | `node scripts/ticket-sync.mjs audit` (exit 11 = bad template) |

`--add-label`/`--remove-label` (aliases `--add`/`--remove`) still accept the legacy vocabulary (`awaiting-you`, `released`, `blocked`, a persona) — `scripts/lib/ticket-sync-mapping.mjs` translates each onto the real guarded verb (`raiseGate`/`approve`/`release`/`setBlocked`/`updateFields`). `released` stamps `releasedAt` on an already-`DONE` ticket — it is not a separate state.

## When to Use

Use on every work transition: start work, open a PR, merge→`staging`, reach a human gate, release to prod, or when a gate fails.

**NOT for:**

- Summarizing overall team status → use `/status`.
- Creating new issues at intake → do that in Discovery.
- Promoting / deploying across env → use `/promote-release`.

## Prerequisites

- `APP_BASE_URL` + `STATUS_TOKEN` present in env (`scripts/ticket-sync.mjs` is a thin HTTP client over `/api/tickets/*` — no direct DB access, no MCP binding).
- Know the `<CAM-id>` of the ticket to change and the transition that just happened (git/gate event).
- Know the ticket convention before touching titles/roles: **Epic (`--type epic` + `featureName`) → Story (`--type story --epic <epic-id>`) → `currentRole` column (`/status` renders it as a `[role]` tag, rotated per stage)** — the full convention lives in the `/camper` command doc (`.claude/commands/camper.md`) + `.claude/SYNC-ARCHITECTURE.md`.
- The delivery ticket DB = single source of truth — never hand-edit `.claude/linear-snapshot.json` (it is a snapshot from `tickets:pull`).

## Workflow

Pick the transition, then run the real command.

1. **Start work** (post-G1/G2) → `node scripts/ticket-sync.mjs set <CAM-id> --state "In Progress"`
2. **Open PR** (G3 pending) → the board derives "In Review" automatically once QA/Security is the `currentRole` or `awaiting-you` is set (`boardColumnOf()` in `lib/status-derive.ts`) — no separate command needed; include `CAM-id` / `Closes CAM-id` in the PR description for traceability.
3. **Done** (= merged into `staging` + quality-gate green + staging migration passed + **AC verified on the real Staging URL**) → `node scripts/ticket-sync.mjs set <CAM-id> --state Done`.
4. **Released** (= promote `staging`→`main` + prod deploy + smoke + tag + changelog via `/promote-release`) → `node scripts/ticket-sync.mjs release <CAM-id>` (stamps `releasedAt`; the ticket stays `Done`) — **released is a timestamp, not a new state**.
5. **Reach a human gate G1–G5** → `node scripts/ticket-sync.mjs set <gate-id> --add-label awaiting-you` (maps to the `raiseGate` verb) + post a **Gate Review Packet** as a comment (`node scripts/ticket-sync.mjs comment <gate-id> --body "..."`) (G1 brief + gap · G2 spec + design · G3 PR diff + gate results + preview · G4 Staging URL + AC · G5 changelog + rollback).
6. **Hand off to the next role** → `node scripts/ticket-sync.mjs handoff <CAM-id> --role <role>` — sets `currentRole` (so `/status` renders the `[role]` tag), pushes onto `roleHistory`, and fires a Telegram notice in the same call; never rename the title by hand.
7. **Check whether the human has approved yet** → `node scripts/ticket-sync.mjs gates` (a ticket still `AWAITING_GATE` = waiting; a ticket with `changesRequested=true` = rejected and ready to resume, **exit 10**).
8. **Human approves** — the generic Approve path (Telegram tap / `/status` / `/status/map`) always fires the `approve()` verb, which returns the ticket to `IN_PROGRESS` with `changesRequested=false` — correct for an intermediate gate (G1–G3): dispatch the next role/stage. **G4 (Staging sign-off) is different**: it is the terminal gate, reached by `complete()`, not `approve()` — the generic Approve tap cannot reach `Done`. Once the human confirms sign-off, run step 3's `set <CAM-id> --state Done` directly **while the ticket is still `AWAITING_GATE`** (before any generic Approve tap fires) to actually land it on `Done`.
9. **Sync the artifact header.** Besides moving the ticket state, update the artifact's `status:` header in the story's `docs/specs/` files to match (the delivery ticket DB = status SoT, but the files stay in sync — see the `delivery-artifacts` skill).
10. **Gate fail / post-deploy bug** → open a new ticket (`node scripts/ticket-sync.mjs create --type task --title "..." --epic <CAM-id>`) + link back to the original ticket (re-enter the loop).

## Examples

A role handoff at a stage boundary:

- ✅ `node scripts/ticket-sync.mjs handoff CAM-118 --role qa-engineer` — sets `currentRole=QA_ENGINEER` (so `/status` renders `[qa-engineer]`), pushes onto `roleHistory`, and fires the Telegram notice in the same request. The closed loop stays intact and `/status` reflects it within 60s.
- ❌ hand-editing the ticket's title to fake a `[qa-engineer]` tag — it skips the `roleHistory` push and the Telegram notice, so the handoff is invisible to the dashboard, the next role is never pinged, and `ticket-sync audit` flags a `currentRole`/`roleHistory` mismatch.

## Reference Files

- `.claude/SYNC-ARCHITECTURE.md` — the delivery ticket DB = SoT + closed loop (the model this skill enforces).
- `.claude/SYNC-ARCHITECTURE.md` + `.claude/templates/` — the Epic → Story → role convention + templates the transitions assume.
- `.claude/rules/ops.md` — Done(staging) vs Released(prod) + the 3-env flow.
- `.claude/commands/camper.md` — the `/camper` command + the full ticket delivery convention this skill obeys.
- `delivery-artifacts` skill — keep the artifact's `status:` header in `docs/specs/` aligned with the ticket state moved here.
- Sibling skills: `open-pr` (G3, opens the PR that moves the board lane to "In Review") · `promote-release` (the `staging`→`main` step behind the `release` transition).

## Next Steps

Once status is synced and matches reality, continue the delivery loop: dispatch the next role via `handoff`, or — if a gate now shows `AWAITING_GATE` — raise the gate with its Gate Review Packet and wait for `node scripts/ticket-sync.mjs gates` to report exit 10 (a rejected ticket ready to resume) before spawning the next stage. After a prod `release`, hand back to `/promote-release` for smoke + tag + changelog.

## Standards

1. **Done(staging) ≠ Released(prod)** — multiple stories can be Done (on Staging) before being bundled into a prod release; the dashboard shows 2 dimensions (state `Done` + `releasedAt` stamped).
2. State changes on the **git/gate event (global), not bound to env**; `release` is called only when promoting to prod.
3. **gate = the `AWAITING_GATE` state** — the human's `approve`/`reject` (via Telegram, `/status`, or `/status/map`) clears it; never spawn the next stage before `ticket-sync gates` confirms the ticket left `AWAITING_GATE`.
4. Record every transition with a real command (orchestrator discipline to prevent "forgetting to sync") — not just remembered in your head.
5. `--add-label`/`--remove-label` (aliases `--add`/`--remove`) accept the legacy vocabulary; an unmapped combination errors out with the real reason from `scripts/lib/ticket-sync-mapping.mjs`.

Postconditions:

- The ticket's state/role changes per the transition (pushed into SoT, pulse bumped in-process) → dashboard `/status` reflects it within 60s.
- A gate waiting on a human is `AWAITING_GATE` + has a Gate Review Packet comment ready for the decision.
- Stories that are Done sit on Staging awaiting G4; released ones have `releasedAt` stamped.
- The decision/rationale is logged as a `TicketEvent` + comment on the ticket (traceable).

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I'll remember to sync the state later." | Drift starts the moment you skip the command. Record every transition with a real `ticket-sync.mjs` call now. |
| "The story is on Staging, so mark it Released." | Done(staging) ≠ Released(prod). `release` stamps `releasedAt` only when promoting `staging`→`main` via `/promote-release`. |
| "The human said yes in chat, so spawn the next stage." | Approval = the `approve` verb fired (ticket left `AWAITING_GATE` with `changesRequested=false`), confirmed by `ticket-sync gates`. Never proceed on chat alone. |
| "I'll just fix `.claude/linear-snapshot.json` directly to reflect the new state." | That file is a snapshot from `tickets:pull`. Hand-editing breaks the closed loop — push the change through the ticket DB. |
| "It's merged into `staging`, so it's Done." | Done also requires quality-gate green + staging migration passed + AC verified on the real Staging URL. |
| "I moved the ticket state, the file header can lag." | After moving the state, update the artifact's `status:` header in `docs/specs/` to match — the audit flags a stale scaffolded story. |

## Verify (exit criteria)

- [ ] `node scripts/ticket-sync.mjs list` — confirm the ticket is in the intended state/role.
- [ ] `node scripts/ticket-sync.mjs gates` — clean (only `AWAITING_GATE`, none `changesRequested`) before proceeding on a rejection-resume path; exit 10 = a rejected ticket is ready to resume.
- [ ] `node scripts/ticket-sync.mjs audit` — story tickets must have `## Story` + `## AC` (exit 11 = bad template, fix before handoff).
- [ ] (automatic) a watcher lets the orchestrator proceed on its own when a gate clears: `/loop 10m npm run tickets:gates` or `/schedule`.
