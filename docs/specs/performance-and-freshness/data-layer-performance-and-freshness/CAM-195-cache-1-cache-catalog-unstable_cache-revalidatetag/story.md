---
linear: CAM-195
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# CACHE-1 cache catalog (unstable_cache + revalidateTag) + FRESH-1 wiring (CAM-195)

## Why

home เป็น `force-dynamic` → วัดแล้ว total 2.4–5.3s (query ใหม่ทุก request). cache catalog read + invalidate ตอน write → เปิดไว โดย **ใช้** `unstable_cache` **+** `revalidateTag` **(ไม่ใช่ PPR experimental** ที่เคยทำ staging ล่ม). **KPI:** TTFB home/detail ลดลง (วัด curl before/after — ship เฉพาะถ้าดีขึ้นจริง).

## Story

ในฐานะ platform ฉันต้องการ ให้หน้ารายการ/รายละเอียด cache แล้วขึ้นไว + อัปเดตเองภายในไม่กี่วินาทีตอนข้อมูลเปลี่ยน เพื่อ ผู้ใช้เปิดเว็บไว ไม่ต้อง query หนักทุกครั้ง. ขอบเขต: cache catalog reads (detail-by-slug + default listing) ด้วย unstable_cache+tags + ยิง revalidateTag ทุก write path + guard test. (รวม FRESH-1).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | เปิดหน้ารายการ/รายละเอียดซ้ำ | โหลด | ขึ้นไวกว่าเดิมชัด | อ่านจาก cache (ไม่ query DB ใหม่ทุกครั้ง); TTFB ลด (วัด before/after) |
| AC-2 | เผยแพร่/แก้/ลบ/รีวิวลาน | บันทึกสำเร็จ | หน้าอัปเดตภายในไม่กี่วินาที | revalidateTag ยิงหลัง commit ทุก write path |
| AC-3 | ปฏิทิน availability + หน้า host | โหลด | ข้อมูลสดเสมอ | ไม่ถูก cache (คง no-store/force-dynamic) |

## Rules

`unstable_cache` + tag scheme (`catalog` / `camp:<id>` / `camp:slug:<slug>`) — **ไม่ใช้ PPR/**`use cache` (experimental, defer) · `revalidateTag` หลัง commit สำเร็จ ทุก write: create/edit/publish/delete camp · review · upload · seed×3 · guard test fail ถ้า write path ลืม revalidate · `canViewCampSite` (session) + availability อยู่ **นอก** cache · ship เฉพาะถ้า TTFB ดีขึ้นจริง (ไม่ดีขึ้น = ไม่ ship, คง force-dynamic).

## Data

ไม่มี migration.

## Out of scope

PPR / `use cache` (experimental — defer จนกว่า Next stable + traffic จริง) · PERF-3 pagination.

## Self-verify

[ ] lint [ ] typecheck [ ] test (+ freshness guard) [ ] build [ ] วัด TTFB before/after บน staging (ship เฉพาะถ้าดีขึ้น) [ ] publish→ปรากฏในไม่กี่วินาที

## Links

Research Map §6 · ADR-012 · ต่อจาก SEC-1/MEAS-1 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
