---
artifact: feature
feature: inventory-calendar (Inventory & Calendar)
personas: [host]
status: active
version: v1
updated: 2026-06-24
---
# Inventory & Calendar

## Overview

Gives Hosts full control over campsite availability: prevents overbooking via atomic concurrent-safe booking logic, and (in follow-on epics) will expose blocked-dates management and calendar views. Serves the Host persona exclusively. Master-Plan: `docs/project/master-plan.md` — booking integrity pillar.

## Architecture overview

- Entities: `CampSite` (maxGuestsPerDay, maxTentsPerDay) · `Spot` (per-campsite bookable unit) · `Booking` (PENDING/CONFIRMED/CANCELLED) · `BlockedDate` (soft-delete, campsite or spot scope)
- API surface: `POST /api/bookings` (atomic booking create with Serializable isolation + bounded retry)
- ADRs: `docs/adr/ADR-006-booking-atomic-inventory-lock.md` (Serializable isolation vs advisory lock vs FOR UPDATE) · schema: `prisma/schema.prisma`

## Design overview

No new UI in the current epic scope (CAM-57 is backend-only). Error copy shown to Camper on 409 is rendered by the existing frontend booking flow — unchanged. Future stories may add calendar/blocked-dates UI per `DESIGN.md`.

## Epics & Stories

| Epic                                | CAM-id | Role    | Status                  |
|-------------------------------------|--------|---------|-------------------------|
| Host: inventory & calendar (CAM-22) | CAM-57 | backend | In Progress (G3 merge)  |

## Key decisions

- Serializable isolation (not advisory lock or FOR UPDATE) chosen for pgBouncer compatibility and zero raw SQL — see ADR-006.
- No migration for CAM-57: purely application-code change.

## Changelog

- v1 (2026-06-24) — feature scaffolded; CAM-57 atomic inventory lock in progress
