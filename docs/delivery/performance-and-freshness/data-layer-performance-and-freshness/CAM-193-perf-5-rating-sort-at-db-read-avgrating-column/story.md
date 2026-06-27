---
linear: CAM-193
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# PERF-5 rating sort at DB + read avgRating column (CAM-193)

## Why

sort rating ยังทำใน JS (`sortByRating` + `.slice(0,40)`) → เพดาน ~200 ลาน · และ listing ยัง fetch `reviews` ทุกลานเพื่อคำนวณดาว (over-fetch ที่เหลือจาก PERF-1). AGG-1 ให้คอลัมน์ `avgRating`/`reviewCount` แล้ว → sort + แสดงจากคอลัมน์ได้เลย. **KPI:** ปลดเพดาน ~200 ลาน + payload listing เล็กลงอีก (ตัด reviews).

## Story

ในฐานะ platform ฉันต้องการ ให้รายการลาน เรียงและแสดงคะแนนจากคอลัมน์ที่เก็บไว้ (ไม่ลากรีวิวมานับใหม่) เพื่อ รองรับลานไม่จำกัดและโหลดเบาลงอีก. ขอบเขต: เรียง rating ที่ฐานข้อมูล + อ่าน avgRating/reviewCount จากคอลัมน์ + ตัด reviews ออกจาก campCardSelect + เพิ่ม index avgRating.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | มีลานเผยแพร่เกิน 200 | เปิดรายการเรียงตามคะแนน | เรียงตามดาวเหมือนเดิม (ไม่มีเพดาน) | query `orderBy avgRating desc nulls last` ที่ DB; ไม่มี JS sort/slice |
| AC-2 | การ์ดแสดงดาว+จำนวนรีวิว | โหลดรายการ | ดาวและจำนวนรีวิวเหมือนเดิม | อ่านจากคอลัมน์ avgRating/reviewCount; ไม่ fetch reviews |
| AC-3 | เรียกรายการลาน | โหลด | รายการเหมือนเดิม (ข้อมูลเล็กลงอีก) | campCardSelect ไม่มี reviews แล้ว |

## Rules

`orderBy: { avgRating: { sort: 'desc', nulls: 'last' } }` + take เดิม · อ่าน avgRating/reviewCount จากคอลัมน์ · ลบ `reviews` ออกจาก `campCardSelect` · เลิกใช้ `sortByRating` ใน listing (คง helper ไว้ถ้า detail ใช้) · เพิ่ม `@@index([isPublished, deletedAt, avgRating, id])` (index ที่ PERF-2 เลื่อนไว้).

## Data

migration: + `@@index([isPublished, deletedAt, avgRating, id])` (additive, reversible). ไม่มีคอลัมน์ใหม่ (avgRating มาจาก AGG-1 แล้ว).

## Out of scope

CACHE-1 (force-dynamic) · keyset pagination (PERF-3 — ยังใช้ take 40 เดิม).

## Self-verify

[ ] lint [ ] typecheck [ ] test (orderBy avgRating, ไม่มี reviews ใน select) [ ] build [ ] verify payload เล็กลงอีก + เรียงถูกบน staging

## Links

Research Map §11 PERF-5 · ต่อจาก AGG-1 ([CAM-189](https://linear.app/campvibe/issue/CAM-189/devops-release-agg-1-maintained-avgrating-reviewcount)) + PERF-1 ([CAM-192](https://linear.app/campvibe/issue/CAM-192/devops-release-perf-1-list-buffet-campcardselect-cut-listing-over)) · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
