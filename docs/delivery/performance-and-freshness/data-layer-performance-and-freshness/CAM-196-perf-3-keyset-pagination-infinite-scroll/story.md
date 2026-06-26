---
linear: CAM-196
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# PERF-3 keyset pagination + infinite scroll (CAM-196)

## Why

listing `take:40` → เห็นแค่ 40 จาก 140 ลาน (อีก 100 เข้าไม่ถึง — ไม่มี pagination). keyset cursor + infinite scroll → เลื่อนดูครบ + รองรับ catalog โตไม่จำกัด (keyset ไม่ใช่ offset → O(log n) ไม่ drift). **KPI:** ผู้ใช้ดูลานได้ครบทุกตัว.

## Story

ในฐานะ camper ฉันต้องการ เลื่อนดูรายการลานต่อไปเรื่อยๆ จนครบ เพื่อ ไม่พลาดลานที่อยู่ถัดจาก 40 อันแรก. ขอบเขต: keyset cursor pagination (API + listing) + infinite scroll UI (โหลดอัตโนมัติเมื่อเลื่อนถึงท้าย).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | มีลานเกิน 1 หน้า | เลื่อนลงจนถึงท้ายรายการ | ลานชุดถัดไปโหลดต่อเองอัตโนมัติ (ไม่มีปุ่ม) | API คืน `{items, nextCursor}` แบบ keyset (ไม่ใช่ offset) |
| AC-2 | เลื่อนจนถึงลานสุดท้าย | ถึงท้ายสุด | เห็นข้อความว่าครบแล้ว (ไม่โหลดเพิ่ม) | nextCursor = null |
| AC-3 | เปลี่ยนการเรียง/ตัวกรอง | เลือกใหม่ | รายการเริ่มใหม่จากบนสุด | cursor รีเซ็ตตาม sort key ใหม่ |
| AC-4 | กำลังโหลดชุดถัดไป | เลื่อน | เห็นตัวบ่งชี้กำลังโหลด | — |

## Rules

keyset cursor = encode `(sortKey, id)` + tuple WHERE (ไม่ใช้ offset/Prisma `cursor` กับคอลัมน์ไม่ unique) · per sort key: createdAt / priceLow / avgRating + id tiebreaker (ใช้ index จาก PERF-2) · `nextCursor=null` เมื่อหมด · ต่อกับหน้าแรกที่ cache (CACHE-1) + ทำงานทุก sort/filter · infinite scroll = IntersectionObserver + append + loading/end states ตาม DESIGN.md · a11y (ประกาศสถานะโหลด, ไม่ดักคีย์บอร์ด, มี fallback ถ้า JS ปิด — SSR หน้าแรก) · ไม่กระทบ SEC-1 (buildCampSiteWhere คงเดิม).

## Data

ไม่มี migration (index keyset มาจาก PERF-2 แล้ว).

## Out of scope

numbered pages / load-more button (เลือก infinite scroll) · search engine (SEARCH-1).

## Self-verify

[ ] lint [ ] typecheck [ ] test (cursor keyset + nextCursor null + sort reset) [ ] build [ ] design gate [ ] verify เลื่อนดูครบ 140 ลานบน staging

## Links

Research Map §4 (A2 keyset) · ADR-011 · ต่อจาก PERF-2/PERF-5/CACHE-1 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
