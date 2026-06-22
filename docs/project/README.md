# docs/project — Project Context Store

ที่เก็บ **source-of-truth เชิงธุรกิจ/ผลิตภัณฑ์** ของ CampVibe เป็น `.md` ใช้เป็น **context กลาง** ให้ AI delivery team — โดยเฉพาะ **`/camper-agent`** (ตัวแทนตัดสินใจ) อ่านก่อนตัดสินเรื่องที่ deterministic check ไม่ครอบ (คุณค่าธุรกิจ, ลำดับความสำคัญ, trade-off)

> โฟลเดอร์นี้ = **drop-zone ของเจ้าของ** สำหรับเอกสารธุรกิจ/ผลิตภัณฑ์ (เปลี่ยนได้) — ตอบ "ทำไม/เพื่อใคร/คุ้มไหม"
> - "ทำอย่างไร" (วิธีสร้าง) → `.claude/rules/`, `CLAUDE.md`, `DESIGN.md`
> - "หลักคิดที่ไม่เปลี่ยน / Second Brain" → `docs/context/`
> - **`docs/delivery/`** = per-story delivery artifacts (output ของ workflow ต่อ Feature→Epic→Story) — คนละชั้นกับ `docs/project/` (ทิศทาง/ธุรกิจ)

## ไฟล์

| ไฟล์ | ตอบคำถาม |
|---|---|
| [master-plan.md](master-plan.md) | เราจะไปไหน — vision/mission/north-star + roadmap + ขอบเขต |
| [business.md](business.md) | หาเงิน/สร้างคุณค่ายังไง — model, value prop, pricing, unit economics, GTM |
| [market-size.md](market-size.md) | ตลาดใหญ่แค่ไหน + แข่งกับใคร — TAM/SAM/SOM, เทรนด์, คู่แข่ง, positioning |
| [user-research.md](user-research.md) | ผู้ใช้คือใคร เจ็บตรงไหน — personas, JTBD, pain points, insights |
| [product-strategy.md](product-strategy.md) | จะทำ/ไม่ทำอะไร + วัดผลยังไง — priorities, principles, success metrics, **เกณฑ์เชิงธุรกิจที่ `/camper-agent` ใช้** |
| [PRODUCT-PLAN.md](PRODUCT-PLAN.md) | แผนฟีเจอร์ราย persona + สถานะจริงในโค้ด (audit 06-20) — inventory ละเอียด ประกอบ master-plan |
| [FEATURE-BACKLOG.md](FEATURE-BACKLOG.md) | backlog รวมระดับ epic (REAL/STUB/MISSING) — ภาพรวมก่อนเลือก scope; commit จริงไปที่ Linear |

## `/camper-agent` ใช้ไฟล์นี้อย่างไร
เมื่อ autonomous เปิด และต้องตัดสิน gate ที่มีมิติธุรกิจ (เช่น "feature นี้คุ้มไหม", "scope นี้ตรง strategy ไหม", G5 go-live):
1. อ่าน `product-strategy.md` (priorities + will/won't + KPI) เป็นเกณฑ์หลัก
2. cross-check `master-plan.md` (อยู่ใน roadmap/north-star ไหม) + `user-research.md` (แก้ pain จริงของ persona ไหน)
3. ถ้าเรื่องนั้น **ไม่อยู่ใน strategy / ขัด principle / มีค่าใช้จ่าย / เป็น judgment เชิงธุรกิจที่เอกสารไม่ฟันธง → escalate ถาม** (ไม่เดาแทน)

## การดูแล (convention)
- `> TODO(you):` = ข้อมูลที่ต้องให้ "มนุษย์เจ้าของโปรเจ็ค" เติม (ตัวเลข market จริง, ผล research จริง, pricing) — **agent ห้ามเดา/แต่งตัวเลขแทน**; ถ้าจุดที่ต้องตัดสินยังเป็น TODO → escalate
- ส่วนที่ไม่มี TODO = ข้อเท็จจริงที่ยืนยันได้จาก codebase/ของจริง ณ วันที่เขียน — อัปเดตเมื่อเปลี่ยน
- แก้ไฟล์เหล่านี้ผ่าน PR ปกติ (เป็น source-of-truth ต้องมี history)
