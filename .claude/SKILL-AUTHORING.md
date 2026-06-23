# SKILL-AUTHORING.md — how to write a CampVibe skill / rule doc

House style for `.claude/skills/*/SKILL.md` and the `.claude/rules/*.md` role-memory docs. A skill is a **workflow the agent runs**, not a reference dump. Sections + information must be **at least equal to an official Claude skill** (`anthropics/skills`); our distinctive sections (Common Rationalizations, measurable Verify) come **after** the official floor. A section stays even when light — but it carries real content or an explicit `none / N/A`.

## Overview

Every skill ships as `.claude/skills/<lowercase-hyphen-name>/SKILL.md`. The harness reads the YAML `description` to decide when to fire it, then loads the body as the procedure. `.claude/rules/*.md` are role memory (one per role) read before work — same anatomy, optional `paths:` frontmatter for path-scoped auto-load, no firing trigger. Exemplars to copy: `.claude/skills/discover/SKILL.md` and `.claude/rules/discovery.md`.

## Quick Reference

Section order = **official floor → our extras**. Every doc has all of these. *Value* sections (Quick Reference, Examples) always carry real content ≥ the official depth; *structural* sections (Prerequisites, Reference Files, Next Steps) may say `none / N/A` when genuinely empty.

| # | Section | Source | Holds |
|---|---|---|---|
| — | Frontmatter | required | skills: `name` + `description`; rules: same + optional `paths:` |
| 1 | `## Overview` | official | 1–2 sentences — what it does + why it matters |
| 2 | `## Quick Reference` | official | cheat-sheet: the commands / decision table / step list at a glance |
| 3 | `## When to Use` + `**NOT for:**` | official "when" | positive triggers, then exclusions cross-linked to the right doc |
| 4 | `## Prerequisites` | official "Before Starting" | what to read/have first (may be `none`) |
| 5 | `## Workflow` / `## Process` | official | numbered steps — real commands, real paths, real values |
| 6 | `## Examples` | official | a concrete input→output, or ✅/❌ |
| 7 | `## Reference Files` | official | links to `references/`, `.claude/rules/*`, sibling skills (or `none — single-file`) |
| 8 | `## Next Steps` | official | the handoff / next skill (optional) |
| 9 | `## Standards` | ours | numbered rigor (= enriched "Best Practices") |
| 10 | `## Common Rationalizations` | ours | `\| Rationalization \| Reality \|` table (= enriched "Avoid") |
| 11 | `## Verify (exit criteria)` | ours | measurable checklist — every box provable (= enriched "QA") |

`.claude/rules/*.md` may localize the workflow/standards heading names (`## หลักการ` / `## มาตรฐาน` / `## Checklist`) but keep the same shape and the same official-floor coverage.

## When to Use

- Authoring a new skill, or restyling an existing `SKILL.md` / `.claude/rules/*.md` to the template above.
- A procedure (skill) or standard (rule) repeats across stories and you want one canonical version instead of re-explaining it each session.

**NOT for:** one-off task instructions (just say them) · the ironclad rules in `CLAUDE.md` (those override everything; do not fork them here) · slash-command wiring in `.claude/commands/*` (that names the skill, it does not define it).

## Prerequisites

Read first: this file · the two exemplars (`.claude/skills/discover/SKILL.md`, `.claude/rules/discovery.md`) · the target's neighbours so cross-refs land correctly. For a rule, know which file globs it governs (for optional `paths:`).

## Workflow (writing the body)

Write the sections in the Quick Reference order. For each:

1. **Frontmatter (verbatim contract).** Skills carry exactly `name` + `description`; the harness depends on both, so polish wording but never drop or rename them. Rules add an optional `paths:` list (file globs) for path-scoped auto-load.
   - `name` — lowercase-hyphen, matches the directory name (skills) / the role (rules).
   - `description` — third person: what it does, then `Use when …` (positive trigger), then `Do NOT use when …` (exclusion + cross-link). Max 1024 chars. Describe *what/when*, never paste the steps.
