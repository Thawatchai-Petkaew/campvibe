# std/discovery.md — มาตรฐาน Discovery (PO/Analyst)

memory ที่ PO/Analyst อ่านก่อนเริ่มทุก feature ก่อนผ่าน **G1 (Scope)** เป้าหมาย: เปลี่ยน requirement ดิบ → spec ที่ build ได้โดยไม่เดา

## หลักการ
- **Spec-first** — ไม่ปิด Discovery ถ้ายังมี gap 🔴 ค้าง; ทุก AC ต้องโยงกลับ requirement ได้ ที่ G1 คือจุดเดียวที่ scope เปลี่ยนได้ฟรี หลังจากนั้นแพง
- **research ก่อนเดา** — ดูของจริงในโค้ด/Linear ก่อนตั้งสมมติฐาน ลด gap 🔴 ตั้งแต่ต้น
- **ถามรวบยอด ไม่จุกจิก** — มนุษย์คือคอขวด รวมคำถามเป็นรอบเดียว แต่ละข้อมีตัวเลือก + ผลกระทบ + default
- **ห้ามเดาเงียบ** — ไม่รู้ = ยก 🔴 แล้วถาม ไม่ใช่เติมค่าเองเงียบๆ

## มาตรฐาน/กฎ
**6 มิติ gap (ครบทุกมิติก่อนปิด):** Business · Functional · Technical · UX · Security/Data · Risk

**สถานะ gap:** 🟢 ปิด(มีคำตอบ/หลักฐาน) · 🟡 สมมติ(ต้อง confirm) · 🔴 ต้องถาม(blocker) · ⚪ N/A — ผ่าน G1 ได้เมื่อ **ไม่มี 🔴 ค้าง** (🟡 ต้องระบุ default ที่จะใช้ถ้าไม่ได้คำตอบ)

**วิธีทำ (loop):**
1. research จริง: อ่าน `prisma/schema.prisma`, `app/api/*`, `lib/*`, `components/*` + ดู Linear (team Campvibe) งานเดิม/ของซ้ำ
2. ทำ gap list ต่อมิติ → ติดสถานะ 🟢/🟡/🔴/⚪
3. รวมคำถาม 🔴/🟡 → ถามมนุษย์ **รอบรวบยอด** แต่ละข้อมี: ตัวเลือก + ผลกระทบแต่ละทาง + "ถ้าไม่ตอบ default = …"
4. ปิดครบ (ไม่มี 🔴) → เขียน ticket จาก `ai-planning/templates/STORY-TICKET.md` → เสนอ G1

**Ticket = 1 atomic story:** ใช้ template เป๊ะ — `## ทำไม`(+KPI) · `## Story`(ในฐานะ…ฉันต้องการ…เพื่อ…+ขอบเขต) · `## AC`(ตาราง GFM: Given|When|ผลที่ผู้ใช้เห็น+copy ไทย verbatim|ผลเชิงข้อมูล) · `## Rules`(ค่า/ขอบเขต+error จริง) · `## Data`(field atomic+migration) · `## Out of scope`(+ชี้ ticket รับช่วง) · `## Self-verify` · `## Links`
- เนื้อ story+AC ลง **issue ระดับ story** ใน Linear (role-task = sub-issue) · ตรวจตรง template ด้วย `node scripts/linear-sync.mjs audit` (ต้องมี `## Story` + `## AC`)
- **persona** = Admin | Camper | Host · AC ฝั่งซ้าย "ผู้ใช้เห็นอะไร"(copy ไทยจริง) ฝั่งขวา "ระบบเก็บ/เปลี่ยนอะไร"(ภาษาคน)

**DoR (เกณฑ์ "พร้อม build"):** User Story + AC testable · NFR ระบุชัด (perf/a11y/i18n/security) · out-of-scope ชัด · แตกเป็น atomic story (1 PR เล็ก ≤~400 บรรทัด) · AC verify ได้บน **Staging URL** จริง (Done = merge→`staging` ไม่ใช่แค่ผ่าน lint)

## ต้องคำนึง / anti-patterns
- ❌ เดาค่า/ขอบเขตเองแล้วเขียน AC ต่อ → ✅ ยก 🔴 ถามก่อน
- ❌ ถามทีละคำหลายรอบ → ✅ รวบยอดรอบเดียว + ตัวเลือก + default
- ❌ AC คลุม ("ระบบทำงานถูกต้อง") → ✅ granular + copy ไทย verbatim + ผลเชิงข้อมูล
- ❌ ใส่ event-code/ชื่อ class/ตัวแปร/testid ใน AC → ✅ อยู่ใน spec เทคนิค (tech) เท่านั้น
- ❌ em-dash (—) คั่นข้อความไทย / ศัพท์เทคนิค (API, webhook, endpoint) ใน copy ผู้ใช้ → ✅ ภาษาคน
- ❌ ก้อนใหญ่หลาย concern → ✅ แตก atomic; งานเล็กใช้ ticket ใบเดียว เพิ่ม spec/tech/test เมื่อซับซ้อนจริง
- ❌ ข้ามดู Linear แล้วทำซ้ำ/ขัดงานเดิม → ✅ research ก่อน

## Checklist (DoD ของ Discovery)
- [ ] research codebase + Linear แล้ว (ไม่ใช่เดา)
- [ ] gap list 6 มิติครบ · ไม่มี 🔴 ค้าง · 🟡 ทุกตัวมี default
- [ ] User Story + AC testable + NFR + out-of-scope ครบ (DoR)
- [ ] แตก atomic story (1 PR เล็ก)
- [ ] ticket ตรง template + `node scripts/linear-sync.mjs audit` ผ่าน
- [ ] เสนอ G1 พร้อมสรุป gap/สมมติที่ใช้
