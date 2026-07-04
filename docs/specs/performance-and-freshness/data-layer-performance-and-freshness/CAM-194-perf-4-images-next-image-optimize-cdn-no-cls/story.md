---
linear: CAM-194
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# PERF-4 images → next/image (optimize + CDN, no CLS) (CAM-194)

## Why

รูปตอนนี้เสิร์ฟผ่าน `<img>` ดิบ (ไม่ optimize) → LCP 9.0s + unused/heavy assets (baseline). ย้ายเป็น `next/image` = ย่อขนาด+webp+responsive+lazy+CDN ในตัว → ลด LCP + แบนด์วิดท์. **KPI:** LCP detail/grid ดีขึ้น (วัด Lighthouse ก่อน-หลัง).

## Story

ในฐานะ platform ฉันต้องการ ให้รูปทุกที่เสิร์ฟผ่านตัวจัดการรูปที่ย่อขนาด/แปลง webp/lazy อัตโนมัติ เพื่อ หน้าโหลดไวขึ้นและประหยัดแบนด์วิดท์ โดยภาพไม่กระตุก (CLS). ขอบเขต: เปลี่ยน `ImageWithFallback` เป็น `next/image` + ตั้ง next.config images + ใส่ `sizes`/`priority` ต่อบริบท (~22 จุด/9 ไฟล์) + คง fallback + unoptimized สำหรับ preview.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | เปิดการ์ด/detail/แกลเลอรี | โหลดรูป | รูปแสดงครบเหมือนเดิม คมชัด ไม่แตก | เสิร์ฟผ่าน next/image (webp, ย่อขนาดตามจอ) |
| AC-2 | เปิดหน้า detail | โหลด | รูป hero ขึ้นไว ไม่กระตุก/ขยับ | hero = priority (LCP) · CLS คง 0 (มี dimension/aspect) |
| AC-3 | กำลังอัปโหลดรูป (ยังไม่บันทึก) | preview | รูป preview แสดงปกติ | `blob:`/`data:` ใช้ unoptimized (ไม่ส่งเข้า optimizer) |
| AC-4 | รูปเสีย/โหลดไม่ได้ | โหลด | เห็น placeholder เดิม (ไอคอน) | fallback onError ยังทำงาน |

## Rules

`next.config` images: `formats:['image/webp']` (ไม่เพิ่ม AVIF) · `qualities:[75]` · trim deviceSizes/imageSizes · `minimumCacheTTL` ~31วัน · remotePattern `*.public.blob.vercel-storage.com` (+คง unsplash) · `dangerouslyAllowSVG:false` · `sizes` ต่อบริบท (card grid / hero=priority / thumb ~80px / lightbox=ไม่ priority) · คง ImageWithFallback fallback + unoptimized escape · ตาม DESIGN.md (กัน CLS ด้วย dimension หรือ fill+aspect).

## Data

ไม่มี migration.

## Cost note

Vercel Image Optimization: **staging ฟรี** (Hobby 5K transf/เดือน) · prod ต้อง Pro + ตั้ง **Spend cap** (prod-prep, escalate ที่ G5) · config ประหยัดข้างบนคุมจำนวน transform.

## Out of scope

IMG-CDN-2 (CDN แยก R2/Cloudflare) — deferred · wishlist page select (story อื่น).

## Self-verify

[ ] lint [ ] typecheck [ ] test [ ] build [ ] design gate (token/CLS/a11y) [ ] verify รูปโหลด+ไม่ broken+LCP ดีขึ้นบน staging

## Links

Research Map §5/§11 PERF-4 · ADR-010 · Vercel pricing analysis · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
