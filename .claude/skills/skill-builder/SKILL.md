---
name: skill-builder
description: Interactively scaffold a new CampVibe skill — gather the skill's name, description, triggers, workflow, and examples by asking the owner one field at a time, then generate `.claude/skills/<name>/SKILL.md` to the SKILL-AUTHORING.md house style and validate it. Use when the owner wants to create a new repeatable skill/procedure (typically via `/camper "skill-builder …"`). Do NOT use when restyling an existing skill (edit it directly per SKILL-AUTHORING.md), capturing a one-off instruction (just say it), authoring a role rule in `.claude/rules/*` (use the `retro` skill + SKILL-AUTHORING.md), or wiring a slash command in `.claude/commands/*` (that names a skill, it does not define one).
---

# skill-builder

## Overview

Creating a skill today means hand-writing `SKILL.md` against `.claude/SKILL-AUTHORING.md` — easy to miss a section, the frontmatter contract, or the anti-bloat rules. This skill runs the authoring as an **interactive interview**: it asks the owner for each field one at a time, then scaffolds a house-style-correct `.claude/skills/<name>/SKILL.md` and validates it against the SKILL-AUTHORING checklist. It is the build-time sibling of `retro` (which feeds lessons into `.claude/rules/*`).

## Quick Reference

Invoke: `/camper "skill-builder <idea>"` (or directly when this skill fires). Then:

1. **Dedup** — `ls .claude/skills/`; a near-match → stop, propose strengthening the existing skill instead.
2. **Interview** the owner, one field at a time (AskUserQuestion): `name` (kebab) · purpose (what+why) · `When to Use` triggers + `NOT for` exclusions · Workflow steps (real commands/paths) · Prerequisites · Examples (✅/❌ or input→output) · scope (repo-wide / dir-scoped) · needs a `/command` wrapper?
3. **Draft** all official-floor sections in order, then the extras — dogfooding SKILL-AUTHORING.md.
4. **Write** `.claude/skills/<name>/SKILL.md` (single file; a `references/` file only if content > ~100 lines). Optional `.claude/commands/<name>.md` wrapper.
5. **Validate** against `SKILL-AUTHORING.md` §Verify → report the path + checklist result.

Section order (every skill): Overview → Quick Reference → When to Use (+ **NOT for:**) → Prerequisites → Workflow → Examples → Reference Files → Next Steps → Standards → Common Rationalizations → Verify.

## When to Use

- The owner wants a new **repeatable** procedure captured as a skill the harness can fire.
- Turning an ad-hoc workflow that recurs across stories into one canonical `SKILL.md`.

**NOT for:**

- Restyling/editing an existing skill → edit its `SKILL.md` directly against `.claude/SKILL-AUTHORING.md`.
- A one-off instruction → just state it (no skill).
- A role **rule** (`.claude/rules/<role>.md`) → use the `retro` skill + SKILL-AUTHORING.md (rules carry an optional `paths:` and have no firing trigger).
- A slash-command wrapper alone (`.claude/commands/*`) → that names a skill; it does not define one.

## Prerequisites

Read first: `.claude/SKILL-AUTHORING.md` (the binding house style — this skill enforces it) · the exemplar `.claude/skills/discover/SKILL.md` (canonical shape) · the existing `.claude/skills/` list (to dedup + match voice). Have: the owner available to answer the interview, and a one-line idea of what the new skill should do.

## Workflow

1. **Confirm it is new.** `ls .claude/skills/` + skim descriptions. If a skill already covers the intent, STOP and propose strengthening that one (anti-twin, per SKILL-AUTHORING). Confirm the kebab `name` is free and equals the new directory name.
2. **Interview the owner — one field at a time** (use AskUserQuestion; batch only tightly-related fields). Gather, and read back before writing:
   - `name` (lowercase-hyphen) and a one-line **purpose** (what it does + why) → Overview.
   - **When to Use** positive triggers, and **NOT for** exclusions (each cross-linked to the right skill/rule).
   - The **Workflow** steps — push for *real* commands/paths/values (`npm run …`, `node scripts/linear-sync.mjs …`, `.claude/templates/story.md`), not "do the thing".
   - **Prerequisites**, at least one **Example** (✅/❌ or input→output; Thai product copy verbatim in backticks if user-facing), and the **scope** (repo-wide skill vs a rule with `paths:`).
   - Whether a `/command` wrapper is wanted (the owner may just call via `/camper`).
