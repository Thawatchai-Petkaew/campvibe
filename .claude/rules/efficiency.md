# Agent Efficiency (token/$ discipline)

## Overview

Savings come from process discipline, not model downgrades. Seven levers — a stable cached prefix, pointer envelopes, JSON-only returns, an inline-vs-spawn ladder, locked model tiers, selective verification, and checkpoint/resume — decide whether a story costs its Appetite or blows it. This file consolidates the informal catalogue (`.claude/note/ai-team-workflow-preview.html` §7, now superseded) into the one agent-read home; budget authority stays the feature's Appetite (`.claude/templates/feature.md`).

## Quick Reference

| # | Lever | Rule in one line | Canonical home |
|---|---|---|---|
| 1 | Frozen prefix | Agent files are the cached prefix — batch shared-section edits in ONE pass, never mid-dispatch; don't thrash tools/models mid-session | `.claude/agents/orchestrator.md` §Dispatch contract |
| 2 | Dispatch envelope | Pointers + deltas + machine-checkable `done_when`; target ≤ ~300 tokens | orchestrator §Dispatch contract |
| 3 | JSON-only return | Entire final message = ONE JSON object, ~400 tokens (hard 500); detail → file | each agent's §Output |
| 4 | Inline vs spawn | Spawn only for compression or parallelism; **deliverables ALWAYS route to their owning role** (rotation never bypassed) | this file §4 + orchestrator §Routing ladder |
| 5 | Model tiers | LOCKED policy — pointer only, never re-decide | `docs/research/model-tier-trial.md` |
| 6 | Selective verification | Ground truth over claims; verify exceptions, not everything green | orchestrator §Oracle-first QA · ops.md Gate v2 |
| 7 | Checkpoint/resume | Resume from artifacts; a session limit is a pause; never blind re-run | orchestrator §Stall watchdog |

## When to Use

- Orchestrator: before every dispatch (compose the envelope), on every return (parse + acceptance-check), at a stall/session limit (resume pointer).
- Role agents: when composing the final handoff message.
- Retro: when auditing $/story against the feature's Appetite.

**NOT for:**

- Model-tier changes — POLICY LOCKED, owner-ratified → `docs/research/model-tier-trial.md`
- Gate decisions / packet policy → `.claude/rules/ops.md` §Gate policy v2
- Role-rotation + handoff mechanics → `.claude/commands/camper.md` (ticket convention)

## Prerequisites

