## Story

ในฐานะ owner ฉันต้องการให้ตัวละคร 7 บทบาทยืนเป็นวงแหวนบนลานดินตรงกลางรอบกองไฟ เพื่อไม่ให้ตัวละครทับอยู่บนเฟอร์นิเจอร์ (เต็นท์/โต๊ะ/บอร์ด)

ขอบเขต: เปลี่ยนเฉพาะตาราง LAYOUT_WIDE ใน campsite-scene.tsx ให้ตัวละครทั้ง 7 ยืนเป็นวงรีบนลานดินเปิด "You" อยู่ที่ท่าเรือตามเดิม

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
|---|---|---|---|---|
| 1 | หน้า /status/map โหลดบน wide screen | เปิดหน้า | ตัวละครทั้ง 7 ยืนเป็นวงแหวนรอบลานกลาง ไม่ทับเฟอร์นิเจอร์ | LAYOUT_WIDE ใช้ค่าวงแหวน: architect(50,38) designer(60,43) backend(63,52) frontend(59,61) devops(41,61) qa(37,52) security(41,43) |
| 2 | หน้า /status/map บน portrait screen | เปิดหน้า | ตัวละครอยู่ในกลุ่มตรงกลาง LAYOUT_NARROW ไม่เปลี่ยน | LAYOUT_NARROW ยังคงค่า x42/x58 grid เดิม |
| 3 | ตัวละคร "You" | เปิดหน้า | "You" อยู่ที่ท่าเรือ (dock) บนซ้าย | YOU_POS_WIDE = {x:38, y:23} |

## Out of scope

- LAYOUT_NARROW ไม่เปลี่ยน (ค่า x42/x58 ยังคงเดิม)
- ไม่แตะ engine, HUD, real-time, reduced-motion, scaling
- ไม่เพิ่ม component ใหม่หรือเปลี่ยน design token
