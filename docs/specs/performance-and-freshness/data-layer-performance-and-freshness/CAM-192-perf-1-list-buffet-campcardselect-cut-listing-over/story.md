---
linear: CAM-192
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# PERF-1 List Buffet — campCardSelect (cut listing over-fetch) (CAM-192)

## Why

Baseline วัดจริง: `/api/campsites` payload = **902 KB** (140 ลาน) เพราะ listing ดึง `spots` + `options` + รูปทั้งหมด + relation เกิน ต่อทุกลาน ทั้งที่การ์ดใช้แค่ ชื่อ/ราคา/ดาว/รูป/ที่ตั้ง. ตัด over-fetch → payload เล็กลงมาก + ช่วย LCP. **KPI:** `/api/campsites` payload ลดลงชัด (เทียบ baseline 902 KB).

## Story

ในฐานะ platform ฉันต้องการ ให้ query รายการลานดึงเฉพาะข้อมูลที่การ์ดใช้จริง เพื่อ หน้ารายการโหลดเบาและไว. ขอบเขต: สร้าง read-model `campCardSelect` ใช้ร่วมกัน (home + 2 API routes) ตัดข้อมูลส่วนเกิน. ไม่แตะวิธีคิดคะแนนเฉลี่ย (คงจาก reviews เดิม — AGG-1 จะปรับทีหลัง).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | มีลานเผยแพร่หลายร้อย | เปิดหน้ารายการ | การ์ดแสดงครบเหมือนเดิม (ชื่อ ราคา ดาว รูปเลื่อนได้ ที่ตั้ง) | query เลือกเฉพาะ field การ์ด ไม่ดึง spots/options/relation เกิน |
| AC-2 | เรียกรายการลาน | โหลดข้อมูล | รายการขึ้นเหมือนเดิม (ขนาดข้อมูลเล็กลงมาก วัดเทียบ baseline) | payload `/api/campsites` ลดลงชัดจาก 902 KB |
| AC-3 | ค้นหาด้วยคำค้น | พิมพ์ชื่อเจ้าของ/ลาน | ผลค้นหายังตรงเหมือนเดิม | keyword filter ยังทำงาน (ชื่อเจ้าของอยู่ใน where ไม่ใช่ select) |

## Rules

`campCardSelect` ที่ `lib/read-models/camp-card.ts` ใช้ Prisma `select` (ไม่ใช่ include) · รูป `take` เท่าที่ carousel ใช้ (≤5) · ไม่ดึง `spots`/`options`/operator เกินชื่อ/location เกิน province · home + `/api/campsites` + `/api/campgrounds` ใช้ตัวเดียวกัน · คะแนนเฉลี่ยคงคำนวณจาก reviews-rating เดิม (ยังไม่ใช้คอลัมน์ denormalized).

## Data

ไม่มี migration (เปลี่ยน select เท่านั้น).

## Out of scope

AGG-1 (คอลัมน์ avgRating/reviewCount + ตัด reviews ออกหมด) · keyset pagination (PERF-3) · next/image (PERF-4).

## Self-verify

[ ] lint [ ] typecheck [ ] test (assert select shape ไม่มี spots/options) [ ] build [ ] verify payload ลดลงบน staging (เทียบ baseline 902 KB)

## Links

Research Map §4 · baseline.md (902 KB) · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness) · ADR-009
