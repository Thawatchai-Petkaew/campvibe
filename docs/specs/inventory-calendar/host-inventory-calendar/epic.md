---
artifact: epic
feature: inventory-calendar
epic: host-inventory-calendar (CAM-22)
status: In Progress
version: v1
updated: 2026-06-24
---
# Host: inventory & calendar (CAM-22)

## Why

Hosts currently have no protection against concurrent overbooking: two simultaneous booking requests for the same campsite and date window can both succeed, requiring manual cancellation and guest apologies. This epic delivers atomic booking integrity and (in follow-on stories) host-facing blocked-dates and calendar management.

**KPI:** Race-condition overbooking count = 0 after CAM-57 deploys; `POST /api/bookings` p95 < 1000ms under 50 concurrent requests.

## Scope

- In: CAM-57 — atomic inventory lock via Serializable transaction + bounded retry (backend only, no UI)
- Out: blocked-dates UI / calendar views / PATCH booking lock → follow-on CAM-22 stories (backlog)

## Stories

<!-- markdownlint-disable MD060 -->
| CAM-id | Title | Role | Status |
|---|---|---|---|
| CAM-57 | Inventory lock กัน overbooking แบบ atomic | backend | In Progress (G3 merge) |
<!-- markdownlint-enable MD060 -->

## Links

`../feature.md` · Master-Plan item (`docs/project/master-plan.md`) · ADR: `docs/adr/ADR-006-booking-atomic-inventory-lock.md`

## Changelog

- v1 (2026-06-24) — epic scoped; CAM-57 atomic inventory lock added (G3 merge in progress)
