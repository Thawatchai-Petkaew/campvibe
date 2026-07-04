---
linear: CAM-220
feature: design-system-v2
epic: modal-header-consistency-one-shared-shell (CAM-219)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# MODAL-1 — Unify modal header into one shared shell (CAM-220)

## Why

ทุก modal hand-roll header เอง → ระยะปุ่มปิด (X) บน-ล่างไม่เท่ากันระหว่าง modal (เจ้าของพบ Login/Register ≠ Search/Filter). รวม header เป็น component กลางตัวเดียว → ระยะเท่ากันโดยโครงสร้าง + maintainable. KPI: ทุก modal ที่มี header ใช้ shell เดียวกัน (0 ตัว hand-roll header).

## Story

ในฐานะ **platform** ฉันต้องการ **ให้ modal ทุกตัวที่มีหัวข้อใช้ header ชุดเดียวกัน** เพื่อ **ผู้ใช้เห็น UI สม่ำเสมอ (ปุ่มปิดอยู่ตำแหน่งเดียวกัน ระยะเท่ากัน) และทีมแก้ที่เดียวจบ**. ขอบเขต: สร้าง `ModalHeader` + `ModalContent` แล้ว migrate 6 modal (Login, Register, Search, Filter, Amenities, AddMember).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด modal ใดก็ได้ใน 6 ตัว | ดูส่วนหัว | ปุ่มปิดรูปกากบาทมีระยะห่างด้านบนและด้านล่างเท่ากันทุก modal หัวข้ออยู่กึ่งกลาง มีเส้นคั่นใต้หัวข้อเหมือนกัน | ทุก modal เรนเดอร์ผ่าน component `ModalHeader` ตัวเดียวกัน ไม่มีตัวใด hand-roll header |
| 2 | modal ที่มีข้อความรองใต้หัวข้อ (สมัครสมาชิก, เพิ่มสมาชิกทีม) | ดูส่วนหัว | ข้อความรองแสดงใต้หัวข้อ และปุ่มปิดยังอยู่ตำแหน่งเดิม ระยะบน-ล่างยังเท่ากัน | `ModalHeader` รับข้อความรองได้ ปุ่มปิดจัดกึ่งกลางแนวตั้งอัตโนมัติ |
| 3 | modal ใดก็ได้ | กดปุ่มปิด หรือกดปุ่ม Esc หรือคลิกพื้นที่นอกกรอบ | modal ปิดลง | ปิดผ่านกลไกเดิม พฤติกรรมไม่เปลี่ยน |
| 4 | modal สิ่งอำนวยความสะดวก | เปิดดู | การ์ดมุมโค้งเท่ากับ modal อื่น มีปุ่มปิดที่ส่วนหัว และยังมีปุ่มปิดด้านล่างเหมือนเดิม | ใช้ค่ามุมโค้งมาตรฐานของ shell เลิกใช้ค่าที่เล็กกว่าเดิม |
| 5 | สลับภาษาไทย/อังกฤษ | เปิด modal | หัวข้อและคำบนปุ่มปิดเปลี่ยนภาษาถูกต้อง | ข้อความมาจากชั้นแปลภาษาเดิม (ผู้เรียกส่งหัวข้อ + ป้ายปุ่มปิดเข้ามา) |
| 6 | โหมดสีเข้ม | เปิด modal | ส่วนหัว เส้นคั่น และปุ่มปิด อ่านออกชัดทั้งโหมดสว่างและสีเข้ม | ใช้สีจาก token เท่านั้น |

## Rules

* ทุก modal ที่มี header ใช้ `ModalHeader` + `ModalContent` (single source) — ห้าม hand-roll header ใหม่
* ปุ่มปิด: ขนาด 44×44 (size icon), มุมกลม, ghost, จัดกึ่งกลางแนวตั้ง, มี aria-label จากป้ายปิด, `data-testid="btn--modal-close"`
* padding ส่วนหัวสมมาตรบน-ล่าง (ค่าจริง Designer เคาะใน brief) + token-only ตาม DESIGN.md §2/§3/§5; ปุ่มปิด h-11 w-11 มุมขวาบนตาม §3
* ไม่แตะ AlertDialog (ยืนยันลบ/ยกเลิก) และ Sheet (เมนูมือถือ) — คนละ primitive

## Data

ไม่มี migration · ไม่มี field ใหม่ · ไม่มี i18n key ใหม่ (ใช้ `t.common.close` + หัวข้อเดิมที่มีอยู่แล้ว)

## Out of scope

* AlertDialog confirm modals + mobile Sheet (คนละ primitive)
* การ redesign เนื้อหาภายใน modal (งานนี้แตะแค่ header/shell) → ถ้าต้องการเป็น follow-up story

## Self-verify

* lint · typecheck · test (≥80% บนของใหม่) · build · check:palette · check:ds เขียว
* เปิดทั้ง 6 modal บน Staging URL จริง → ปุ่มปิดระยะบน-ล่างเท่ากันทุกตัว
* สลับ TH/EN + โหมดสีเข้ม + ปิดด้วย X/Esc/คลิกนอก ครบ
* design gate ผ่าน (token-only + a11y + anti-slop ตาม DESIGN.md)

## Links

* DESIGN.md §3 (overlay grammar) · §5 (One modal shell)
* ปิด gap จาก [CAM-123](https://linear.app/campvibe/issue/CAM-123/qa-engineer-ds-3-inputfield-grammar-card-primitive-modal-shell) (DS-3 Modal shell)
* Epic: [CAM-219](https://linear.app/campvibe/issue/CAM-219/modal-header-consistency-one-shared-shell)
