---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-398 — Bookings list works: click through to the booking detail and the image fills its frame

## Story

As a **Camper** on my bookings list, I want to open each booking's detail page and see its photo fill the card, so that I can review my bookings without dead-ends or broken-looking cards. Scope: `app/bookings/page.tsx` only. Depends on: — . Why: G4 findings — the list has NO link to `/bookings/[id]` (the only button goes to `/campgrounds/undefined`; pre-existing since the first commit) and the image column is pinned to `h-48` after CAM-194 dropped `md:h-auto` (bottom gap on desktop).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | อยู่ที่หน้ารายการการจอง | กดที่การ์ดการจอง หรือปุ่ม `ดูรายละเอียด` | ไปหน้ารายละเอียดการจองของรายการนั้น | นำทางไปหน้ารายละเอียดการจอง (ไม่ใช่หน้าแคมป์) | EC-1 |
| AC-2 | จอเดสก์ท็อป | เปิดหน้ารายการการจอง | รูปเต็มคอลัมน์ซ้ายของการ์ด ไม่มีช่องว่างใต้รูป | เลย์เอาต์มือถือไม่เปลี่ยน | EC-2 |

## Rules

- BR-1: card body + the `ดูรายละเอียด` button both navigate to `/bookings/{id}` (the orphaned detail route becomes reachable). The broken `/campgrounds/undefined` link is replaced.
- BR-2: image column stretches on desktop — `md:w-64 h-48 md:h-auto overflow-hidden relative` (drop `md:aspect-[4/3]`); `object-cover` absorbs aspect mismatch.

## Edge cases

- EC-1: IF the campground behind a booking was deleted THEN the booking detail page still opens (it renders from the booking record; no dependency on the campground slug).
- EC-2: IF the viewport is mobile THEN the stacked layout is unchanged (`h-48` still applies below `md`).

## Data

None (no API change; the `nameThSlug` select gap is out of scope).

## Seams & refs

`/bookings/[id]` route exists + healthy (CAM-61) · card JSX `app/bookings/page.tsx:124-242` · regression provenance `bb6d5d4` (CAM-194).

## Out of scope

A separate "ดูแคมป์" action (needs `nameThSlug` added to the GET /api/bookings select) — follow-up candidate under CAM-395.

## Self-verify

Source guards: href targets `/bookings/${...id}`, wrapper classes restored; suite/lint/typecheck green; owner-verify: click-through + no gap on staging.
