---
artifact: epic
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
status: In Progress
version: v2
updated: 2026-06-22
---
# Camper: post-trip & review (CAM-35)

## Why
ให้ camper หลังทริปมีส่วนร่วมต่อ — เขียนรีวิว + บันทึกแคมป์ที่ถูกใจ → กลับมาจองซ้ำ ลดการหลุดออกจาก funnel · **KPI:** wishlist→booking conversion · % camper ที่รีวิว/บันทึก ≥1 ครั้ง · อ้าง PRODUCT-PLAN C-6 (post-trip & re-engage).

## Scope
- In: รีวิว (C-6.1 เขียนรีวิว, C-6.2 verified-stay) · **Wishlist บนหน้า detail (C-6.4 → CAM-127)** + แสดงสถานะ "บันทึกแล้ว"
- Out: collections / แชร์ wishlist (C-6.5) · LINE login (C-6.6) · loyalty/points (C-6.7) → epic/ticket ภายหลัง

## Stories
| CAM-id | เรื่อง | role (ปัจจุบัน) | status |
|---|---|---|---|
| [CAM-127](https://linear.app/campvibe/issue/CAM-127) | Wishlist toggle บนหน้า Campground Detail | devops-release | **Done** (staging, ready-for-prod) |
| [CAM-128](https://linear.app/campvibe/issue/CAM-128) | จำกัด field operator กัน PII รั่ว (จาก security gate) | backend | **Done** |
| [CAM-131](https://linear.app/campvibe/issue/CAM-131) | rate-limit /api/wishlist → 429 | backend | Backlog |
| — | C-6.1/6.2 รีวิว + verified-stay | — | บางส่วนมีแล้ว / backlog |

## Links
[`../feature.md`](../feature.md) · Master-Plan (`docs/project/master-plan.md`) · product-plan C-6 · ADRs: —

## Changelog
- v2 (2026-06-22) — เติม why/scope + stories rollup (CAM-127/128/131); เดิมเป็น scaffold stub ที่ยังไม่เติม (gap จากการรัน workflow CAM-127)
- v1 (2026-06-22) — epic scoped (scaffold)
