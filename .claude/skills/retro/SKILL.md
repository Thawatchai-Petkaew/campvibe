---
name: retro
description: Run a story retrospective that distills lessons from closed work and feeds them back into the team's memory — appends to the `docs/specs/LESSONS.md` ledger and proposes promotions into `.claude/rules/<role>.md` for owner approval. Use when a story is Done (merged + verified) and you want the Scout sub-agents to actually get smarter, or to re-run learning on any past CAM ticket. Do NOT use it to run the pre-merge checks (that is `quality-gate`), to write the spec (`discover`), or to change ticket status (`update-status`).
---

# retro

## Overview

Close the learning loop. Today lessons from closed work live only in the orchestrator's memory, so the Scout sub-agents (frontend/backend/qa/security/devops/designer/architect) never get smarter. This skill mines a closed story from durable sources, distills what should change next time, records it in an append-only ledger, and proposes promotions into the role rule files that every sub-agent reads before working (Iron Rule #4) — so the team improves for real, without rule bloat.

Read first: `CLAUDE.md` (Iron Rule #4 + gates) · `.claude/SKILL-AUTHORING.md` (house style + anti-bloat) · the target `.claude/rules/<role>.md` before proposing a row.

## Quick Reference

Manual only — owner runs it; there is no auto-trigger at close.

1. Invoke: `/retro <CAM-###>` (one story) · `/retro <CAM-###> <CAM-###>` (batch) · `/retro` (stories closed since the last ledger entry). Also reachable via `/camper "retro <CAM-###>"`.
2. **Record the Trigger** — which criterion warranted this retro: gate rejection / stall-kill / spend-cap exceeded / prod error in watch window / ≥2 rework rounds / owner request. Every retro artifact states one.
3. **Gather** durable evidence (works months later): `git log`/`git diff` for the story's PR, the ticket + **comments** (owner gate feedback) via `node scripts/ticket-sync.mjs show <CAM-id>`, `gh pr view`, the `docs/specs/<…>/<story>/` artifacts.
4. **Distill** 0–N lessons. Each: `{role(s), type, mistake → better rule, provenance CAM-###, generality}`. Drop anything that is a one-off or already covered.
5. **Route** each by generality (see Workflow §4).
6. **Append** every kept lesson to `docs/specs/LESSONS.md` (status `proposed`).
7. **Propose** rule promotions as a concrete diff → raise to the owner. On approval: apply the row, flip the ledger status to `promoted`.
8. **Ticket every action item** — an action item is a tracker entry with a named owner, never a bare prose bullet.

## When to Use

- A story reached **Done** (merged to `staging` + AC verified) and you want its lessons captured before they evaporate.
- Re-running learning on an older closed CAM ticket, or a batch, after a process change.
- A gate **rejection** happened — the owner's comment is the highest-value lesson source; capture why it was sent back.

**NOT for:**

- The pre-merge gate (lint/typecheck/test/build/audit) — use the `quality-gate` skill.
- Writing the spec/ticket or closing Discovery gaps — use the `discover` skill.
- Moving ticket state/role/handoff — use the `update-status` skill + `scripts/ticket-sync.mjs`.
- One-off task instructions or project-status facts — those go to orchestrator memory, not a rule.

## Prerequisites

Read first: this file · `.claude/SKILL-AUTHORING.md` (so a promoted row matches house style) · `docs/specs/LESSONS.md` (so you dedupe against what is already captured) · the specific `.claude/rules/<role>.md` you intend to edit. Have: the closed story's CAM id(s), repo + `gh` access, `scripts/ticket-sync.mjs` access (`APP_BASE_URL`/`STATUS_TOKEN`, for ticket comments/events).

## Workflow

1. **Resolve the story set.** From the arg(s): a CAM id, several ids, or `/retro` with none → the stories Done since the last `docs/specs/LESSONS.md` entry. Confirm each is actually closed (merged); a still-open story has no settled lesson yet.
2. **Record the Trigger** on the retro artifact (`.claude/templates/retro.md`'s `Trigger:` line): gate rejection · stall-kill (per the orchestrator's stall watchdog) · spend-cap exceeded · a prod error surfaced in the post-deploy watch window · ≥2 rework rounds on one story (the circuit-breaker threshold, `.claude/agents/orchestrator.md` §Circuit breaker) · or a direct owner request. This is mandatory, not optional — gate policy v2 (`.claude/rules/ops.md` §Gate policy v2) requires every retro to replay all gate rejections plus at least one real failure to the owner (automation-bias evidence: summaries silently omit ~41% of issues when the reviewer isn't shown the failure directly), so the Trigger line is what proves this retro actually did that.
3. **Gather durable evidence** (never depend on the live session — it must work months later):
   - `gh pr view <#> --json title,body,files` + `git diff <base>...<head>` for what actually changed and why.
   - The ticket via `node scripts/ticket-sync.mjs show <CAM-id>` — returns the description, **comments**, and the full `TicketEvent` history; the owner's gate-rejection comments are the richest signal.
   - `docs/specs/<feature>/<epic>/<story>/` artifacts (story/design/tech/test/review/delivery) for the intended vs actual.
4. **Distill lessons (orchestrator does this — not the agent that erred, to avoid reinforcing its own assumptions).** For each candidate write: `role(s)` affected · `type` (data | perf | image | writing | security | a11y | process) · the **mistake → the better rule** in one line · `provenance` CAM-### · `generality` (reusable-role-general | one-off | worldview | visual | process-gap). Keep only what changes how a role works next time.
5. **Route by generality:**
   - **reusable + role-general →** propose a row in `.claude/rules/<role>.md`: a `## Common Rationalizations` row (a "we did X, should do Y" trap) or a `## Standards` bullet (a new positive rule). Always cite the CAM-### as the WHY. Owner approves (§ governance).
   - **one-off / project-status fact →** orchestrator memory (unchanged) — never a rule.
   - **cross-cutting principle / owner worldview →** `docs/context/` (Second Brain) — flag for the owner.
   - **visual / token →** `DESIGN.md`.
   - **process / step gap →** the relevant `.claude/skills/<skill>` body.
6. **Ledger (always).** Append one row per kept lesson to `docs/specs/LESSONS.md`: `date · CAM · role · lesson(one line) · type · destination · status`. The ledger is the audit trail, the dedupe source, and the prune driver.
7. **Promote (owner-gated).** Present the proposed rule diff(s) to the owner as a glanceable change. On approval, apply the row(s) and flip the ledger status `proposed → promoted`. Rule files are the brain that steers the whole team, so a human approves every rule change (consistent with owner-approves-all-gates).
8. **Ticket every action item.** Any follow-up action (not just a rule promotion) becomes a tracker entry with a named owner — `node scripts/ticket-sync.mjs create` — never a bare prose bullet with no owner attached.
9. **Govern (every run, before adding a row):** check the ledger + the target section for a near-duplicate → **strengthen/merge an existing row, do not append a twin**. Run a prune pass when a rule file nears the SKILL-AUTHORING size ceiling.

## Examples

`/retro CAM-201` (this session's flicker fix) produced:

- **Ledger rows** in `docs/specs/LESSONS.md`:
  - `2026-06-27 · CAM-201 · code · deployed-only bug ("works local, breaks on Staging/Prod") → suspect env/cache-header/case-sensitivity before app logic · process · rules/code.md · promoted`
  - `2026-06-27 · CAM-201 · performance · static assets swapped at runtime need immutable Cache-Control; the default max-age=0,must-revalidate causes a per-frame revalidation flash · perf · rules/performance.md · promoted`
- **Promoted rule rows** (owner-approved): a `## Common Rationalizations` row in `.claude/rules/code.md` (the deployed-only-bug triage) and one in `.claude/rules/performance.md` (immutable cache for runtime-swapped assets), each citing CAM-201.
- **Routed elsewhere, not a rule:** "staging deploy can dedup when the merge tree equals a branch-preview tree" → orchestrator memory (project-status, one-off), not a rule.

✅ A row that earns its place: `| "A sprite/image only flickers in prod, so it's a deploy fluke." | Runtime-swapped assets with max-age=0,must-revalidate revalidate every swap → blank flash on the network, invisible on localhost. Serve them immutable (CAM-201). |`
❌ A row that should not be added: `| "Always preload every image." | ...` — too broad, not traced to a defect, will rot. Capture the specific, provenanced lesson instead.

## Reference Files

- `docs/specs/LESSONS.md` — the append-only ledger this skill writes.
- `.claude/templates/retro.md` — the optional per-story retro artifact (`docs/specs/<…>/<story>/retro.md`).
- `.claude/rules/*.md` — promotion targets (the `## Common Rationalizations` / `## Standards` sections).
- `.claude/SKILL-AUTHORING.md` — house style + anti-bloat the promoted rows must match.
- the `update-status` skill + `scripts/ticket-sync.mjs` — ticket state (separate concern).

## Next Steps

After the owner approves the promotions, the loop is closed by Iron Rule #4: the next time a sub-agent of that role is dispatched it reads the updated `.claude/rules/<role>.md` and applies the lesson. Periodically run a prune pass (ledger-driven) to merge/retire stale rows so rule files stay under the SKILL-AUTHORING ceiling.

## Standards

1. **Manual, owner-controlled.** No auto-trigger. The owner decides when to run `/retro` and approves every rule promotion.
2. **Durable sources only.** Mine git/PR/ticket/artifacts, never the live session — a retro must reproduce months later.
3. **Distil from a fresh perspective.** The orchestrator distills, not the sub-agent that did (or erred on) the work — avoids reinforcing the same blind spot.
4. **Every promoted lesson carries provenance.** A CAM-### in the row, so a future reader knows why the rule exists (Chesterton's Fence).
5. **Strengthen before you add.** Dedupe against the ledger and the target section; merge into an existing row rather than appending a near-twin.
6. **Lean.** A lesson enters a rule only if it is reusable and role-general; one-offs go to memory. Keep rule files under the size ceiling; prune on a cadence.
7. **Trigger recorded, every time.** Every retro states which of the six criteria warranted it (gate rejection / stall-kill / spend-cap exceeded / prod error in watch window / ≥2 rework rounds / owner request) — this is the anti-rubber-stamp companion gate policy v2 requires, not a nice-to-have.
8. **Action items are tickets, not prose.** A follow-up with no tracker entry and no named owner does not count as routed — file it via `ticket-sync.mjs create`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The story shipped, the lesson is in my head — skip the retro." | In-head lessons die with the session and never reach the Scout sub-agents. Capture to the ledger + the role rule. |
| "Drop the lesson straight into the rule file." | Rules steer the whole team. Append to the ledger, then propose a diff for owner approval; only then edit the rule. |
| "Add every observation as a new rule row." | That is how rules bloat and rot. Only reusable, provenanced lessons; strengthen an existing row before adding a twin. |
| "Capture from this conversation's notes." | The session is not durable. Mine git/PR/ticket/artifacts so the retro reproduces later. |
| "Let the agent that wrote the code reflect on it." | Single-agent reflection entrenches the same assumption. The orchestrator distills from a different vantage. |
| "A one-off deploy quirk belongs in the rules." | One-offs and project-status facts go to orchestrator memory; rules are for reusable role behavior. |

## Verify (exit criteria)

- [ ] Ran only on closed (merged) stories; evidence pulled from git/PR/ticket/artifacts, not the live session.
- [ ] Each kept lesson has `role · type · mistake→rule · CAM provenance · generality`; one-offs routed to memory, not rules.
- [ ] Every kept lesson appended to `docs/specs/LESSONS.md` with a `proposed`/`promoted` status.
- [ ] Rule promotions presented as a diff and **approved by the owner** before any `.claude/rules/*.md` edit; ledger flipped to `promoted` on apply.
- [ ] Deduped against the ledger + target section (merged, not twinned); touched rule files stay under the SKILL-AUTHORING ceiling.
- [ ] Trigger recorded (one of the six criteria) on the retro artifact; all gate rejections + at least one real failure replayed to the owner, not just summarized.
- [ ] Every action item is a tracker entry with a named owner — none left as an unticketed prose bullet.
