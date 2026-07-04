# CAM-158 — เพิ่มรูป background ฉากป่าแคมป์

> Follow-on enhancement to epic [CAM-150](../feature.md). Status SoT = Linear CAM-158.

## Why
พื้นหลัง `/status/map` เป็น CSS gradient ล้วน. เจ้าของวางรูปฉากป่า (`design/campsite-forest.png`) ไว้แต่ยังไม่แสดง. งานนี้ optimize + เก็บรูปใน `/public` แล้ว wire เป็นพื้นหลัง.

## Story
ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นรูปฉากป่าเป็นพื้นหลังของแผนที่แคมป์** เพื่อ **บรรยากาศตรงกับ mockup**.

## AC
| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | มี token | เปิด `/status/map` | รูปฉากป่าเป็นพื้นหลังเต็มจอ (cover) ตัวละคร/overlay ยังอ่านได้ | โหลดจาก `/public/status-map/` |
| 2 | โหลดหน้า | ดู network | รูป background < 200KB | WebP |
| 3 | ข้อความบนแผง | ดู | คอนทราสต์พอ (มี gradient overlay) | overlay ทับรูป |

## Rules
- ต้นฉบับ PNG (9.6MB, 4000×2250) เก็บไว้ใน `design/` เป็น source (ไม่ commit); deliverable = WebP ใน `/public`.
