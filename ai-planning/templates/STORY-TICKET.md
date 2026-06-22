<!--
STORY-TICKET template — ก๊อปทั้งบล็อกด้านล่างไปสร้าง issue "1 atomic story" ใน Linear
กฎ AC: ฝั่ง "ผลที่ผู้ใช้เห็น" = ผู้ใช้เห็นอะไร + ใส่ copy ไทย verbatim · ฝั่ง "ผลเชิงข้อมูล" = ระบบเก็บ/เปลี่ยนอะไร (ภาษาคน)
ห้ามใส่ event-code / ชื่อ class / ตัวแปร / testid ใน AC — พวกนั้นอยู่ใน spec เทคนิค (tech)
ตรวจความตรง template ด้วย: node scripts/linear-sync.mjs audit  (ต้องมีอย่างน้อย ## Story + ## AC)
-->

## ทำไม
<คุณค่าทางธุรกิจ 1–2 บรรทัด> · **KPI:** <วัดอะไรถึงรู้ว่าได้ผล>

## Story
ในฐานะ **<persona: Admin | Camper | Host>** ฉันต้องการ **<สิ่งที่ทำได้>** เพื่อ **<คุณค่า/เป้าหมาย>**
ขอบเขต: <1 บรรทัด — ทำแค่ไหนในใบนี้>

## AC
| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | <สถานะ/ใครล็อกอินอยู่> | <action เดียว> | <ผลบนจอ + "ข้อความจริงที่ผู้ใช้เห็น"> | <ระบบสร้าง/แก้/ลบอะไร> |
| 2 |  |  |  |  |

## Rules
- <business rule / validation: ค่า/ขอบเขตแน่นอน + **ข้อความ error จริง**>

## Data
- <entity/field ที่แตะ (atomic) + migration ที่ต้องทำ>

## Out of scope
- <สิ่งที่ "ไม่" ทำในใบนี้> → <ticket/epic ที่รับช่วง>

## Self-verify
- [ ] lint  - [ ] typecheck  - [ ] test + coverage ≥80%  - [ ] a11y  - [ ] design (token-only)  - [ ] security

## Links
spec: <Linear CAM-NNN> · PR: <#> · preview: <url> · design: DESIGN.md
