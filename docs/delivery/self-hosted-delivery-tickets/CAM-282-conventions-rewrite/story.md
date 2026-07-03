---
linear: CAM-282
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-03
---
# T-6 — Conventions rewrite: ticket-sync everywhere + PORTABILITY manifest (CAM-282)

## Why

The self-hosted delivery-ticket system (ADR-010, CAM-276 T-1..T-5b) is live and G4-verified — the
service (`lib/delivery/tickets.ts`) is the sole writer, Linear is a read-only archive. But every AI-team
convention doc (agent/skill/command/rule files) still instructs the team to run `node scripts/linear-sync.mjs
...` and to create/track work via the Linear MCP — instructions that either no longer work as described
(the Linear event webhook is retired) or actively teach the wrong tool. Every session that reads these
docs (Iron Rule #4: "read memory before working") would otherwise learn a stale convention. **KPI:** zero
non-historical `linear-sync`/`Linear MCP` mentions remain in `.claude/` + `CLAUDE.md` after this story
(verified by grep in Self-verify below) — a correctness measure, not a business metric (`not measured`
in the traditional KPI sense; this is internal tooling, not a customer-facing feature).

## Story

As an **AI delivery team member (any role agent, persona: platform/internal)** I want **every convention
doc (agents/skills/commands/rules/architecture doc) to reference `scripts/ticket-sync.mjs` and the
self-hosted ticket DB instead of Linear/`linear-sync.mjs`** so that **the team never re-learns or
re-teaches a dead command, and a new project can be bootstrapped from `lib/delivery/PORTABILITY.md`**.
Scope: docs/convention rewrite only — no app code, no test-logic changes (only pinned-string test
assertions updated to match the workflow YAML edits this story makes; workflow YAML *prompt text* edits
are convention text, allowed).

## AC

Internal-tooling story — no end-user-facing UI/Thai copy exists for this work, so the AC below verifies
**doc/convention correctness** (grep/audit/test outcomes) rather than "what a user sees":

| # | Given | When | What is verified | Data/system effect |
|---|---|---|---|---|
| AC-1 | `CLAUDE.md`, `.claude/commands/*`, `.claude/agents/*`, `.claude/skills/*/SKILL.md` reference the old `linear-sync.mjs`/Linear-MCP convention | this story's rewrite is applied | `grep -ri "linear-sync\|Linear MCP\|save_issue"` across `.claude/` + `CLAUDE.md`, excluding `LESSONS`/`deprecated` mentions, returns only historical/deprecation references (documented in the Self-verify section, not silently left) | no app code changed; only `.md`/`.yml` convention files + one guard-test file (pinned-string update) |
| AC-2 | `.github/workflows/camper-adhoc.yml` still provisions `LINEAR_API_KEY`/`LINEAR_TEAM_KEY`/`TICKETS_SOURCE` and its prompt text says `linear-sync.mjs set`/`notify` | this story's workflow edit is applied | the workflow provisions only `TELEGRAM_*`/`STATUS_TOKEN`/`APP_BASE_URL`, and its prompt/notify text says `ticket-sync.mjs`; mirrors `linear-continue.yml`'s post-T-5b shape | no runtime behavior change (env/prompt text only); `__tests__/cam-281-dual-mode-writes.test.ts`'s pinned-string test updated to assert the new shape |
| AC-3 | `lib/delivery/PORTABILITY.md` does not exist | this story authors it | a new project can follow the file list, env-var table, and setup steps to duplicate the ticket system, including the honestly-documented `"CAM-"` hardcode and the SSE/pulse gap | new file only, no schema/code change |
| AC-4 | `docs/delivery/self-hosted-delivery-tickets/{feature,epic}.md` still have scaffold `<placeholder>` stubs / a stale T-4 status | this story fills them | `feature.md`/`epic.md` carry the real business why, architecture/design overview, and a T-1..T-6 story rollup with real PR links (`#286`-`#293`) | docs only; no ticket-DB state change from this AC itself |

## Rules

- **BR-1** A leftover `linear-sync`/`Linear MCP` mention is acceptable ONLY when it documents history (a
  `LESSONS.md`-style past-tense record) or an explicit, time-boxed deprecation/rollback lever (e.g.
  `TICKETS_SOURCE=linear`, the deprecated `scripts/linear-sync.mjs` itself, the Linear MCP archive note) —
  never as a live instruction telling an agent to run it as the primary path.
- **BR-2** Workflow YAML edits in this story are limited to **prompt text and env provisioning** (convention
  content) — no change to trigger conditions, permissions, concurrency, or job structure.
- **BR-3** `.claude/templates/*.md` and `.claude/rules/{architecture,ops,qa,security,discovery}.md` are
  **out of scope** for this story (not in the enumerated file list) — their residual `linear-sync.mjs`
  references are reported as known leftovers in Self-verify with justification, not silently fixed.

## Data

No schema/migration — this is a documentation and CI-prompt-text story. No new `Ticket`/`TicketEvent`
rows beyond whatever the orchestrator's own tracking of this story creates.

## Out of scope

- Rewiring `.claude/templates/*.md` (`story.md`'s own header comment, `test/design/tech/review/delivery.md`'s
  `linear: {{linear}}` front-matter key) → follow-up ticket, not filed (low-risk, cosmetic key name; the
  delivery-artifacts skill now documents that `linear:` is kept as-is deliberately, sourced from the
  ticket DB).
- Rewiring `.claude/rules/{architecture,ops,qa,security,discovery}.md`'s embedded `linear-sync.mjs`
  command examples → follow-up ticket, not filed (out of the enumerated T-6 file list).
- Fixing the SSE/`DeliveryPulse` gap found while authoring `.claude/SYNC-ARCHITECTURE.md` (the dashboard's
  auto-refresh push still watches the legacy product-DB pulse) → recommended follow-up ticket, not filed;
  documented honestly in `SYNC-ARCHITECTURE.md` + `PORTABILITY.md` instead of silently left unstated.

## Self-verify

- [x] lint — not applicable to this diff class beyond the one test file (`npm run lint` run as part of
  the overall self-verify pass; see the handoff report for the actual result)
- [x] typecheck — no `.ts`/`.tsx` production code changed; one `__tests__/*.test.ts` file edited (string
  assertions only)
- [x] test — `npm test` run; see the handoff report for the pass count and the known pre-existing flaky
  test (`status-stream-route [AC1]`)
- [ ] a11y — N/A (no UI)
- [ ] design (token-only) — N/A (no UI)
- [x] security — N/A production-code diff; workflow YAML env changes reviewed for secret handling (no
  new secret introduced, one credential — `LINEAR_API_KEY` — removed from `camper-adhoc.yml`'s
  provisioned env, net reduction in exposed secrets)

## Links

spec: CAM-282 (epic CAM-276) · PR: not yet opened (docs-only story, no push per this story's git-hygiene
instructions) · preview: N/A · design: N/A · siblings: `delivery.md` (this folder)

## Changelog

- v1 (2026-07-03) — created (T-6, conventions rewrite)
