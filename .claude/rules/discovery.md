---
name: discovery-and-spec
description: Standard for turning a raw requirement into a buildable spec before G1 (Scope), with no guessing. Use when starting work from a new or ambiguous requirement. Use when you must close gaps before writing any code. Use when authoring a STORY-TICKET, AC, or DoR. Memory for the PO/Analyst role; pairs with .claude/rules/architecture.md, .claude/rules/qa.md, .claude/rules/ux.md, .claude/rules/performance.md, DESIGN.md, CLAUDE.md.
---

# Discovery & Spec

## Overview

Discovery turns a raw requirement into a spec you can build without guessing. G1 (Scope) is the one moment where scope changes for free — after it, change is expensive. Close every blocking gap, write the AC, and only then propose G1.

## When to Use

- Starting any feature from a new or ambiguous requirement, before touching code
- Building the 6-dimension gap list and batching questions to the human in rounds
- Authoring a STORY-TICKET (User Story + AC + Rules + Data) and checking Definition of Ready
- Verifying a ticket matches the template via `node scripts/linear-sync.mjs audit`

**NOT for:**

- Architecture / data-model decisions once scope is set — see `.claude/rules/architecture.md`
- Writing negative/edge test cases from the AC — that is QA's job, see `.claude/rules/qa.md`
- Turning a vague NFR into a measured target like LCP — see `.claude/rules/performance.md`
- UX validation and PDPA constraints inside the AC — see `.claude/rules/ux.md`
- Building once the spec/ticket has closed all gaps — skip to build

## Principles

- **Spec-first** — do not close Discovery while any 🔴 gap is open; every AC must trace back to the requirement. G1 is the only place scope changes for free; after it, change is expensive.
- **Research before guessing** — look at the real code/Linear before forming an assumption; cut 🔴 gaps from the start.
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

1. Real research: read `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*`, and check Linear (team Campvibe) for existing/duplicate work.
2. Build the gap list per dimension → tag each 🟢/🟡/🔴/⚪.
3. Batch the 🔴/🟡 questions → ask the human in a **single round**; each item has: options + impact of each path + "if no answer, default = …".
4. All closed (no 🔴) → write the ticket from `ai-planning/templates/STORY-TICKET.md` → propose G1.

### 4. Ticket = 1 atomic story

Use the template exactly — `## ทำไม` (+KPI) · `## Story` (ในฐานะ…ฉันต้องการ…เพื่อ…+ขอบเขต) · `## AC` (GFM table: Given | When | ผลที่ผู้ใช้เห็น + Thai copy verbatim | ผลเชิงข้อมูล) · `## Rules` (values/bounds + real error) · `## Data` (atomic fields + migration) · `## Out of scope` (+ point to the follow-up ticket) · `## Self-verify` · `## Links`.

- The story body + AC go into the **story-level issue** in Linear (role-task = sub-issue). Check template conformance with `node scripts/linear-sync.mjs audit` (must contain `## Story` + `## AC`).
- **persona** = Admin | Camper | Host. AC left side = "what the user sees" (real Thai copy); AC right side = "what the system stores/changes" (plain language).

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
- **AC verification rigor** (embedded in STORY-TICKET): cover states on responsive/mobile (as words the user sees, not class names) · Thai copy verbatim, exact glyphs including the `{N}` placeholder · every editable input has full rules (required/format/bounds/when-to-warn/real message) = QA's negative test cases.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll guess the value/bounds and keep writing AC." | Raise 🔴 and ask first. |
| "I'll ask one question at a time across rounds." | Batch one round + options + default. |
| "AC like 'the system works correctly' is enough." | Make it granular + Thai copy verbatim + data-level result. |
| "Put the event-code/class name/variable/testid in the AC." | Those live only in the technical spec. |
| "An em-dash (—) is fine to separate Thai copy; jargon (API, webhook, endpoint) is fine in user copy." | Use plain language. |
| "One big chunk across many concerns ships faster." | Split atomic; small work uses one ticket, add spec/tech/test only when genuinely complex. |
| "Skip Linear and just build." | Research first, or you duplicate/conflict with existing work. |

## Verify (exit criteria)

- [ ] Researched the codebase + Linear (not guessing)
- [ ] Gap list covers all 6 dimensions · no 🔴 open · every 🟡 has a default
- [ ] User Story + testable AC + NFR + out-of-scope complete (DoR)
- [ ] Broken into an atomic story (1 small PR)
- [ ] Ticket matches the template + `node scripts/linear-sync.mjs audit` passes
- [ ] Propose G1 with a summary of gaps/assumptions used
