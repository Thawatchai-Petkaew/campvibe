# Product Strategy — CampVibe

> **ไฟล์สำคัญสุดสำหรับ `/camper-agent`** — เกณฑ์เชิงธุรกิจที่ใช้ตัดสิน gate ที่ deterministic check ไม่ครอบ
> ส่วน `> TODO(you):` รอเจ้าของเติม · ถ้าจุดที่ต้องตัดสินยังเป็น TODO/ไม่ฟันธง → **escalate ถาม**

## หลักการผลิตภัณฑ์ (principles)
1. **Trust ก่อน growth** — review จริง (verified-stay), verified badge, ownership/authz แน่น, PDPA; อย่าโตด้วยของปลอม/ข้อมูลรั่ว
2. **ลด friction ของ core loop** — ค้นหา → ดู → จอง → กลับมา (wishlist); ทุกฟีเจอร์ต้องช่วย loop นี้
3. **Lean (กฎเหล็ก §6 CLAUDE.md)** — เพิ่มอะไรต้องตอบได้ว่าช่วย north-star/persona ยังไง ไม่งั้นตัด
4. **Supply–demand สมดุล** — อย่าดัน demand จนไม่มีแคมป์รองรับ หรือมีแคมป์แต่ไม่มีคน
5. **ไทยเป็นหลัก** — copy/ux/PII ออกแบบเพื่อผู้ใช้ไทย (ดู `.claude/rules/ux.md`, `DESIGN.md`)

## ลำดับความสำคัญ (Now / Next / Later)
- **Now (กำลังทำ/เพิ่งเสร็จ):** wishlist (done staging) · ปิด **4 security gap** จาก gap-audit (spot IDOR, unauth upload, error leak, isVerified self-grant) — *trust = P0*
- **Next:** search/filter ตามจังหวัด · notifications (Telegram) · SEO หน้า public (`.claude/rules/seo.md`) · coverage threshold enforce
- **Later:** > TODO(you): payment/escrow, ปฏิทินว่าง, แชร์ wishlist, remarketing, host analytics
> TODO(you): ยืนยัน/จัดลำดับใหม่ตามกลยุทธ์จริง (อ้าง `FEATURE-BACKLOG.md`)

## จะทำ / ไม่ทำ (สำหรับ `/camper-agent` รู้ขอบเขต)
**ทำ:** อะไรที่ดัน core loop (ค้นหา/จอง/รีวิว/wishlist) + trust + supply/demand
**ยังไม่ทำตอนนี้ (escalate ถ้าถูกขอ):**
> TODO(you): ระบุชัด เช่น — payment จริง/escrow, native app, ตลาดนอกไทย, social feed, ฟีเจอร์ที่ไม่แตะ core loop

## Success metrics / KPI
- **North-star:** > TODO(you): (แนะนำ booking สำเร็จ/เดือน หรือ GMV) — ค่าปัจจุบัน/เป้า: ___
- **Input:** conversion ค้นหา→จอง · % ใช้ wishlist · review/booking · แคมป์ published · MAU
- **Guardrail (ห้ามแย่ลง):** อัตรา booking ล้มเหลว · เวลาโหลดหน้า public (Core Web Vitals, `.claude/rules/seo.md`) · security incident = 0
> TODO(you): ใส่ตัวเลขเป้าจริงต่อ metric

---

## เกณฑ์ตัดสินของ `/camper-agent` (business layer — ใช้คู่ deterministic gate checks)
เมื่อ autonomous เปิด และ gate มีมิติธุรกิจ ให้ประเมินตามนี้ **ก่อน** auto-approve:

**Auto-approve ได้** เมื่อครบทุกข้อ:
1. ผ่าน deterministic check ของ gate นั้น (G1 gap ปิด / G2 design conform / G3 quality-gate เขียว+coverage / G4 AC verify staging) — ดู `camper-agent.md`
2. อยู่ใน **Now/Next** ของ roadmap + ตรง principle ข้างบน + แก้ pain ของ persona ที่ระบุใน [user-research.md](user-research.md)
3. **ไม่มีค่าใช้จ่ายเงิน** (ดู cost list ใน [business.md](business.md)) และ **ไม่ใช่ G5/security/irreversible**

**Escalate (ถามมนุษย์) เสมอ** เมื่อเข้าข้อใดข้อหนึ่ง:
- อยู่ใน **Later/ไม่ทำ/นอก scope** หรือ strategy ยังเป็น `> TODO(you):` ตรงจุดที่ต้องตัดสิน
- ขัด principle (เช่น โตเร็วแต่ทอน trust/ความปลอดภัย)
- **มีค่าใช้จ่ายเงินแม้นิดเดียว** · G5 prod go-live · แตะ authz/secret/PII · migration ที่ย้อนยาก/ลบข้อมูล
- กระทบ guardrail metric หรือ trade-off เชิงธุรกิจที่เอกสารไม่ฟันธง
> หลักคิด: **ไม่แน่ใจ = ถาม** — `/camper-agent` แทนการตัดสิน "เชิงกล" ไม่ใช่แทน "ความเสี่ยง/รสนิยม/เงิน" ของเจ้าของ

## เกี่ยวข้อง
[master-plan.md](master-plan.md) · [business.md](business.md) · [user-research.md](user-research.md) · `.claude/agents/camper-agent.md` (Phase 2)
