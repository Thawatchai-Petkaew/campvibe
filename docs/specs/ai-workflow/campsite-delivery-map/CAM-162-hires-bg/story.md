# CAM-162 — Hi-res responsive background for /status/map

version: 1.0
date: 2026-06-24

## Why

The `/status/map` page uses a full-bleed forest background. The previous single 2000×1125 WebP upscales ~2x on 4K displays and looks blurry. This story serves the right resolution per device using a responsive `srcset`.

## Story

ในฐานะเจ้าของที่ดูแผนที่ /status/map บนหน้าจอ 4K ฉันต้องการเห็นพื้นหลังป่าไม้คมชัด เพื่อให้แดชบอร์ดดูเป็นมืออาชีพบนทุกหน้าจอ ขอบเขต: เฉพาะรูปพื้นหลัง `.map-bg` เท่านั้น ไม่รวม sprite ตัวละคร

## AC

| Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|
| หน้าจอ 1280px | โหลด /status/map | พื้นหลังโหลดจาก forest-1280.webp (48 KB) | srcset 1280w ถูกเลือก |
| หน้าจอ 1920px | โหลด /status/map | พื้นหลังโหลดจาก forest-1920.webp (96 KB) | srcset 1920w ถูกเลือก |
| หน้าจอ 2560px | โหลด /status/map | พื้นหลังโหลดจาก forest-2560.webp (153 KB) | srcset 2560w ถูกเลือก |
| หน้าจอ 4K (3840px) | โหลด /status/map | พื้นหลังโหลดจาก forest-3840.webp (272 KB) | srcset 3840w ถูกเลือก — ไม่มี blur |

## Rules

- ต้นฉบับ PNG ขนาด 4000×2250 — ไม่มีการ upscale ใดๆ
- WebP quality 80 — สมดุลระหว่างความคมชัดและขนาดไฟล์
- `fetchpriority="high"` เพื่อให้ browser ดาวน์โหลดก่อน (LCP candidate)
- `sizes="max(100vw, 177.78vh)"` รองรับ portrait screen ด้วย
- AVIF ไม่ได้ใช้ — WebP sizes ต่ำพอ ไม่คุ้มกับความซับซ้อนของ `<picture>`

## Out of scope

- AVIF format
- sprite ตัวละคร
- การเปลี่ยน logic ของ canvas หรือ overlay