2. **Overview** — one or two sentences: what this does and why it matters. May keep a one-line `Read first:` pointer (the full list goes in Prerequisites).
3. **Quick Reference** — the fast path: the exact commands in order, a decision table, or a numbered TL;DR. A reader in a hurry acts from this; the Workflow is the full version.
4. **When to Use** — positive triggers, then `**NOT for:**` with cross-links to the correct doc (e.g. promote vs `open-pr` vs `quality-gate`).
5. **Prerequisites** — what to read/have/know before step 1 (the rules/specs/tools). `none` if truly standalone.
6. **Workflow / Process** — numbered steps. Be specific: `Run \`npm run lint\` · \`npm run typecheck\` · \`npm test\``, not "verify the build". Reference real artifacts (`prisma/schema.prisma`, `.claude/templates/story.md`, `node scripts/linear-sync.mjs audit`). Keep the stack, 3-env flow, and gates G1–G5 intact.
7. **Examples** — at least one concrete example: input → the exact output/artifact, or a ✅ correct vs ❌ wrong pair. Use real CampVibe values (Thai copy verbatim where it is user-facing).
8. **Reference Files** — list bundled `references/*` (only if the skill has them), plus the `.claude/rules/*` and sibling skills this one leans on. `none — single-file skill` is valid; do not invent a `references/` dir for content under ~100 lines.
9. **Next Steps** — what runs after this (the next skill / the gate). Optional but preferred for workflow skills.
10. **Standards** — the numbered, enforceable rules (a rule doc's core; a skill may fold this into Workflow).
11. **Common Rationalizations** — the `| Rationalization | Reality |` table. One row per step an agent is tempted to skip, with a factual counter.
12. **Verify (exit criteria)** — a checklist where every box is provable by evidence (command output, Staging URL check, audit pass).

## Examples

Canonical skeleton (skills) — official floor in order, our extras after:

```markdown
---
name: my-skill
description: One line — what it does. Use when <trigger>. Do NOT use when <exclusion → other skill>.
---

# my-skill

## Overview
## Quick Reference
## When to Use     (+ **NOT for:**)
## Prerequisites
## Workflow
## Examples
## Reference Files
## Next Steps
## Common Rationalizations
## Verify (exit criteria)
```

- ✅ `## Quick Reference` → `Run in order: \`npm run lint\` → \`typecheck\` → \`npm test -- --coverage\` → \`build\` → \`npm audit --omit=dev\``
- ❌ `## Quick Reference` → "Run the quality checks." (no commands = not a reference)
- ✅ `## Reference Files` → `none — single-file skill; leans on \`.claude/rules/qa.md\`, \`.claude/rules/security.md\``
- ❌ creating an empty `scripts/` or `references/` dir to mirror official skills

## Reference Files

- Exemplar skill: `.claude/skills/discover/SKILL.md`
- Exemplar rule: `.claude/rules/discovery.md`
- The merged template + the official floor it extends: this file's Quick Reference.

## Standards

- **Official floor is the minimum.** Every doc carries all official-floor sections (Overview, Quick Reference, When to Use, Prerequisites, Workflow, Examples, Reference Files, Next Steps); our extras (Standards, Common Rationalizations, Verify) come after. Value sections carry real content; structural sections may be `none/N/A`.
- **Thai product copy stays Thai, verbatim, in backticks.** User-facing strings, AC left-column wording, and error text are not translated. Doc prose is English; the strings inside it are not.
- **Process over knowledge.** Steps, not facts. If it reads like a textbook, move it to a `references/` file and link it (only when it exceeds ~100 lines).
- **Anti-rationalization is the load-bearing section.** Every skippable step needs a row; "I'll add tests later", "simple enough to skip the spec", "Done = lint passed" all get a Reality.
- **Verification is measurable.** "Verify AC on the Staging URL", "`linear-sync audit` passes", "`npm audit --omit=dev` → 0 high/critical" — not "make sure it works".
- **Token-conscious.** Keep the main file lean (well under the official 500-line ceiling); split a supporting `references/<name>.md` only when reference material exceeds ~100 lines. Do not create empty dirs to mirror others.
- **Cross-reference, don't duplicate.** Point at the other skill or rule by name (`.claude/rules/qa.md`, the `open-pr` skill); never copy its content.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll put the steps in the description so it's discoverable." | The agent then follows the summary instead of reading the body. Description = what + when only. |
| "Translate the Thai UI strings so the doc is all English." | Thai product copy is a mandate; verbatim in backticks. Translating it changes the product. |
| "This skill is obvious, skip the Rationalizations table." | The table is what stops the agent skipping steps. No table = no enforcement. |
| "'Verify' can just say make sure it works." | Unmeasurable checkboxes pass trivially. Each box needs evidence (command/URL/audit). |
| "Quick Reference just repeats the Workflow, so I'll drop it." | They serve different readers — the cheat-sheet to act fast, the Workflow for the full path. Both are required. |
| "Examples are filler for a doc this short." | A concrete input→output (or ✅/❌) is an official-floor section; it removes ambiguity the prose leaves. Always populate it. |
| "Reference Files is empty, so I'll omit the heading." | Keep the heading; write `none — single-file skill`. Omitting an official-floor section breaks the floor. |
| "Add a `references/` dir like the official skills." | Only when content exceeds ~100 lines. Empty dirs are noise (token-conscious). |
| "Restyle means I can tighten the steps and drop a few." | Restyle = add the official floor + voice; preserve every existing rule, command, value, threshold, and cross-link. |

## Verify (exit criteria)

- [ ] File at `.claude/skills/<name>/SKILL.md` (or `.claude/rules/<role>.md`); `name` = lowercase-hyphen = dir/role; rules may add `paths:`.
- [ ] `description` has third-person *what* + `Use when …` + `Do NOT use when …` (cross-linked), ≤1024 chars, no inlined steps.
- [ ] **All official-floor sections present, in order:** Overview → Quick Reference → When to Use (+ **NOT for:**) → Prerequisites → Workflow → Examples → Reference Files → (Next Steps); then the extras: Standards (if any) → Common Rationalizations → Verify.
- [ ] Value sections (Quick Reference, Examples) carry real content ≥ official depth; empty structural sections say `none / N/A` (not omitted).
- [ ] Steps name real commands/paths/values; stack + 3-env + gates G1–G5 intact; Thai copy verbatim in backticks; every existing rule/value/threshold/cross-ref preserved.
- [ ] Every Verify checkbox is provable by evidence; no vague "works".
- [ ] Clean markdown: blank line around every heading, list, and table. `references/` dir created only when content exceeds ~100 lines.

## Next Steps

After authoring, apply the template in the relevant round (skills → R2, rules → R3, agents/DESIGN/CLAUDE → R4), then verify each file against the checklist above before opening the PR into `staging`.