3. **Draft the body** in section order (Quick Reference table above), dogfooding SKILL-AUTHORING: frontmatter `name` + `description` (third-person *what* + `Use when …` + `Do NOT use when …`, ≤1024 chars, **no steps inlined**); every official-floor section present; extras `## Standards` / `## Common Rationalizations` (one row per skippable step) / `## Verify` (every box provable).
4. **Write** `.claude/skills/<name>/SKILL.md`. Do not create empty `references/` or `scripts/` dirs (token-conscious). If the owner asked for a command, add `.claude/commands/<name>.md` that *names* this skill (does not restate the steps).
5. **Validate + report** against `SKILL-AUTHORING.md` §Verify: sections present and in order, frontmatter contract intact, value sections (Quick Reference, Examples) carry real content, markdown clean (blank line around every heading/list/table). Report the file path and the checklist outcome to the owner.
6. **Ship** via the normal flow — the owner reviews the draft, then it goes through `open-pr` → CI → `staging` (config/docs change; no app code). A new skill steers agent behavior, so the owner approves the merge.

## Examples

✅ **A frontmatter description that fires correctly** (what + when, no steps):
`description: Run the pre-merge quality gate — lint, typecheck, test+coverage, build, audit. Use when an atomic story is complete before opening a PR into staging. Do NOT use to decide Released (use promote-release).`

❌ **Steps leaked into the description** — the agent then follows the summary instead of the body:
`description: First run npm run lint, then typecheck, then npm test, then build, then audit, then …`

✅ **Interview field read-back before writing** (one field at a time):
`name = "smoke-prod" · purpose = "run the post-deploy production smoke + Sentry watch" · NOT for = "pre-merge gate → quality-gate; promote mechanics → promote-release" …` → confirm → scaffold.

## Reference Files

- `.claude/SKILL-AUTHORING.md` — the binding house style + §Verify checklist this skill enforces (the WHY for every section).
- `.claude/skills/discover/SKILL.md` — exemplar skill shape to match.
- the `retro` skill — the sibling for the *rule* side of authoring (`.claude/rules/*`).
- `.claude/commands/*` — slash-command wrappers (only name a skill).

## Next Steps

After validation the owner reviews the draft, then it ships via the `open-pr` skill into `staging` (config/docs only). The new skill fires on its next matching trigger; if the artifact was actually a role **rule**, route it through the `retro` skill instead.

## Standards

1. **Dogfood the standard.** The generated skill — and this one — carries every official-floor section in order plus the extras; value sections hold real content, empty structural sections say `none / N/A`.
2. **Interview, don't assume.** Ask the owner per field and read back before writing; a vague answer becomes a vague skill. Push every Workflow step to a real command/path/value.
3. **Dedup before create.** Scan `.claude/skills/` first; strengthen an existing skill rather than author a near-twin.
4. **Frontmatter is a contract.** Exactly `name` + `description`; the harness fires on the description, so it states *what/when* only — never the steps.
5. **Lean + token-conscious.** Keep `SKILL.md` well under the 500-line ceiling; split a `references/<name>.md` only when reference content exceeds ~100 lines; never create empty dirs to mimic official skills.
6. **Owner-governed.** A new skill steers the whole team's behavior, so the owner reviews the draft and approves the merge (consistent with owner-approves-all-gates).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The idea is clear, skip the interview and just write it." | The interview fields ARE the official floor; skipping them yields a skill missing sections. Ask per field, read back, then write. |
| "Put the steps in the `description` so it's discoverable." | The harness fires on the description and the agent then follows the summary, not the body. Description = what + when only. |
| "No need to check existing skills first." | You author a near-twin that bloats the set. `ls .claude/skills/` and strengthen the existing one instead. |
| "Drop the generated skill's Common Rationalizations / Verify — it's short." | Those are official-floor extras and the anti-skip enforcement. Every generated skill carries both, with measurable Verify boxes. |
| "Add a `references/` dir so it looks like the official skills." | Only when content exceeds ~100 lines. Empty dirs are noise. |
| "This is really a rule, but I'll make it a skill." | Rules (`.claude/rules/*`, `paths:`, no trigger) go through `retro` + SKILL-AUTHORING. A skill is a workflow the harness fires. |

## Verify (exit criteria)

- [ ] Deduped against `.claude/skills/` (no near-twin); `name` is kebab and equals the new directory.
- [ ] File written at `.claude/skills/<name>/SKILL.md`; `description` has third-person *what* + `Use when …` + `Do NOT use when …` (cross-linked), ≤1024 chars, no inlined steps.
- [ ] All official-floor sections present, in order, then the extras (Standards → Common Rationalizations → Verify); value sections carry real content, empty structural sections say `none / N/A`.
- [ ] Workflow steps name real commands/paths/values; Examples concrete (✅/❌ or input→output), Thai product copy verbatim in backticks where user-facing.
- [ ] Generated skill passes `SKILL-AUTHORING.md` §Verify; markdown clean (blank line around every heading/list/table); no empty `references/`/`scripts/` dir.
- [ ] Owner reviewed the draft; ships via `open-pr` into `staging` (config/docs only).
