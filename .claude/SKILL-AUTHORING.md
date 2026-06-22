# SKILL-AUTHORING.md — how to write a CampVibe skill / std-agent doc

House style for `.claude/skills/*/SKILL.md` and the `std/*.md` role-memory docs. A skill is a **workflow the agent runs**, not a reference dump. If removing a section would not change agent behavior, cut it.

## Overview

Every skill ships as `.claude/skills/<lowercase-hyphen-name>/SKILL.md`. The harness reads the YAML `description` to decide when to fire it, then loads the body as the procedure. `std/*.md` docs are role memory (one per role) read before work — same anatomy, no firing trigger. Examples to copy: `.claude/skills/discover/SKILL.md` and `std/discovery.md`.

## When to Use

- Authoring a new skill, or restyling an existing `SKILL.md` / `std/*.md`.
- The procedure repeats across stories and you want one canonical version instead of re-explaining it each session.

**NOT for:** one-off task instructions (just say them) · the ironclad rules in `CLAUDE.md` (those override everything; do not fork them here) · slash-command wiring in `.claude/commands/*` (that names the skill, it does not define it).

## Frontmatter (required, verbatim contract)

Skills carry exactly two keys; the harness depends on both, so polish wording but never drop or rename them.

```yaml
---
name: discover
description: Run the Discovery loop — research the codebase, build a 6-dimension gap list, batch questions to the human until gaps close, then produce the ticket/spec before G1. Use when starting from a new/ambiguous requirement before touching code. Do NOT use once the spec has closed gaps, or for a bug that already has clear AC.
---
```

1. `name` — lowercase-hyphen, matches the directory name.
2. `description` — third person: what it does, then `Use when …` (positive trigger), then `Do NOT use when …` (exclusion + cross-link the right skill). Max 1024 chars. Describe *what/when*, never paste the steps — the agent must read the body, not act on a summary.

## Workflow (writing the body)

Use these headings in order. `std/*.md` docs may localise heading names (e.g. `## หลักการ` / `## มาตรฐาน/กฎ` / `## ต้องคำนึง / anti-patterns` / `## Checklist`) but keep the same shape.

1. `## Overview` — one or two sentences: what this does and why it matters.
2. `## When to Use` — positive triggers, then `**NOT for:**` with cross-links to the correct skill (e.g. promote vs `open-pr` vs `quality-gate`).
3. `## Workflow` / `## Standards` — numbered steps. Be specific: real commands, real paths, real values. Write `Run \`npm run lint\` · \`npm run typecheck\` · \`npm test\``, not "verify the build". Reference real artifacts: `prisma/schema.prisma`, `ai-planning/templates/STORY-TICKET.md`, `node scripts/linear-sync.mjs audit`. Keep the stack (Next/Prisma/NextAuth/Tailwind+shadcn/Vercel/Linear), 3-env flow, and gates G1–G5 intact.
4. `## Common Rationalizations` — the `| Rationalization | Reality |` table. One row per step an agent is tempted to skip, with a factual counter.
5. `## Verify (exit criteria)` — a checklist where every box is provable by evidence (command output, Staging URL check, audit pass).

## Standards

- **Thai product copy stays Thai, verbatim, in backticks.** User-facing strings, AC left-column wording, and error text are not translated. Doc prose is English; the strings inside it are not.
- **Process over knowledge.** Steps, not facts. If it reads like a textbook, move it to a reference and link it.
- **Anti-rationalization is the load-bearing section.** Every skippable step needs a row; "I'll add tests later", "this is simple enough to skip the spec", "Done = lint passed" all get a Reality.
- **Verification is measurable.** "Verify AC on the Staging URL", "`linear-sync audit` passes", "`npm audit --omit=dev` → 0 high/critical" — not "make sure it works".
- **Token-conscious.** Keep the main file ~1 screen. Split a supporting `lowercase-hyphen.md` only when reference material exceeds ~100 lines; do not create an empty `scripts/` dir to mirror others.
- **Cross-reference, don't duplicate.** Point at the other skill or std doc by name (`std/qa.md`, the `open-pr` skill); never copy its content.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll put the steps in the description so it's discoverable." | The agent then follows the summary instead of reading the body. Description = what + when only. |
| "Translate the Thai UI strings so the doc is all English." | Thai product copy is a mandate; verbatim in backticks. Translating it changes the product. |
| "This skill is obvious, skip the Rationalizations table." | The table is what stops the agent skipping steps. No table = no enforcement. |
| "'Verify' can just say make sure it works." | Unmeasurable checkboxes pass trivially. Each box needs evidence (command/URL/audit). |
| "Add a `scripts/` dir like the other skills." | Empty dirs are noise. Add files only when they earn their tokens (>100 lines or runnable). |
| "Restyle means I can tighten the steps and drop a few." | Restyle = voice only. Preserve every rule, command, value, threshold, and cross-link. |

## Verify (exit criteria)

- [ ] File at `.claude/skills/<name>/SKILL.md` (or `std/<role>.md`); `name` = lowercase-hyphen = dir name.
- [ ] `description` has third-person *what* + `Use when …` + `Do NOT use when …` (cross-linked), ≤1024 chars, no inlined steps.
- [ ] Sections present in order: Overview → When to Use (+ **NOT for:**) → Workflow/Standards (numbered) → Common Rationalizations (table) → Verify (checklist).
- [ ] Steps name real commands/paths/values; stack + 3-env + gates G1–G5 intact; Thai copy verbatim in backticks.
- [ ] Every Verify checkbox is provable by evidence; no vague "works".
- [ ] Clean markdown: blank line around every heading, list, and table. Fits ~1 screen, or overflow is split into a linked supporting file.
