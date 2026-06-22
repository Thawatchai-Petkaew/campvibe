# Product Strategy — CampVibe

> **ไฟล์สำคัญสุดสำหรับการตัดสิน gate** — เกณฑ์เชิงธุรกิจที่ orchestrator + เจ้าของ ใช้ประกอบการตัดสิน gate ที่ deterministic check ไม่ครอบ
> ส่วน `> TODO(you):` รอเจ้าของเติม · ถ้าจุดที่ต้องตัดสินยังเป็น TODO/ไม่ฟันธง → **escalate ถาม**

## หลักการผลิตภัณฑ์ (principles)
> ย้ายไป [`docs/context/principles.md`](../context/principles.md) (Second Brain — หลักการที่นิ่ง): Trust>growth · ลด friction core loop · Lean · supply–demand สมดุล · ไทยเป็นหลัก

## ลำดับความสำคัญ (Now / Next / Later)
- **Now (กำลังทำ/เพิ่งเสร็จ):** wishlist (done staging) · ปิด **4 security gap** จาก gap-audit (spot IDOR, unauth upload, error leak, isVerified self-grant) — *trust = P0*
- **Next:** search/filter ตามจังหวัด · notifications (Telegram) · SEO หน้า public (`.claude/rules/seo.md`) · coverage threshold enforce
- **Later:** > TODO(you): payment/escrow, ปฏิทินว่าง, แชร์ wishlist, remarketing, host analytics
> TODO(you): ยืนยัน/จัดลำดับใหม่ตามกลยุทธ์จริง (อ้าง `FEATURE-BACKLOG.md`)

## จะทำ / ไม่ทำ (ให้ orchestrator + เจ้าของ รู้ขอบเขต)
**ทำ:** อะไรที่ดัน core loop (ค้นหา/จอง/รีวิว/wishlist) + trust + supply/demand
**ยังไม่ทำตอนนี้ (escalate ถ้าถูกขอ):**
> TODO(you): ระบุชัด เช่น — payment จริง/escrow, native app, ตลาดนอกไทย, social feed, ฟีเจอร์ที่ไม่แตะ core loop

## Success metrics / KPI
- **North-star:** > TODO(you): (แนะนำ booking สำเร็จ/เดือน หรือ GMV) — ค่าปัจจุบัน/เป้า: ___
- **Input:** conversion ค้นหา→จอง · % ใช้ wishlist · review/booking · แคมป์ published · MAU
- **Guardrail (ห้ามแย่ลง):** อัตรา booking ล้มเหลว · เวลาโหลดหน้า public (Core Web Vitals, `.claude/rules/seo.md`) · security incident = 0
> TODO(you): ใส่ตัวเลขเป้าจริงต่อ metric

---

## เกณฑ์ประกอบการตัดสิน gate (business layer — ใช้คู่ deterministic gate checks)
เมื่อ gate มีมิติธุรกิจ orchestrator ประเมินตามนี้เพื่อ raise packet ให้เจ้าของ; เจ้าของเป็นผู้ตัดสินเสมอ (interactive):

**สัญญาณว่าน่า Approve** เมื่อครบทุกข้อ:
1. ผ่าน deterministic check ของ gate นั้น (G1 gap ปิด / G2 design conform / G3 quality-gate เขียว+coverage / G4 AC verify staging)
2. อยู่ใน **Now/Next** ของ roadmap + ตรงหลักการใน [`docs/context/principles.md`](../context/principles.md) + แก้ pain ของ persona ที่ระบุใน [user-research.md](user-research.md)
3. **ไม่มีค่าใช้จ่ายเงิน** (ดู cost list ใน [business.md](business.md)) และ **ไม่ใช่ G5/security/irreversible**

**ต้องเน้นย้ำ/ขอเจ้าของพิจารณาเป็นพิเศษ** เมื่อเข้าข้อใดข้อหนึ่ง:
- อยู่ใน **Later/ไม่ทำ/นอก scope** หรือ strategy ยังเป็น `> TODO(you):` ตรงจุดที่ต้องตัดสิน
- ขัด principle (เช่น โตเร็วแต่ทอน trust/ความปลอดภัย)
- **มีค่าใช้จ่ายเงินแม้นิดเดียว** · G5 prod go-live · แตะ authz/secret/PII · migration ที่ย้อนยาก/ลบข้อมูล
- กระทบ guardrail metric หรือ trade-off เชิงธุรกิจที่เอกสารไม่ฟันธง
> หลักคิด: **ไม่แน่ใจ = ถาม** — gate ทุก gate ตัดสินโดยเจ้าของเสมอ (interactive); orchestrator เป็นผู้ raise ให้, ไม่ตัดสินแทน "ความเสี่ยง/รสนิยม/เงิน" ของเจ้าของ

## เกี่ยวข้อง
[master-plan.md](master-plan.md) · [business.md](business.md) · [user-research.md](user-research.md) · `.claude/agents/orchestrator.md` (raises gates to the human)
