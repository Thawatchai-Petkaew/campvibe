---
name: delivery-artifacts
description: Persist every workflow output as versioned files under docs/delivery/<feature>/<epic>/<CAM-id>-<story>/ and keep them in sync with the self-hosted delivery ticket DB. Use when starting a feature/epic/story (scaffold the folder), when any role finishes its step (author its artifact), and when a requirement changes (cascade-update + bump version). Do NOT use it to change ticket state (that is update-status) or to decide a gate (always the human; the orchestrator raises it); files hold content, the ticket DB holds live status.
---

# delivery-artifacts

## Overview

Make every delivery output durable: the requirement, AC, rules, design, tech, tests, security review, and ship record live as **files** per Feature → Epic → Story, versioned in git and kept current. **Files = content source-of-truth · the delivery ticket DB = live-status source-of-truth.** This is what lets an agent (or a human) pick up any story later and see exactly what was decided — and update it when the requirement changes.

Read first: `docs/delivery/README.md` (the SoT split + structure) · `.claude/SKILL-AUTHORING.md` (doc style) · the templates in `.claude/templates/*`.

## Quick Reference

```text
intake (new story)   → node scripts/ticket-sync.mjs scaffold <CAM-id>     # create folder + story.md only (role artifacts on-demand)
each role acts        → author YOUR artifact from `.claude/templates/*` when you act + keep its `status:` header = ticket state
every gate            → node scripts/ticket-sync.mjs index                # regen docs/delivery/INDEX.md
gate G3 / quality-gate→ node scripts/ticket-sync.mjs audit                # expected artifact ↔ roleHistory (exit 11 on drift)
requirement changed   → update story.md (bump version + Changelog) → cascade design/tech/test → epic rollup → (scope) Master-Plan/backlog → ticket DB → index
```

Layout: `docs/delivery/<feature-slug>/feature.md` · `<epic-slug>/epic.md` · `<CAM-id>-<story-slug>/{story,design,tech?,test,review,delivery}.md`. feature = the ticket's `featureName` · epic = the ticket's `epicId` FK · persona = the ticket's `persona` column (header, not a folder).

## When to Use

- Starting a feature/epic/story → scaffold its folder + files.
- A role finished its step (PO/architect/designer/qa/security/devops) → author/update that role's artifact.
- A requirement changed/was added → run the on-change cascade so the files stay the latest version.
- Regenerating `INDEX.md` or auditing artifact↔ticket-DB consistency.

**NOT for:**

- Changing ticket state/role — that is the `update-status` skill (the delivery ticket DB = status SoT).
- Deciding a gate — always the human (the orchestrator raises it).
- Writing the production code/tests themselves — that is the role agents; this skill captures their **output as a doc**.

## Prerequisites

`docs/delivery/README.md` · `.claude/templates/*` (the blanks) · the story's ticket (`CAM-id`, with `featureName` = feature and `epicId` = the epic ticket) · `APP_BASE_URL` + `STATUS_TOKEN` in `.env` for `scaffold`/`index`/`audit` (`scripts/ticket-sync.mjs` is a thin HTTP client over `/api/tickets/*`). Know the role→artifact map (Standards below).

## Workflow

1. **Scaffold at intake.** `node scripts/ticket-sync.mjs scaffold <CAM-id>` → creates the feature/epic containers (idempotent) + the story folder with **`story.md` only** (seeded from the ticket's `description`), headers prefilled from the ticket (feature/epic/persona/status). Role artifacts (`design/tech/test/review/delivery.md`) are **NOT** pre-created — each role authors its own from `.claude/templates/*` when it acts. Re-running never clobbers existing content. Then the **PO FILLS `feature.md` + `epic.md`** — scaffold only *stubs* them with `<placeholder>`: `feature.md` = overview + architecture/design overview + the epic→story rollup; `epic.md` = why/scope + the story rollup. `feature.md`/`epic.md`/`story.md` are **PO-authored + required at intake/G1** (and the `epic.md` rollup is kept current as stories move) — *not* on-demand like the role artifacts.
2. **Each role authors its artifact** when it acts (see the ownership map). Use **stable IDs**: number AC `AC-1…` and rules `BR-1…` in `story.md`; downstream artifacts **reference the IDs** (not re-describe). Reference canonical sources — `.claude/rules/ux.md` (validation catalog), `DESIGN.md` (tokens), `docs/adr/*`, `prisma/schema.prisma` — never re-copy.
3. **Keep the header current.** On every state move, the owning agent updates the file's `status:` header to match the ticket state (the `update-status` skill moves the ticket DB; this keeps the file aligned) and appends a `## Changelog` line on a material change (`vN (date) — what changed · CAM-id`).
4. **On requirement change (cascade).** Update `story.md` (bump `version` + Changelog) → update/flag-stale `design.md`/`tech.md`/`test.md` → refresh `epic.md` rollup → if scope shifts, update `docs/project/product-plan.md` + `master-plan.md` → sync the ticket DB → `index`.
5. **Verify.** `node scripts/ticket-sync.mjs index` (regen) + `… audit` (audit ties expected artifacts to the story's accumulated `roleHistory`: a role acted but its artifact is missing = fatal; not-yet-scaffolded = info; a completed story = exempt).

## Examples

- ✅ `scaffold CAM-118` → `docs/delivery/wishlist/wishlist-core/CAM-118-toggle-heart/` with 6 headed files; PO fills `story.md` (`AC-1`/`AC-2`, `BR-1`), qa fills `test.md` (`AC-1 → __tests__/…`).
- ❌ Re-typing the phone regex + Thai error into `design.md`/`test.md` → drift. Reference `.claude/rules/ux.md` catalog + bind the field instead.
- ✅ Requirement changes (add guest case) → `story.md` gains `AC-2` + `v2` Changelog → `test.md` adds the `AC-2` row → `index` regenerated.
- ❌ Editing `INDEX.md` by hand → it is generated; run `index`.

## Reference Files

- `docs/delivery/README.md` — the store contract · `.claude/templates/*` — the blanks · `scripts/ticket-sync.mjs` — `scaffold`/`index`/`audit`.
- `.claude/rules/ux.md` (validation catalog) · `DESIGN.md` (tokens) · `docs/adr/*` · `prisma/schema.prisma` — the canonical sources artifacts reference.
- `update-status` (ticket state) · `quality-gate` (runs `audit`) · `discover` (writes feature/epic/story) — sibling skills.

## Next Steps

After scaffolding, the loop proceeds normally (G1→G5); each role fills its artifact when it acts, the gate audits, `INDEX.md` reflects live status. On a change, run the cascade (step 4).

## Standards

- **Ownership (who writes what):** PO/analyst → `feature.md`/`epic.md`/`story.md`; architect → `feature.md ## Architecture` + `story.md ## Data` + `tech.md`(optional) + ADRs; designer → `design.md` (only when the story has UI); qa → `test.md`; security → `review.md`; devops → `delivery.md`; orchestrator → scaffold + `INDEX.md` + audit.
- **Header contract:** every file carries `linear`/`feature`/`epic`/`persona`/`artifact`/`owner`/`status`/`version`/`updated` + a `## Changelog` (the `linear:` header key is kept as-is — it still holds the `CAM-id`, now sourced from the delivery ticket DB rather than Linear; renaming the key is a template-migration change, out of this skill's scope). `status` mirrors the ticket state.
- **DRY + traceability:** reference canonical sources by `AC-n`/`BR-n`, never duplicate. A new validated field goes into the `ux.md` catalog **first**, then referenced.
- **PO-authored (required) vs on-demand (role):** scaffold *creates* `feature.md`/`epic.md`/`story.md` as containers, but the **PO must FILL all three at intake/G1** — they are content, not `<placeholder>` stubs (and the `epic.md` rollup stays current as stories move). Only the **role** artifacts (`design/test/review/delivery.md`, `tech.md` for a rich API contract) are **on-demand** — authored from `.claude/templates/*` **only when that role acts**, never pre-created and never padded with `N/A`. `audit` expects a role's artifact only when the story's `roleHistory` includes that role (a designer entry → `design.md`, a qa entry → `test.md`, a security entry → `review.md`, a devops entry → `delivery.md`); a no-UI story simply has no `design.md` and that is correct.
- **Files first, then the ticket DB:** on a change, edit the file (+ version) before syncing the ticket DB; `INDEX.md` is generated — never hand-edit.

## Common Rationalizations

| Rationalization | Reality |
| --- | --- |
| "The ticket DB has the ticket, the file is redundant." | The ticket DB holds live status; the file is the durable, versioned content (design/tech/test/review) that the next role + future-you read. |
| "I'll copy the regex/error into design + test so each is self-contained." | That drifts. Reference the `.claude/rules/ux.md` catalog by field + `BR-n`; one source. |
| "Requirement changed — I'll just update the ticket." | Update `story.md` first (bump version + Changelog) and cascade design/tech/test, then the ticket DB. The audit catches a skipped file. |
| "I'll hand-edit INDEX.md to add my story." | INDEX is generated from the delivery ticket DB — run `node scripts/ticket-sync.mjs index`. |
| "This story has no UI — should I add a `N/A` design.md?" | No — there is simply no `design.md` (the designer never acted). `roleHistory` tells audit what to expect; don't pad with `N/A` files. |
| "I'll scaffold later when it's done." | Scaffold at intake so each role fills its artifact as it acts — not a big write-up at the end. |

## Verify (exit criteria)

- [ ] `node scripts/ticket-sync.mjs scaffold <CAM-id>` created the feature/epic containers + the story folder with **`story.md`** (correct headers, idempotent on re-run); role artifacts were NOT pre-created.
- [ ] **`feature.md` + `epic.md` were FILLED by the PO** (not left as scaffold `<placeholder>` stubs); `epic.md` carries the story rollup, kept current as stories move.
- [ ] Each role authored its own artifact from `.claude/templates/*` only when it acted (no `N/A` padding); each references canonical sources by `AC-n`/`BR-n` (no duplicated regex/tokens); `tech.md` present only for a rich API contract (else `story.md ## Data`).
- [ ] Every authored file's `status:` header matches the ticket state; a material change bumped `version` + added a `## Changelog` line.
- [ ] `node scripts/ticket-sync.mjs index` regenerated `docs/delivery/INDEX.md`; `… audit` is clean (every `roleHistory` entry has its artifact present; a no-UI story has no `design.md` and that is fine).
- [ ] On a requirement change, the cascade ran (story → design/tech/test → epic rollup → Master-Plan/backlog if scope → the ticket DB → index).
