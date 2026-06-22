<!--
story template — copy the block below into a Linear issue to create ONE atomic story.
AC rule: "What the user sees" column = what the user perceives on screen + the verbatim Thai copy in quotes ·
         "Data/system effect" column = what the system stores/changes (plain language, no jargon).
Do NOT put event-codes / class names / variables / testids in the AC — those belong in the technical spec (tech).
Number every acceptance criterion AC-1, AC-2… and every rule BR-1, BR-2… — design/test/review reference these IDs.
Check template conformance: node scripts/linear-sync.mjs audit  (requires at least ## Story + ## AC).
-->

## Why
<business value, 1–2 lines> · **KPI:** <what to measure to know it worked>

## Story
As a **<persona: Admin | Camper | Host>** I want **<capability>** so that **<value / goal>**
Scope: <1 line — how far this ticket goes>

## AC
| # | Given (initial state) | When (user action) | What the user sees (verbatim Thai copy) | Data/system effect |
|---|---|---|---|---|
| AC-1 | <state / who is logged in> | <single action> | <on-screen result + "ข้อความจริงที่ผู้ใช้เห็น"> | <what the system creates / updates / deletes> |
| AC-2 |  |  |  |  |

## Rules
- **BR-1** <business rule / validation: exact value or bounds + the **real error copy** — reference the `.claude/rules/ux.md` catalog field, don't re-copy the regex>
- **BR-2** …

## Data
- <atomic entity / field touched + the migration needed (reversible)>

## Out of scope
- <what this ticket does NOT do> → <follow-up ticket / epic>

## Self-verify
- [ ] lint  - [ ] typecheck  - [ ] test + coverage ≥80%  - [ ] a11y  - [ ] design (token-only)  - [ ] security

## Links
spec: <Linear CAM-NNN> · PR: <#> · preview: <url> · design: `DESIGN.md` · siblings: `design.md` · `test.md` · `review.md` · `delivery.md`

## Changelog
- v1 (<date>) — created
