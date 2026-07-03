---
artifact: feature
feature: self-hosted-delivery-tickets (Self-hosted Delivery Tickets)
personas: [platform]
status: active
version: v2
updated: 2026-07-03
---
# Self-hosted Delivery Tickets

## Overview

The AI-delivery pipeline used to track every epic/story/gate as a Linear issue (team `CAM`). Linear's
free tier caps at 275 issues and the pipeline hit that cap pre-launch, with no revenue to justify a
paid plan (`docs/context/non-negotiables.md`: no monetary cost without asking). Beyond the cap, Linear's
own workflow states are generic — everything pipeline-specific (gate-wait, role attribution, regression
count, epic grouping) was bolted on as labels/title-string conventions enforced by nothing, and
`/status` freshness depended on a third-party webhook's delivery latency.

This feature replaces Linear as the tracker with a self-hosted delivery-ticket system: its own Prisma
schema + Postgres database (`prisma/delivery/`, `DELIVERY_DATABASE_URL`), a real guarded state machine
with an append-only `TicketEvent` audit ledger (`lib/delivery/tickets.ts`), a CLI (`scripts/ticket-sync.mjs`)
that replaces the old `linear-sync.mjs` for every AI-team convention, and the same public `/status`
dashboard now reading the new store instead of Linear. Serves the **platform** persona — this is
internal AI-delivery tooling, not a customer-facing CampVibe feature. ↑ Master-Plan:
`docs/project/master-plan.md` (AI Delivery Team tooling) · product-plan item: N/A (internal tooling,
not a product-plan line item per the discovery.md "tooling doesn't need a card" convention — though this
epic itself was carded because it is genuinely deliverable, gated work, not a quick doc/config change).

## Architecture overview

- **Entities** (atomic, `prisma/delivery/schema.prisma`): `Ticket` (identifier `CAM-###`, `type` EPIC/STORY/TASK,
  `state` the 6-value guarded machine, `currentRole`/`roleHistory`, `epicId` self-relation FK, `persona`,
  `featureName`, `gateRaisedAt`/`changesRequested`/`regressionRound`, `blocked`/`archivedAt`, `releasedAt`,
  `legacyUrl`/`legacyLabels` for the Linear-import safety net) · `TicketEvent` (append-only audit ledger:
  `kind`/`fromValue`/`toValue`/`actor`/`note`) · `TicketComment` · `DeliveryPulse` (singleton row, bumped
  in-process on every mutation, keys the dashboard's 60s cache).
- **API surface**: `GET/POST /api/tickets`, `GET/PATCH /api/tickets/[id]` (the 9-verb + 2-toggle +
  `updateFields` dispatch), `POST /api/tickets/[id]/comments`. All gated by the shared `STATUS_TOKEN`
  (`lib/status-auth.ts`) — no NextAuth session (this is an internal ops surface, not a customer one).
- **ADRs**: `docs/adr/ADR-010-self-hosted-delivery-tickets.md` (schema + state machine + module boundary,
  the decision this whole feature implements) · schema: `prisma/delivery/schema.prisma` (own file, own
  migration history, strictly separate from the product's `prisma/schema.prisma`).

## Design overview

No new UI was designed for this feature — the existing `/status` dashboard (`app/status/page.tsx` +
`dashboard-client.tsx`) and `/status/map` animated board are reused unmodified; only their data source
changed (`lib/delivery/status-adapter.ts` reproduces the legacy `StatusIssue` shape byte-for-byte, so
`lib/status-model.ts`/`lib/status-derive.ts`/`campsite-scene.tsx` needed zero changes). Telegram
notification copy (`lib/notify-messages.ts`) and the Approve/Reject tap UX are unchanged from the
Linear era — only the trigger moved from a webhook to an in-process call inside the mutation service.

## Epics & Stories

- **Self-hosted Delivery Tickets (CAM-276)** — the only epic under this feature. T-1 through T-6, all
  merged except T-6 (this story, in progress). See `epic.md` for the full story rollup + PR links.

## Key decisions

- **ADR-010** (`docs/adr/ADR-010-self-hosted-delivery-tickets.md`) — own schema/database (not shared
  tables in the product schema, not a separate repo), a real 9-verb state machine + audit ledger
  (replacing label/title-string conventions), `TICKETS_SOURCE` env flag as the rollback lever between
  the Linear-sourced read path and the new delivery-DB read path.
- **No webhook** — every mutation (state change, comment, handoff) goes through one service module
  (`lib/delivery/tickets.ts`) that writes the DB row and audit event, bumps the pulse, notifies Telegram,
  and (on `approve` only) fires the `repository_dispatch`, all in the same request. Closes the freshness
  gap the old Linear-webhook-relayed pulse had.
- **Legacy Linear kept as read-only archive** — the 275 pre-migration issues live in Linear untouched
  (via `scripts/import-linear.mjs`, T-4) for history; the Linear MCP server (`.mcp.json`) stays wired
  but is convention-documented as archive-read-only (`.claude/commands/camper.md`), never a write path.
- **A verified, currently-open gap** (found authoring T-6's `.claude/SYNC-ARCHITECTURE.md`): the `/status`
  SSE auto-refresh (`app/api/status/stream/route.ts`) still watches the legacy product-DB `StatusPulse`,
  not the new `DeliveryPulse` — an open dashboard tab won't auto-push on a new-style ticket mutation yet.
  List-read freshness itself is unaffected (pulse-keyed cache). Flagged as a follow-up, not silently
  left undocumented.

## Changelog

- v1 (2026-07-03) — feature created (scaffold)
- v2 (2026-07-03) — filled by product-owner at T-6 (CAM-282): overview, architecture, design, epic
  rollup, key decisions incl. the SSE-pulse gap discovered while writing `.claude/SYNC-ARCHITECTURE.md`
