---
artifact: feature
feature: reviews-reputation (Reviews & Reputation)
personas: [camper, host]
status: active
version: v2
updated: 2026-06-22
---
# Reviews & Reputation

## Overview
ฟีเจอร์กลุ่ม "ความน่าเชื่อถือ + การมีส่วนร่วมหลังทริป" — รีวิวที่ผูกการเข้าพักจริง (verified-stay), คะแนน/ชื่อเสียงของแคมป์, และ Wishlist (บันทึกแคมป์ที่ถูกใจ → กลับมาจอง). ผู้ใช้: **camper** (เขียนรีวิว/บันทึกแคมป์) + **host** (เห็นรีวิว/ชื่อเสียง). ↑ Master-Plan: `docs/project/master-plan.md` (pillar Trust & safety + core loop "กลับมาจอง") · product-plan: C-6 (post-trip & re-engage).
> หมายเหตุ: Wishlist อยู่ใต้ project นี้ตามประวัติ (epic CAM-18) — เป็น feature grouping เดิม ไม่ใช่ feature "Wishlist" แยกต่างหาก.

## Architecture overview
- Entities: `Review` (ผูก `Booking` verified-stay) · `Wishlist { userId→User, campSiteId→CampSite, @@unique([userId,campSiteId]) }` · `CampSite` · `Booking`. ลิงก์ด้วย ID.
- API surface: `/api/reviews` (สร้าง/แสดง + verified-stay) · `/api/wishlist` (POST/GET/DELETE + `/ids`) — ownership-scoped (`session.user.id`), zod-validated.
- Aggregates (rating average ฯลฯ) = compute-on-the-fly จาก `Review` (cache ไม่ใช่ source).
- ADRs: — · schema: `prisma/schema.prisma`

## Design overview
- Core flows: เขียนรีวิวหลังเข้าพัก · กดหัวใจบันทึกแคมป์ (บนการ์ด + **หน้า detail** + หน้า `/wishlist`).
- Shared components: `CampgroundCard` heart (optimistic toggle) · `LoginModal` (guest → prompt-login) · `Button`/`Heart` (lucide). Tokens → `DESIGN.md` (teal `--primary` fill-current เมื่อบันทึก). Toggle logic ใช้ร่วม: `lib/wishlist-toggle.ts`.

## Epics & Stories
| Epic | Stories | สถานะ |
|---|---|---|
| Wishlist (legacy, CAM-18) | CAM-5..11 — model / API / card-heart / หน้า /wishlist | **released** |
| [Camper: post-trip & review (CAM-35)](camper-post-trip-review/epic.md) | **CAM-127** wishlist toggle บนหน้า detail | **Done** (staging) |
| ↳ follow-ups | CAM-128 จำกัด operator fields (PII) · CAM-131 rate-limit /api/wishlist | CAM-128 Done · CAM-131 Backlog |

## Key decisions
- Wishlist = single list (ไม่มี collection) · guest กด → prompt login (identity-binding ดัน sign-up).
- รีวิวต้องผูกการเข้าพักจริง (verified-stay) — กันรีวิวปลอม (pillar Trust > growth).

## Changelog
- v2 (2026-06-22) — เติม overview + architecture/design + epic rollup (CAM-127); เดิมเป็น scaffold stub ที่ยังไม่เติม (gap จากการรัน workflow CAM-127)
- v1 (2026-06-22) — feature created (scaffold)
