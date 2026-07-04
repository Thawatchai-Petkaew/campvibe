# CAM-160 — Visual fix: remove overlay + scale forest bg on all screens

> Follow-on visual fix for [CAM-158](../CAM-158-forest-background/story.md) (forest background added)
> and [CAM-159](../CAM-159-hud-redesign/story.md) (HUD redesign). Status SoT = Linear CAM-160.

## Why

The staging screenshot showed two problems: (1) a dark gradient overlay was washing out the
forest image, and (2) on non-16:9 screens (2k/4k and portrait) the background and characters
scaled independently, causing misalignment and no zoom-in effect.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นรูปฉากป่าชัดเจน ไม่มี overlay มืด และ scale ได้ทุกขนาดจอ** เพื่อ **บรรยากาศ campsite ที่ดูดีทั้งบน 4k, 2k, 1920 และมือถือแนวตั้ง**

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|---|
| 1 | เปิด `/status/map` | โหลดหน้า | รูปฉากป่าคมชัด ไม่มี gradient overlay มืดทับ | `linear-gradient` + `.map-aurora` + `.map-stars` ถูกลบออก |
| 2 | จอ 16:9 (1920/2k/4k) | ดูหน้า | รูป cover เต็มจอ zoom in เล็กน้อย ตัวละครอยู่ตรงตำแหน่ง | `.map-stage` เป็น source เดียวของ background + character positions |
| 3 | จอ portrait (มือถือ/tablet) | หมุนหรือเปิดบน portrait | ส่วนกลางของรูปป่ายังมองเห็นได้ ตัวละครไม่หลุดออกนอกกรอบ | width=100vh×ar×zoom ล้นข้างแต่ centre ยังอยู่กลางจอ |

## Out of scope

- ไม่แตะ animation engine, HUD dock, panel, modal, SSE realtime
- ไม่เปลี่ยน token/design system
- ค่า zoom (1.12) ยังต้องยืนยันโดยเจ้าของผ่าน screenshot บน staging
