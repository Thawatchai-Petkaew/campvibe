---
name: discover
description: Run the Discovery & gap-closure loop — research the codebase + gather information, build a 6-dimension gap list, batch questions to the human in rounds until gaps are closed, then produce ticket/spec before G1. Use when starting work from a new/ambiguous requirement before touching code. Do NOT use once the spec/ticket has closed gaps (skip to build), or for just fixing a bug that already has clear AC.
---

# discover

## Overview

Turn a raw, possibly-ambiguous requirement into a buildable spec without guessing. Research the real codebase + Linear first, build a gap list across all 6 dimensions, batch the open questions to the human in a single consolidated round, and only produce the ticket once no blocking gap remains. G1 (Scope) is the one point where scope changes for free — every gap left open here gets expensive later.

## Quick Reference

The discovery loop, as a numbered TL;DR:

1. **Research** the real thing — `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*`, plus existing/duplicate/conflicting issues in Linear (team Campvibe). Reduce gaps from evidence, not assumption.
2. **Build the 6-dimension gap list** — Business · Functional · Technical · UX · Security/Data · Risk — tagging each gap:
   - 🟢 closed — has an answer/evidence
   - 🟡 assumed — needs confirmation; **must carry the default** you will use if unanswered
   - 🔴 must ask — blocker
   - ⚪ N/A
3. **Batch the questions in ONE round** — collect every 🔴/🟡 and ask the human once; each item carries options + impact of each path + `if unanswered, default = …`. Never nitpick one question at a time.
4. **Write the STORY-TICKET** from `ai-planning/templates/STORY-TICKET.md` once no 🔴 remains (full story + AC on the story-level issue; role-task = sub-issue).
5. **Propose G1** with a summary of gaps closed + assumptions used.

**Gate to pass:** no 🔴 open · every 🟡 carries a default the human accepts · `node scripts/linear-sync.mjs audit` passes (issue has at least `## Story` + `## AC`) → then tag `awaiting-you` for G1 Scope.

## When to Use

Use this skill when:

- Starting work from a new or ambiguous requirement, before touching code.
- No ticket/spec exists yet that closes the gaps.
- Work is still before G1 (Scope).

**NOT for:**

- A spec/ticket whose gaps are already closed — skip to build.
- Fixing a bug that already has clear, testable AC.
- Promoting `staging`→`main` to prod — use `/promote-release --to prod`.
- Summarizing overall team status — use `/status`.

## Prerequisites

Read first:

- `.claude/rules/discovery.md` — the full DoR, the 6 spec components, vertical-slice rule, and the 4-layer audit framing all live there.
- `CLAUDE.md` — ironclad rules + 3-env flow.

## Workflow

1. **Research the real thing before guessing.** Read `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*`, and review existing work/duplicate/conflicting issues in Linear (team Campvibe). Reduce 🔴 gaps from evidence, not assumption.
2. **Build a gap list across all 6 dimensions:** Business · Functional · Technical · UX · Security/Data · Risk. Tag each gap with a status:
   - 🟢 closed — has an answer/evidence
   - 🟡 assumed — needs confirmation; must carry the default you will use if unanswered
   - 🔴 must ask — blocker
   - ⚪ N/A
3. **Batch the questions.** Collect the 🔴/🟡 items and ask the human in a **single consolidated round** — never nitpick one question at a time. Each item carries: options + impact of each path + "if unanswered, default = …".
4. **Produce the ticket once fully closed (no 🔴).** Write it from `ai-planning/templates/STORY-TICKET.md` (full story + AC, filed on the story-level issue; role-task = sub-issue), then propose G1 with a summary of gaps/assumptions used.

## Examples

**A 🟡 gap with its default (✅) vs a silent guess (❌):**

- ✅ 🟡 *Functional — when a camper cancels < 24h before check-in, do they get a refund?* Options: full refund / 50% / none. Impact: affects payout + the confirmation copy. `if unanswered, default = 50% refund` → carried into the batched round for the human to confirm.
- ❌ Quietly writing the AC as "full refund" because it seems fair, without raising it. Guessing silently breaks Spec-first.

**One AC row (Thai copy verbatim on the left, system result on the right):**

