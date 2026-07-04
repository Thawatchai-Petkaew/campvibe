---
artifact: epic
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
status: In Progress
version: v2
updated: 2026-07-03
---
# Self-hosted Delivery Tickets (CAM-276)

## Why

The AI-delivery pipeline tracked every epic/story/gate as a Linear issue and hit Linear's free-tier
275-issue cap pre-launch, with no revenue to justify paying (cost-discipline non-negotiable). Beyond the
cap, Linear's generic workflow states left every pipeline-specific concept (gate-wait, role attribution,
regression count, epic grouping) enforced only by label/title-string convention, and `/status` freshness
was bounded by a third-party webhook's delivery latency. **KPI:** zero issue-cap blockers going forward
(不 measured in currency — the practical measure is "can we keep creating tickets," which was false on
Linear's free tier and is now unbounded on our own Postgres plan); dashboard freshness bounded by an
in-process pulse bump instead of a webhook hop (not independently benchmarked against the old webhook
latency — `not measured`, but structurally guaranteed to be ≤ the same request that mutates the ticket).

## Scope

- In: own Prisma schema + database (`prisma/delivery/`) · a real 9-verb guarded state machine +
  append-only `TicketEvent` audit ledger (`lib/delivery/tickets.ts`) · `/api/tickets/*` + a read-adapter
  reproducing the legacy `StatusIssue` shape byte-for-byte (zero changes to `/status`'s render layer) ·
  `scripts/ticket-sync.mjs` CLI replacing `scripts/linear-sync.mjs` for every AI-team convention ·
  import of the 275 legacy Linear issues + a parity check against Linear · retiring the Linear
  write/event-webhook path · rewriting every AI-team convention doc (agents/skills/commands/rules) to
  the new CLI + architecture.
- Out: a UI for the ticket system beyond the existing `/status` + `/status/map` boards (reused, not
  rebuilt) → no follow-up ticket, not planned. Multi-project support (`projectKey` column) → deferred to
  a future ADR when a second project is real (YAGNI today). Rewiring `/status`'s SSE auto-refresh from
  the legacy product-DB pulse to the new `DeliveryPulse` (a real gap found while writing T-6's
  `.claude/SYNC-ARCHITECTURE.md`) → recommended as a follow-up ticket, not yet filed.

## Stories

| CAM-id | role | status |
|---|---|---|
| CAM-277 (T-1) | architect | Done — ADR-010 + `prisma/delivery/schema.prisma` (PR [#286](https://github.com/Thawatchai-Petkaew/campvibe/pull/286), merged) |
| CAM-278 (T-2) | backend-engineer | Done — tickets service + `/api/tickets` + `StatusIssue` read adapter (PR [#287](https://github.com/Thawatchai-Petkaew/campvibe/pull/287), merged) |
| CAM-279 (T-3) | backend-engineer | Done — `scripts/ticket-sync.mjs` CLI (PR [#288](https://github.com/Thawatchai-Petkaew/campvibe/pull/288), merged) |
| CAM-280 (T-4) | devops-release | Done — `scripts/import-linear.mjs` + `scripts/parity-check.mjs`, 223/223 parity verified (PR [#289](https://github.com/Thawatchai-Petkaew/campvibe/pull/289) + fix [#291](https://github.com/Thawatchai-Petkaew/campvibe/pull/291) + parity report [#292](https://github.com/Thawatchai-Petkaew/campvibe/pull/292), all merged) |
| CAM-281 (T-5a) | backend-engineer | Done — dual-mode write paths behind `TICKETS_SOURCE` (PR [#290](https://github.com/Thawatchai-Petkaew/campvibe/pull/290), merged) |
| CAM-281 (T-5b) | backend-engineer | Done — retired the Linear write/event-webhook path; the delivery service is the only writer (PR [#293](https://github.com/Thawatchai-Petkaew/campvibe/pull/293), merged) |
| CAM-282 (T-6) | product-owner | **In Progress (this story)** — conventions rewrite: every agent/skill/command/rule doc repointed at `ticket-sync.mjs`, `.claude/SYNC-ARCHITECTURE.md` rewritten, `lib/delivery/PORTABILITY.md` authored, `docs/delivery/self-hosted-delivery-tickets/` filled. No PR yet (not opened per this story's own git-hygiene instructions). |

G4-verified as of T-5b: the self-hosted system is the sole writer in production use; Linear is read-only
archive; `TICKETS_SOURCE=linear` and the deprecated `scripts/linear-sync.mjs` remain as one-cycle
rollback levers (see `.claude/SYNC-ARCHITECTURE.md` "Rollback levers").

## Links

`../feature.md` · Master-Plan item (`docs/project/master-plan.md`) · ADRs
(`docs/adr/ADR-010-self-hosted-delivery-tickets.md`) · architecture doc (`.claude/SYNC-ARCHITECTURE.md`) ·
portability manifest (`lib/delivery/PORTABILITY.md`) · parity evidence
(`docs/delivery/self-hosted-delivery-tickets/parity-report-2026-07-03.md`)

## Changelog

- v1 (2026-07-03) — epic scoped
- v2 (2026-07-03) — T-6 (CAM-282) rollup: added T-5a/T-5b/T-6 rows with real PR links, corrected T-4's
  status from "authored, not merged" to Done (3 merged PRs), filled Why/Scope out-of-scope with the
  SSE-pulse gap follow-up
