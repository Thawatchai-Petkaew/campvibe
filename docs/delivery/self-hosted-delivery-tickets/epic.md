---
artifact: epic
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
status: Backlog
version: v1
updated: 2026-07-03
---
# Self-hosted Delivery Tickets (CAM-276)

## Why
<business value, 1–2 lines> · **KPI:** <how we know it worked>

## Scope
- In: <what this epic delivers>
- Out: <deferred> → <follow-up epic/ticket>

## Stories
| CAM-id | role | status |
|---|---|---|
| CAM-277 (T-1) | architect | Done — ADR-010 + `prisma/delivery/schema.prisma` |
| CAM-278 (T-2) | backend-engineer | merged staging (PR #287) — tickets service + `/api/tickets` + read adapter |
| CAM-279 (T-3) | backend-engineer | merged staging (PR #288) — `scripts/ticket-sync.mjs` CLI |
| CAM-280 (T-4) | devops-release | authored, not merged — `scripts/import-linear.mjs` + `scripts/parity-check.mjs` (this story) |

## Links
`../feature.md` · Master-Plan item (`docs/project/master-plan.md`) · ADRs (`docs/adr/ADR-010-self-hosted-delivery-tickets.md`)

## Changelog
- v1 (2026-07-03) — epic scoped