| Given | When | What the user sees | Data/system result |
| --- | --- | --- | --- |
| ผู้ใช้ล็อกอินแล้วอยู่หน้าจองแคมป์ | กดปุ่ม `ยืนยันการจอง` โดยยังไม่ได้เลือกวันเข้าพัก | ข้อความ `กรุณาเลือกวันเข้าพักก่อนทำการจอง` | ไม่สร้างรายการจอง · ระบบไม่บันทึกข้อมูล |

(Left column = the real Thai copy the user sees, verbatim in backticks; right column = what the system stores/changes, plain language. No event-codes/testids in AC.)

## Reference Files

- `.claude/rules/discovery.md` — full DoR, 6 spec components, vertical-slice rule, 4-layer audit.
- `ai-planning/templates/STORY-TICKET.md` — the ticket template the story + AC are written from.
- Sibling skills: `quality-gate` (run the pre-merge gate on the build), `open-pr` (open the 1-story PR into `staging`).

## Next Steps

1. **Gaps closed** (no 🔴, every 🟡 has an accepted default) → **propose G1** (Scope), tagged `awaiting-you`.
2. **On G1 approval** → hand to architect/designer for the spec/design at **G2** (Design).
3. **Build** the atomic story → verify via the `quality-gate` skill, then ship with the `open-pr` skill (PR into `staging` = Done).

## Standards

1. **Ticket = 1 atomic story.** Follow `ai-planning/templates/STORY-TICKET.md` exactly. Persona = Admin | Camper | Host.
2. **AC format:** `Given | When | what the user sees (Thai copy verbatim) | data/system result`. Left side = what the user sees (real Thai copy); right side = what the system stores/changes (plain language).
3. **Keep AC user-facing.** Do NOT put event-codes, class/variable names, or testids in AC — those belong in the technical spec.
4. **Thai copy hygiene.** In AC, no em-dash (`—`) as a separator and no technical jargon (`API`, `webhook`, `endpoint`) in user-facing text.
5. **Slice atomic.** 1 atomic story = 1 small PR (≤ ~400 lines). A large gap splits into multiple stories — do not cram into one ticket. Small work uses a single ticket; add spec/tech/test only when genuinely complex.
6. **Verifiable on real Staging.** Write AC so it can be verified on the live Staging URL. Done = merge into `staging` + verify AC on Staging URL; Released = promote `staging`→`main`. Discovery does not touch that flow, but the AC must survive it.
7. **File and audit in Linear.** Story + AC go on the **story-level** issue (role-task = sub-issue). Validate against the template with `node scripts/linear-sync.mjs audit`.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "I can infer this value, no need to ask." | Guessing silently breaks Spec-first. Raise 🔴 and ask — do not fill it in quietly. |
| "I'll ask the rest as it comes up." | The human is the bottleneck. Batch all 🔴/🟡 into one round with options + impact + default. |
| "'System works correctly' covers it." | Vague AC is untestable. Make it granular, with Thai copy verbatim + the concrete data result. |
| "Adding the testid/event-code to AC is more precise." | It pollutes user-facing AC. Those live in the technical spec only. |
| "It's one big feature, one ticket is fine." | Multiple concerns ≠ atomic. Split into 1-PR stories; cramming hides scope and blocks review. |
| "I already know the codebase, skip the Linear check." | You may duplicate or conflict with existing work. Research first. |
| "A 🟡 assumption is good enough to proceed." | Only if it carries the default the human accepts. Otherwise it is a 🔴. |

## Verify (exit criteria)

- [ ] Researched codebase + Linear (not guessed).
- [ ] Gap list covers all 6 dimensions · no 🔴 outstanding · every 🟡 carries a default the human accepts.
- [ ] Story-level issue has full DoR: User Story + testable AC + NFR (perf/a11y/i18n/security) + clear out-of-scope.
- [ ] Each AC is testable and already split into atomic stories (1 small PR).
- [ ] Ticket matches the template and `node scripts/linear-sync.mjs audit` passes (issue must have at least `## Story` + `## AC`).
- [ ] Status: awaiting human approval for G1 Scope (tagged with label `awaiting-you`).
