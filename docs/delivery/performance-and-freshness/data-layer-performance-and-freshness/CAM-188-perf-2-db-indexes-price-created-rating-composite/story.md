---
linear: CAM-188
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# PERF-2 DB indexes (price / created / rating composite) (CAM-188)

## Why

sort/filter catalog ตอนนี้ไม่มี index บน priceLow/createdAt → scan เมื่อข้อมูลโต. เริ่มได้เลย (ไม่ติด MEAS-1).

## Story

ในฐานะ platform ฉันต้องการ index ที่ตรงกับ sort/filter ของ catalog เพื่อ query ไม่ scan ทั้งตารางเมื่อลานเยอะ. ขอบเขต: เพิ่ม composite index (migration additive).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | catalog เรียงตามราคา/ใหม่สุด | เปิด listing | รายการขึ้นเหมือนเดิม (เร็วขึ้น วัดที่ MEAS-1) | query ใช้ index ไม่ใช่การสแกนทั้งตาราง (ยืนยันด้วยแผน query) |

## Rules

composite นำด้วยตัวกรองหลัก `[isPublished, deletedAt, <sortkey>, id]` · migration reversible · index avgRating รอหลัง AGG-1.

## Data

`@@index` ใหม่บน CampSite: priceLow, createdAt (+ avgRating หลัง AGG-1). reversible.

## Out of scope

ไม่แก้ query shape (= PERF-1) · index avgRating (รอ AGG-1).

## Self-verify

[ ] lint [ ] typecheck [ ] migrate reversible [ ] EXPLAIN ยืนยัน index hit

## Links

Research Map §11 PERF-2 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