Read first: `.claude/agents/orchestrator.md` §Dispatch contract (the envelope's invariant half) · the ticket convention in `.claude/commands/camper.md`. Nothing else — this file is deliberately self-contained.

## Standards

### 1. Cache the stable prefix

Agent files (`.claude/agents/*.md`) are the stable prefix every dispatch reuses. Batch any shared-section edit (Dispatch contract, Output block) across all files in ONE pass, while no dispatch is in flight. Don't switch models/tools mid-session without need — cache invalidation is hierarchical and a thrash re-bills the whole history.

### 2. Pass pointers, not content

The dispatch envelope = ticket id · spec file path · allowed file surface · deltas (only facts that live nowhere on disk — chat decisions, distilled) · a machine-checkable `done_when` (the exact grep/command the orchestrator re-runs at acceptance). Target ≤ ~300 tokens. Anything on disk is a path, never a paste — pasted content duplicates what the agent would read anyway and goes stale on the first edit.

### 3. Return JSON, not prose

A role agent's ENTIRE final message is one JSON object extending the team shape `{ticket, status, artifacts, checks, summary, next}` — extension fields only (`needs_decision`, `blocked_on`, `details_file`); never rename or drop `ticket`/`status` (they drive `ticket-sync` → the /status board). Budget ~400 tokens, hard 500. Forbidden: pasted diffs (the orchestrator can `git diff`), full test output (`checks` carries pass/fail + numbers), process narration, praise. Detail that genuinely matters → a file, path returned in `details_file`. Complicated news goes in the escape valves (`needs_decision` with options + a recommendation; `blocked_on` with the blocking fact) — never break format for a paragraph.

### 4. Inline small work; spawn only for compression or parallelism

A subagent boots ~16k tokens — a lookup must never cost that. The ladder:

| Situation | Route |
|---|---|
| Lookup / single grep / scratch / tooling self-file (non-deliverable) | Inline in the main loop |
| Large read → small verdict (research, review) | ONE agent — compression pays for the boot |
| Independent partitioned stories | Spawn — max TWO code-writers, worktrees, partitioned files (owner rule) |
| Steps sharing evolving state (a cascade) | ONE agent — the interdependence test: if you can't name the independent subtask, don't spawn |

**Deliverable carve-out (hard rule):** any story deliverable routes to its owning role via `ticket-sync handoff` — inline never bypasses the Build→QA→Security→DevOps rotation. `complete()` blocks a story from Done without a Verify-stage role in `roleHistory`, so a bypass fails at the terminal gate anyway.

### 5. Route by task-fit model tier — pointer only

Tier assignment is LOCKED (owner-ratified 2026-07-04): resolution = explicit param > agent frontmatter > session; escalation only via the circuit-breaker ladder. Full policy + scorecard: `docs/research/model-tier-trial.md`. The `effort` dial is the cheaper first lever before any tier talk.

### 6. Verify the artifact, selectively

Ground truth over claims: an agent saying it did X is not X — check commits, files, ticket events, real command output. Every dispatch carries `done_when` so acceptance is a re-run, not a judgment call. But verify exceptions, not everything: the exception-first packet (Gate v2) exists because reflexively re-verifying green work is itself a documented waste.

### 7. Checkpoint and resume; never blind re-run

The ticket DB + `docs/specs/` artifacts + worktree branches ARE the checkpoints. A failed/stalled expensive run resumes from what landed (branch, partial commits, files) — the re-dispatch envelope cites those artifacts. A session limit is a pause: record a resume pointer (branch · artifacts landed · next step) in a ticket note before stopping. Never re-fire a fresh run with the same intent.

### 8. Where detail goes

Durable role output (test matrix, review findings, design brief) → the story's `docs/specs/<feature>/<epic>/<CAM-id>-<story>/` artifact (templates exist). Disposable run detail (long logs, debug notes) → the session scratchpad. Never a third place.

## Examples

**✅ Compliant envelope (~8 lines):**

```json
{ "ticket": "CAM-401", "spec": "docs/specs/host-os/lead-inbox/CAM-401-parse-line-leads/story.md",
  "files": ["lib/leads/parser.ts", "__tests__/cam-401-*.test.ts"],
  "deltas": ["owner chose option B at G1: dedupe by phone, not name"],
  "done_when": ["npx vitest run __tests__/cam-401-parser.test.ts → all pass", "grep 'dedupeByPhone' lib/leads/parser.ts → ≥1"] }
```

**❌ Fat prompt:** re-pasting the story.md body + the git/self-verify boilerplate the agent file already carries.

**✅ Compliant return:**

```json
{ "ticket": "CAM-401", "status": "done",
  "artifacts": ["lib/leads/parser.ts", "__tests__/cam-401-parser.test.ts"],
  "checks": { "vitest": "12/12 pass", "typecheck": "clean", "lint": "0 errors" },
  "summary": "Parser + dedupe-by-phone per BR-2; EC-3 covered.",
  "details_file": "docs/specs/host-os/lead-inbox/CAM-401-parse-line-leads/test.md",
  "needs_decision": [], "blocked_on": null, "next": "raise gate" }
```

**❌ Fat return:** a prose walkthrough + the full vitest output + the diff pasted inline.

## Reference Files

- `.claude/agents/orchestrator.md` — dispatch contract, routing ladder, stall watchdog, per-dispatch caps, model-tier resolution
- `.claude/commands/camper.md` — ticket/rotation convention + the TWO-code-writer parallel rule
- `.claude/rules/ops.md` — Gate policy v2 (exception-first packets)
- `docs/research/model-tier-trial.md` — the locked tier policy + scorecard
- `.claude/templates/feature.md` — §Appetite, the binding token/$ budget per feature

## Next Steps

$/story lands in the G3 packet (orchestrator §Per-dispatch caps). A budget blowout or stall-kill is a retro trigger — route the lesson through `/retro` into `docs/specs/LESSONS.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll paste the spec so the agent has full context." | It's on disk; the agent reads it via the pointer. Pointer + delta only. |
| "Full test output proves I ran it." | `checks` carries pass/fail + the numbers; detail goes to `details_file`. |
| "This fix is tiny — I'll do it inline." | Deliverable carve-out: story work routes to its owning role; rotation is code-enforced at `complete()`. |
| "The run died — re-run the story from scratch." | Resume from artifacts (branch, commits, files) and cite them in the re-dispatch. A re-fire throws away everything already paid for. |
| "Hard story — just bump the model." | Tier policy is LOCKED; escalation only via the circuit-breaker ladder. Try the `effort` dial first. |
| "I'll fix the agent file while the dispatch runs." | Frozen prefix: batch the edit and land it before the next dispatch. |

## Verify (exit criteria)

- [ ] Envelope ≤ ~300 tokens with a machine-checkable `done_when`
- [ ] Return = ONE JSON object ≤ 500 tokens; `ticket`/`status` intact; no pasted diff/test-dump/narration
- [ ] Any `details_file` path exists (specs folder or scratchpad)
- [ ] No story deliverable produced outside its owning role (rotation intact on the board)
- [ ] No agent file edited while a dispatch was in flight
