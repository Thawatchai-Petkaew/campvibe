---
name: discover
description: Run the Discovery & gap-closure loop — research the codebase + gather information, build a 6-dimension gap list, batch questions to the human in rounds until gaps are closed, then produce ticket/spec before G1. Use when starting work from a new/ambiguous requirement before touching code. Do NOT use once the spec/ticket has closed gaps (skip to build), or for just fixing a bug that already has clear AC.
---
# discover — research + close 6-dimension gaps, then produce ticket/spec before G1
Read first: `std/discovery.md` (DoR + how to ask back), `CLAUDE.md` (ironclad rules + 3-env)

## Input / preconditions
- requirement from the human (may be ambiguous) — no ticket/spec yet that closes gaps
- access to the real codebase + Linear team Campvibe
- work is still before G1 (Spec) — do NOT re-discover if gaps are already closed

## Workflow
1. Research the real thing before guessing: read `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*` + review existing work/issues in Linear
2. Build a gap list per dimension, all 6: Business · Functional · Technical · UX · Security/Data · Risk → tag each with status 🟢 closed / 🟡 assumed (needs confirm) / 🔴 must ask / ⚪ N/A
3. Collect the 🔴/🟡 questions → **ask the human in a single consolidated round**, each item with options + impact + "if unanswered, what is the default" — do NOT nitpick one question at a time
4. Once fully closed (no 🔴) → write the ticket from `ai-planning/templates/STORY-TICKET.md` (full story+AC, filed at story-level issue; role-task = sub-issue) → propose G1

## Watch for / Anti-patterns
- **Never guess silently** — don't know = raise 🔴 and ask
- AC uses the format `Given | When | what the user sees (Thai copy verbatim) | data/system result`; **do NOT put event-code/class names/variables/testid in AC** (those belong in the technical spec)
- Thai copy in AC: no em-dash (—) as a separator, no technical jargon in user-facing text
- 1 atomic story = 1 small PR; large gap → split into multiple stories, don't cram into one ticket
- Done = merge into staging + verify AC on the Staging URL; Released = promote staging→main — discovery does not touch this flow, but write AC so it can be verified on real staging

## Output / postconditions
- 6-dimension gap list with no 🔴 outstanding (🟡 must be confirmed first)
- story-level issue in Linear has full DoR: User Story + testable AC + NFR (perf/a11y/i18n/security) + clear out-of-scope
- status: awaiting human approval for G1 Scope (tagged with label `awaiting-you`)

## Verify
- run `node scripts/linear-sync.mjs audit` passes (issue must have at least `## Story` + `## AC`)
- check: no 🔴 gaps, every 🟡 has an answer/a default the human accepts, each AC is testable + already split into atomic stories
