---
linear: CAM-274
feature: image-resilience
epic: image-loading-resilience (CAM-132)
persona: camper
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-07-02
---
# IR-2 lightbox รูปหลักไม่แสดง (wrapper ยุบ 0 พิกเซล) + ใส่มุมโค้งรูป preview (CAM-274)

## Why

Owner รายงาน (พร้อม screenshot): กดรูปใน gallery หน้า detail (เช่น `/campgrounds/ban-rak-thai-mist-80-th` บน staging) lightbox เปิดแต่**รูปหลักไม่แสดง** เห็นแต่ตัวนับ ปุ่ม และ thumbnail ล่าง. ต้นเหตุ: หลัง migrate เป็น next/image ([CAM-194](https://linear.app/campvibe/issue/CAM-194/qa-engineer-perf-4-images-nextimage-optimize-cdn-no-cls)) รูปหลักใช้ `ImageWithFallback` โหมด fill แต่ wrapper ได้ class `max-w-full max-h-full` ซึ่งไม่มีขนาดจริง และลูกแบบ fill เป็น absolute ไม่ดันขนาด ทำให้ wrapper ยุบเหลือ 0x0 (thumbnail รอดเพราะปุ่มกำหนด `w-20 h-20`). Owner ขอเพิ่มมุมโค้งให้รูป preview ด้วย.

## Story

ในฐานะ camper ฉันต้องการกดรูปในแกลเลอรีแล้วเห็นรูปใหญ่ชัดเจน ขอบมุมโค้งสวยงาม เลื่อนซ้ายขวาได้ เพื่อดูบรรยากาศลานก่อนตัดสินใจจอง. (ขอบเขต: รูปหลักใน `components/ImageGallery.tsx` เท่านั้น; grid หน้า detail และ thumbnail เดิมคงพฤติกรรม)

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| 1 | ลานมีรูปหลายรูป | กดรูปใน gallery | รูปใหญ่แสดงเต็มกลางจอ (ย่อพอดีจอ ไม่ล้น ไม่บิดสัดส่วน) มุมโค้ง | รูปหลัก render ขนาดจริง ไม่ยุบ 0 |
| 2 | เปิด lightbox อยู่ | กดลูกศร/ปุ่มซ้ายขวา หรือกด thumbnail | รูปเปลี่ยนตามและแสดงทุกครั้ง | index เปลี่ยน รูป render |
| 3 | URL รูปเสีย | เปิดรูปนั้น | เห็น placeholder (พื้นเทา ไอคอนรูปเสีย) ไม่ใช่จอว่าง | fallback ของ ImageWithFallback ยังทำงาน |
| 4 | จอเล็ก (มือถือ) | เปิด lightbox | รูปพอดีจอ ไม่โดน crop มุมโค้งยังอยู่ | responsive constraint |

## Rules

* reuse `ImageWithFallback` เดิม (คง error fallback) ห้ามสร้าง viewer ใหม่.
* มุมโค้ง = `rounded-3xl` ตาม radius scale ของ DESIGN.md (สื่อ/รูป = การ์ดสเกลเดียวกัน) และต้องโค้งที่ขอบรูปจริง (ไม่ใช่กล่อง letterbox ที่มองไม่เห็น).
* ห้ามมีแผ่น `bg-muted` โผล่หลังรูปบน scrim ดำ.
* แก้แล้วต้องมี guard test กันถอยหลัง (source-inspection ตามสไตล์ test เดิมของ repo).

## Data

* ไม่มี migration.

## Out of scope

* zoom/pinch, swipe gesture, grid หน้า detail.

## Self-verify

* เปิด dev server ดูจริง: รูปหลักแสดง/เลื่อนได้/มุมโค้ง/รูปเสียเห็น placeholder · lint/typecheck/test/build เขียว · เช็คบน Vercel preview + staging.

## Links

* Epic [CAM-132](https://linear.app/campvibe/issue/CAM-132/image-loading-resilience) · regression จาก [CAM-194](https://linear.app/campvibe/issue/CAM-194/qa-engineer-perf-4-images-nextimage-optimize-cdn-no-cls) (PERF-4 next/image) · `components/ImageGallery.tsx` · `components/ui/image-with-fallback.tsx`
