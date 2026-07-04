---
name: discovery-and-spec
description: Standard for turning a raw requirement into a buildable spec before G1 (Scope), with no guessing. Use when starting work from a new or ambiguous requirement. Use when you must close gaps before writing any code. Use when authoring a story ticket, AC, or DoR. Memory for the PO/Analyst role; pairs with .claude/rules/architecture.md, .claude/rules/qa.md, .claude/rules/ux.md, .claude/rules/performance.md, DESIGN.md, CLAUDE.md.
---

# Discovery & Spec

## Overview

Discovery turns a raw requirement into a spec you can build without guessing. G1 (Scope) is the one moment where scope changes for free — after it, change is expensive. Close every blocking gap, write the AC, and only then propose G1.

## Quick Reference

Fast path from raw requirement to G1:

1. **Research first** — read `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*` + check the ticket DB (`node scripts/ticket-sync.mjs list`/`show`) for existing/duplicate work.
2. **Build the 6-dimension gap list** — Business · Functional · Technical · UX · Security/Data · Risk — tag each gap 🟢 closed / 🟡 assumed (state the default) / 🔴 must-ask / ⚪ N/A.
3. **Batch the questions in one round** — collect every 🔴/🟡 into a single ask; each item carries options + impact + "if no answer, default = …".
4. **Write the ticket** — from `.claude/templates/story.md`, 1 atomic story (PR ≤ ~400 lines), AC with Thai copy verbatim, DoR met.
5. **Propose G1** — gate passes when **no 🔴 remains** and `node scripts/ticket-sync.mjs audit` confirms the ticket (`## Story` + `## AC`).

## When to Use

- Starting any feature from a new or ambiguous requirement, before touching code
- Building the 6-dimension gap list and batching questions to the human in rounds
- Authoring a story ticket (User Story + AC + Rules + Data) and checking Definition of Ready
- Verifying a ticket matches the template via `node scripts/ticket-sync.mjs audit`

**NOT for:**

- Architecture / data-model decisions once scope is set — see `.claude/rules/architecture.md`
- Writing negative/edge test cases from the AC — that is QA's job, see `.claude/rules/qa.md`
- Turning a vague NFR into a measured target like LCP — see `.claude/rules/performance.md`
- UX validation and PDPA constraints inside the AC — see `.claude/rules/ux.md`
- Building once the spec/ticket has closed all gaps — skip to build

## Prerequisites

Read before starting: this file · `DESIGN.md` (for any UI-facing requirement) · `CLAUDE.md` (iron rules + gates). Have on hand: the raw requirement, access to the codebase (`prisma/schema.prisma`, `app/`, `lib/`, `components/`), the ticket DB (`node scripts/ticket-sync.mjs list`/`show`), and the template `.claude/templates/story.md`. Know which dimensions hand off to siblings — `.claude/rules/architecture.md`, `.claude/rules/qa.md`, `.claude/rules/ux.md`, `.claude/rules/performance.md`.

## Principles

- **Spec-first** — do not close Discovery while any 🔴 gap is open; every AC must trace back to the requirement. G1 is the only place scope changes for free; after it, change is expensive.
- **Research before guessing** — look at the real code / ticket DB before forming an assumption; cut 🔴 gaps from the start.
- **Batch questions, don't nitpick** — the human is the bottleneck. Collect questions into a single round; each item carries options + impact + default.
- **No silent guessing** — don't know = raise 🔴 and ask, not fill in a value silently.

## Standards

### 1. Six gap dimensions

Cover every dimension before closing:

**Business · Functional · Technical · UX · Security/Data · Risk**

### 2. Gap states

| State | Meaning |
|---|---|
| 🟢 | Closed (answer/evidence in hand) |
| 🟡 | Assumed (needs confirmation) |
| 🔴 | Must ask (blocker) |
| ⚪ | N/A |

Pass G1 when **no 🔴 remains**. Every 🟡 must state the default that will be used if no answer comes back.

