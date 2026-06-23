---
artifact: epic
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
status: In Progress
version: v3
updated: 2026-06-23
---

# Camper: pre-trip & my bookings (CAM-24)

## Why

A Camper needs to understand and track their bookings after they reserve — the current list page shows raw English enum strings (PENDING/CONFIRMED/CANCELLED/COMPLETED) which Thai users cannot quickly read, and the booking detail page (`/bookings/[id]`) does not yet exist. Fixing the status labels (CAM-60) removes a daily confusion point and lowers support traffic; the detail page (CAM-61) completes the pre-trip self-service flow.

**KPI:** support contacts about "ไม่รู้ว่าการจองอยู่ในสถานะอะไร" drop to near-zero after CAM-60; i18n audit passes all 4 status values in both `th`/`en`; Camper can access full booking detail without contacting support (CAM-61).

## Scope

- In:
  - **CAM-60** — localize booking status badges on `/bookings` (4 statuses, TH/EN, token-only colors). Done.
  - **CAM-61** — booking detail page `/bookings/[id]` (summary, status, camp info, dates). Planned — will reuse `getBookingStatusMeta` from CAM-60.
- Out:
  - Status labels on Host dashboard (`/dashboard/bookings`) → H-4.x
  - Adding new status values (e.g. NO_SHOW) → H-4.5
  - Payment receipts / invoice download → deferred (after payment model)

## Stories

| CAM-id | Title | Role | Status |
| --- | --- | --- | --- |
| CAM-60 | Status label การจองแปลเป็นภาษาไทย | Frontend (Camper) | Done |
| CAM-61 | Booking detail page `/bookings/[id]` | ux-designer → backend → frontend → qa → security → devops | In Progress |

## Links

`../feature.md` · Master-Plan item: `docs/project/master-plan.md` (C-5 My Bookings) · Product plan: `docs/project/product-plan.md`

## Changelog

- v3 (2026-06-23) — CAM-61 row updated: role pipeline (ux-designer → backend → frontend → qa → security → devops), status In Progress (G3 merge in flight).
- v2 (2026-06-23) — filled stub; CAM-60 Done; CAM-61 added to scope table; Why/KPI/Scope authored.
- v1 (2026-06-23) — epic scoped (stub)
