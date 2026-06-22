# Principles — หลักการผลิตภัณฑ์ที่ยึดเสมอ

> หลักการที่นิ่ง (Second Brain) — **orchestrator อ่านก่อนวางแผน / ก่อน raise gate** เพื่อเสนอเรื่องให้ตรงกับเจ้าของ
> ย้ายมาจาก `docs/project/product-strategy.md` (ไฟล์ที่ "เปลี่ยนได้") เพราะเป็นหลักการที่ไม่เปลี่ยนตามกลยุทธ์รายไตรมาส

## หลักการผลิตภัณฑ์

1. **Trust ก่อน growth** — review จริง (verified-stay), verified badge, ownership/authz แน่น, PDPA; อย่าโตด้วยของปลอม/ข้อมูลรั่ว
2. **ลด friction ของ core loop** — ค้นหา → ดู → จอง → กลับมา (wishlist); ทุกฟีเจอร์ต้องช่วย loop นี้
3. **Lean** — เพิ่มอะไรต้องตอบได้ว่าช่วย north-star/persona ยังไง ไม่งั้นตัด (กฎเหล็ก §6 `CLAUDE.md`)
4. **Supply–demand สมดุล** — อย่าดัน demand จนไม่มีแคมป์รองรับ หรือมีแคมป์แต่ไม่มีคน
5. **ไทยเป็นหลัก** — copy/ux/PII ออกแบบเพื่อผู้ใช้ไทย (ดู `.claude/rules/ux.md`, `DESIGN.md`)

## Reference index — หลักการที่ "บ้าน" อยู่ที่อื่น (อ้างอิง ไม่ทำซ้ำ)

หลักการด้านวิศวกรรม/ดีไซน์มีบ้านเดียวอยู่แล้ว และ orchestrator อ่านทุก session — ที่นี่แค่ชี้ทาง:

- **วิศวกรรม/ส่งมอบ** → `CLAUDE.md` Iron Rules (Spec-first · One-atomic-story · Self-verify · Read-memory · Never-skip-a-gate · Lean) + `.claude/rules/*` Principles:
  - atomic data / Pixel·Set·Buffet → `.claude/rules/architecture.md`
  - reversible-or-don't-ship + Done ≠ Released → `.claude/rules/ops.md`
  - assume-breach + least-privilege → `.claude/rules/security.md`
  - code-is-a-liability (ลบง่าย > เขียนเยอะ) → `.claude/rules/code.md`
- **แบรนด์/ดีไซน์** → `DESIGN.md` §1 (teal calm-confidence + voice) + §5 (named anti-patterns / anti-slop)
- **ธุรกิจที่เปลี่ยนได้** (roadmap / KPI / scope / market) → `docs/project/*`
- **ข้อห้ามเด็ดขาด + วิธีตัดสิน trade-off** → [`non-negotiables.md`](non-negotiables.md) · [`decision-heuristics.md`](decision-heuristics.md)
