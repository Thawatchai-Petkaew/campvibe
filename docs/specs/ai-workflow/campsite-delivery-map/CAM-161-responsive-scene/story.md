# CAM-161 — Responsive scene: fixed-canvas scale + 2-layout switch

> Story A of the CAM-150 follow-up plan. Fixes character/map proportionality and makes all 8
> characters visible on every screen (4K/2K/1920/portrait). Status SoT = Linear CAM-161.

## Why

Staging screenshots showed two interrelated problems:
1. Character SIZE was `clamp(88px,7.2vw,116px)` (viewport-relative) but character POSITION was `%`
   of `.map-stage` (a separately-sized element) — on portrait screens the stage zoomed large while
   characters stayed small, producing a mismatch.
2. `NODES`/`YOU_POS` were abstract compass-point coordinates never measured against the actual art
   — "You" floated somewhere unrelated to the dock in the image.
3. On non-16:9 screens, characters near the edges of the old `max(vw, vh*ar)*zoom` stage became
   partially or fully invisible.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นตัวละครครบ 8 คนในแผนที่แคมป์ทุกขนาดจอ และตัวละครสมส่วนกับแมพ** เพื่อ **บรรยากาศ delivery map ที่ดูดีและสื่อสารสถานะได้ครบทั้งบน 4K, 1920, แท็บเล็ต และมือถือแนวตั้ง**

**ขอบเขต:** เฉพาะ campsite-scene.tsx, campsite-engine.ts; ไม่แตะ HUD dock/overlays/modal/SSE/token/design system.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|---|
| 1 | จอ 16:9 (1920/2K/4K) | เปิด `/status/map` | ตัวละครครบ 8 คน สมส่วนกับแมพ อยู่ตรงจุด art | `LAYOUT_WIDE` ใช้งาน; `.map-stage` เป็น 1920×1080 scaled canvas |
| 2 | จอ portrait/แนวตั้ง (9:16 มือถือ หรือ 3:4 แท็บเล็ต) | เปิดหน้า หรือหมุนจอ | ตัวละครครบ 8 คนอยู่ในกลางจอ ไม่มีใครหลุดนอกจอ | `LAYOUT_NARROW` สลับโดยอัตโนมัติ ไม่มี remount |
| 3 | เปลี่ยน aspect ratio (rotate/resize) | ขณะมองหน้า | ตัวละครย้ายตำแหน่งเป็น layout ใหม่ ไม่มีหน้าหายหรือ flash | engine.setHomes() เรียก; rAF loop ไม่ถูก teardown |
| 4 | `prefers-reduced-motion: reduce` | เปิดหน้า | ตัวละครนิ่งอยู่ที่ตำแหน่ง layout ที่ถูกต้อง | DOM positions set โดย reduced-motion path ใน useEffect |
| 5 | ทุกจอ | ดูหน้า | HUD dock, ViewToggle, overlays เห็นเต็มเสมอ ไม่สเกล/clip | HUD เป็น `position:fixed` sibling นอก `.map-viewport` |

## Out of scope

- Hi-res responsive background (`srcset` สำหรับ 4K/mobile) — Story B (CAM-162)
- ค่าพิกัดที่แน่นอนของแต่ละตัวละครต้องยืนยันโดยเจ้าของผ่าน screenshot จริงบน staging
- ไม่แตะ animation engine loop logic, SSE reconcile, HUD dock, panels, modal
- ไม่เปลี่ยน token/design system