### 3. The loop

1. Real research: read `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*`, and check the ticket DB (`node scripts/ticket-sync.mjs list`/`show`) for existing/duplicate work.
2. Build the gap list per dimension → tag each 🟢/🟡/🔴/⚪.
3. Batch the 🔴/🟡 questions → ask the human in a **single round**; each item has: options + impact of each path + "if no answer, default = …".
4. All closed (no 🔴) → write the ticket from `.claude/templates/story.md` → propose G1.

### 4. Ticket = 1 atomic story

Use the template exactly (v2, English framework — story.md §"story v2") — `## Story` (As a **persona**, I want capability, so that outcome + Scope + `Depends on:`; value lives in the "so that" clause, no separate `## Why`; a one-line `Why: <reason>` inside `## Story` is allowed only when the reason isn't obvious — incident lesson, external constraint) · `## AC` (GFM 6-column table: `# | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge`) · `## Rules` (BR-n: values/bounds/transitions/defaults + real error) · `## Edge cases` (EC-n: invalid/empty/concurrent/permission/boundary, EARS `IF <condition> THEN <response>`) · `## Data` (atomic fields + migration) · `## Seams & refs` (reuse pointer + ADR ref, no implementation) · `## Out of scope` (+ point to the follow-up ticket) · `## Self-verify`. Phrase AC/EC in EARS form (Given = state, When = ONE trigger, failure = "IF…THEN…") and ban vague adverbs (fast/easy/robust) — use numbers.

- The story body + AC go into the **story-level ticket** in the ticket DB (created via `node scripts/ticket-sync.mjs create`; role-task = sub-ticket). Check template conformance with `node scripts/ticket-sync.mjs audit` (must contain `## Story` + `## AC`).
- **persona** = Admin | Camper | Host. Framework (Given/When/Then/headings) is English; AC's "Then" column = "what the user sees" (verbatim Thai copy, char-for-char incl. `{N}`); "System effect" column = what the system stores/changes (plain language); "Neg/edge" column names the failure twin (EC-n or AC-n) — a `—` needs a stated reason.

### 5. Definition of Ready (DoR — "ready to build")

- User Story + testable AC
- NFR stated clearly (perf/a11y/i18n/security)
- Out-of-scope is explicit
- Broken into an atomic story (1 small PR ≤ ~400 lines)
- AC verifiable on the real **Staging URL** (Done = merge → `staging`, not just passing lint)

### 6. Spec quality

- **Six spec components** that must be clear before closing: (1) goal + a measurable definition of "success"; (2) the real run commands (not just tool names); (3) file layout / code location; (4) code style with an example; (5) tests + coverage target; (6) explicit scope (always / ask-first / never).
- **Surface assumptions early** — list the assumed tech/architecture/constraints where the human can see them (as a 🟡 with a default); don't keep them in your head.
- **Measurable AC** — convert vague words ("faster") into a real target (e.g. LCP ≤ 2.5s) per `.claude/rules/performance.md`.
- **Vertical slice + work size** — break into slices that ship end-to-end (not all-DB → all-API → all-UI); work larger than ~5–8 files = split further.
- **AC verification rigor** (embedded in story ticket): cover states on responsive/mobile (as words the user sees, not class names) · Thai copy verbatim, exact glyphs including the `{N}` placeholder · every editable input has full rules (required/format/bounds/when-to-warn/real message) = QA's negative test cases · every happy AC row names its Neg/edge twin (EC-n) or carries `—` with a stated reason.

### 7. On a requirement change — re-run Discovery + artifact cascade

A changed or added requirement re-enters Discovery (close the new gaps), then run the artifact cascade so `docs/specs/` stays the latest version: update `story.md` (bump `version` + add a `## Changelog` line) → cascade `design.md`/`tech.md`/`test.md` → refresh the `epic.md` rollup → if scope shifts, update `docs/project/product-plan.md`/`master-plan.md` → sync the ticket DB → `node scripts/ticket-sync.mjs index`. Files = content SoT, ticket DB = live status.

## Examples

**Gap tagging — surface the assumption (🟡 + default) vs guess silently:**

- ✅ `🟡 Technical — max photos per camp listing. Options: 5 / 10 / 20. Impact: storage + upload UX. If no answer, default = 10.` — visible, defaulted, confirmable at G1.
- ❌ Picking "10" in the schema and writing AC around it without ever raising it. A silent guess hides scope; it surfaces as rework after G1.

**AC granularity — what the user sees + data result vs a vague pass:**

- ✅

  | # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
  |---|---|---|---|---|---|
  | AC-1 | Camp is closed for booking | User taps the book button | Button is greyed out (unclickable) + `แคมป์นี้เต็มแล้ว` | No Booking created; availability unchanged | EC-1 |

- ❌ `Given a camp · When booking · Then the system works correctly` — untestable, no Thai copy, no data result, no Neg/edge twin, gives QA nothing to write a negative case against.

## Reference Files

- `.claude/templates/story.md` — the ticket structure to fill (the 6 spec components land here).
- `.claude/rules/architecture.md` — data-model / API-contract / migration decisions once scope is set (G2 Technical).
- `.claude/rules/qa.md` — turning each AC into negative/edge test cases.
- `.claude/rules/ux.md` — UX validation + PDPA constraints inside the AC.
- The `discover` skill — runs this loop step-by-step (research → gap list → batched rounds → ticket → G1).

## Next Steps

Once every gap is closed (no 🔴, each 🟡 defaulted) and the ticket passes `node scripts/ticket-sync.mjs audit` → **propose G1 (Scope)** with a summary of gaps and assumptions used. On G1 approval, hand off to the architect (data model / API contract) and the designer (flow / states / Design Brief) for G2 (Design) before any build.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll guess the value/bounds and keep writing AC." | Raise 🔴 and ask first. |
| "I'll ask one question at a time across rounds." | Batch one round + options + default. |
| "AC like 'the system works correctly' is enough." | Make it granular + Thai copy verbatim + data-level result. |
| "Put the event-code/class name/variable/testid in the AC." | Those live only in the technical spec. |
| "An em-dash (—) is fine to separate Thai copy; jargon (API, webhook, endpoint) is fine in user copy." | Use plain language. |
| "One big chunk across many concerns ships faster." | Split atomic; small work uses one ticket, add spec/tech/test only when genuinely complex. |
| "Every task gets a ticket." | Card only deliverable work (feature/fix/perf/security with AC, tracked on /status, behind gates). Tooling/docs/config/process — a skill, the lessons ledger, a baseline doc — is a plain PR with no card; CAM-205/206 over-carded internal tooling. |
| "A quick hotfix / one-off issue doesn't need a project." | Every tracked issue gets a project (+ a parent epic for a story) AT CREATION, or it orphans on /status and must be retro-grouped later (CAM-191 hotfix + the CAM-96..104 Atomic Schema epic both slipped). |
| "Skip the ticket DB and just build." | Research first, or you duplicate/conflict with existing work. |
| "เขียนว่า 'ระบบทำงานถูกต้อง/รวดเร็ว' ใน AC ก็พอ" | Vague adverbs are untestable (NASA SE Handbook ban-list); use numbers and exact copy. |

## Verify (exit criteria)

- [ ] Researched the codebase + the ticket DB (not guessing)
- [ ] Gap list covers all 6 dimensions · no 🔴 open · every 🟡 has a default
- [ ] User Story + testable AC + NFR + out-of-scope complete (DoR)
- [ ] Broken into an atomic story (1 small PR)
- [ ] Ticket matches the template + `node scripts/ticket-sync.mjs audit` passes
- [ ] Propose G1 with a summary of gaps/assumptions used
