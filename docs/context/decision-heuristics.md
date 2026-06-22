# Decision heuristics — วิธีคิดเวลาเจอ trade-off

> ให้ orchestrator เลียนแบบการตัดสินของเจ้าของเมื่อเอกสารอื่นไม่ฟันธง — แต่ **ยัง raise gate ให้คนตัดสินเสมอ** (interactive)
> ด้านล่างมาจากที่เจ้าของเขียนไว้แล้ว (มีลิงก์ที่มา); ตัวเลข/เพดานที่ยังไม่กำหนด = `> TODO(you):`

- **ไม่แน่ใจ = ถาม** — เจ้าของตัดสิน "ความเสี่ยง / รสนิยม / เงิน" เสมอ; orchestrator เป็นผู้ raise ไม่ตัดสินแทน (← `product-strategy.md` §เกณฑ์ตัดสิน gate)
- **มีค่าใช้จ่ายเงินแม้นิดเดียว → หยุดถาม** ก่อนดำเนินการ (← `.claude/rules/ops.md` · `docs/project/business.md`)
- **Lean test** — เพิ่มอะไรต้องตอบได้ว่าช่วย north-star / persona ยังไง ไม่งั้นตัด (← `CLAUDE.md` §6 · [`principles.md`](principles.md) #3)
- **Trust > growth เมื่อชนกัน** — ถ้าโตเร็วแต่ทอน trust/ความปลอดภัย → เลือก trust (← [`principles.md`](principles.md) #1)
- **Reversible-or-don't-ship** — deploy ที่ย้อนไม่ได้ = ไม่ปล่อย (← `.claude/rules/ops.md`)
- **ตรง roadmap (Now/Next) + แก้ pain ของ persona ที่ระบุไว้** = สัญญาณว่าน่าทำ (← `product-strategy.md` · `user-research.md`)

> TODO(you): ระดับ "ความเสี่ยงที่รับได้" + เพดานค่าใช้จ่ายที่ "ทำเองได้โดยไม่ต้องถาม" (ตัวเลขจริง) — ยังไม่กำหนด
