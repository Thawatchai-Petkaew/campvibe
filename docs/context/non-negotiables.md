# Non-negotiables — ข้อห้าม/ข้อบังคับเด็ดขาด

> สิ่งที่ห้ามทำไม่ว่ากรณีใด — ถ้าเรื่องที่ raise มาขัดข้อใด **orchestrator ต้องชี้ให้เห็นใน gate packet** (ไม่ฝืน, ไม่ตัดสินแทน)
> ด้านล่างคือข้อที่เจ้าของ "พูดไว้แล้ว" ในเอกสารอื่น (มีลิงก์ที่มา); ส่วนที่ยังไม่เขียน = `> TODO(you):` (agent ห้ามเดา/แต่งแทน)

- **ความเป็นส่วนตัว / PDPA + authz แน่น** — ไม่รั่ว PII, ownership check ทุก mutation (← `product-strategy.md` #1 Trust · `.claude/rules/security.md` · `.claude/rules/ux.md`)
- **ไม่โตด้วยของปลอม** — ห้าม fake review / ปั้นข้อมูล / ปล่อยข้อมูลรั่ว (← `product-strategy.md` #1)
- **ไม่ทำ dark pattern** — ไม่หลอก/บีบผู้ใช้ (← `README.md` ตัวอย่าง · `DESIGN.md` anti-slop §5)
- **ทุก gate ตัดสินโดยมนุษย์เสมอ** — ไม่มี autonomous approval; orchestrator เป็นผู้ raise ไม่ตัดสินแทน (← `CLAUDE.md` §gates · interactive-only ตั้งแต่ PR #82)
- **ไม่มีค่าใช้จ่ายเงินโดยไม่ถาม** — ค่าใช้จ่ายใดๆ (paid API / infra / prod deploy / ข้อความจริงถึงผู้ใช้) → หยุดถามเจ้าของ (← `.claude/rules/ops.md` · `docs/project/business.md`)

> TODO(you): ข้อห้ามเฉพาะของเจ้าของที่ยังไม่ได้เขียน (เช่น คู่แข่ง/พาร์ตเนอร์ที่ไม่ร่วมงานด้วย, แนวทางที่ไม่เอาเด็ดขาด)
