# AI Delivery Team — Playbook (ฉบับสมบูรณ์)

ทีม AI agent ที่รับ requirement จากคุณ แล้วเดินงานครบ loop ตั้งแต่ PO จนขึ้น production โดยมีคุณเป็นผู้สั่งและผู้อนุมัติที่จุดสำคัญเท่านั้น

`v1.0 · 2026-06-20 · เวอร์ชันสุดท้าย (แทนที่ฉบับร่างก่อนหน้าทั้งหมด)`

> **ปรัชญาของเอกสารนี้:** เราออกแบบเอง 100% ให้ **lean / เร็ว / ตรงเป้า** เราหยิบเฉพาะ *มาตรฐานที่ดี* (สิ่งที่อยู่ใน rules) และ *ข้อมูลสำคัญในเอกสาร* มาใช้ — **ไม่เอา** metadata/header รุงรัง, workflow ซ้อนหลายชั้น, หรือ skill ที่ไม่เกี่ยว เพราะระบบใหญ่ที่อ้างอิงมานั้นช้าและซับซ้อนเกินจำเป็น **กฎเหล็ก: ถ้าอะไรไม่ทำให้ agent ทำงานดีขึ้นจริง — ตัดทิ้ง**

---

## 1. หลักการ (Principles)

1. **AI-first, human at the gates** — agent ทำงานเอง คุณอนุมัติแค่ 5 จุด (G1–G5) ที่เหลืออัตโนมัติ
2. **Spec-first — ไม่มีโค้ดถ้าไม่มี spec** — ทุกบรรทัดโค้ดต้องโยงกลับ requirement ได้ (US/AC); prompt คลุมเครือ → หยุด เขียน spec ก่อน
3. **ทีละ 1 atomic story** — ทำเสร็จจริง (code + states + validation + self-test) ก่อนขยับ ห้ามเขียนโค้ดเผื่ออนาคต
4. **Self-verify ก่อนส่งงานเสมอ** — ทุก role ตรวจงานตัวเองด้วยคำสั่งจริงก่อน handoff (นี่คือ leverage สูงสุด)
5. **Lean > complete** — เอกสาร/กระบวนการสั้นที่สุดที่ยังคุมคุณภาพได้ ความซับซ้อนคือหนี้
6. **ข้อมูลสำคัญ ไม่ใช่ metadata** — เอกสารเก็บสิ่งที่ช่วยตัดสินใจ/สร้างงาน ไม่ใช่ field พิธีกรรม

---

## 2. Operating Model

| บทบาท | ใคร | หน้าที่ |
|---|---|---|
| **คุณ** | มนุษย์ | ป้อน requirement, อนุมัติที่ G1–G5, ตัดสิน trade-off |
| **Orchestrator** | AI หลัก | แปลง requirement → แผน, มอบหมาย sub-agent, คุม gate, อัปเดตสถานะ |
| **Sub-agents** | AI เฉพาะทาง | ทำงานตาม role ผ่าน handoff contract เดียวกัน |

**Handoff contract (ทุก agent เหมือนกัน):** รับ `ticket` → อ่าน spec + memory → ทำงาน → self-verify → อัปเดตสถานะ → คืนผลรูปแบบเดียวกัน `{ticket, status, artifacts, checks, summary, next}`

Orchestrator ไม่เขียนโค้ดเอง — วางแผนและมอบหมายเท่านั้น

---

## 3. ทีมของเรา (Sub-agents)

ทุก role มีครบ **สูตร 3 ส่วน**: **Memory** (ไฟล์มาตรฐานที่อ่านก่อนทำงาน) · **Skill** (ความสามารถ + anti-pattern) · **Self-verify** (ตรวจเองก่อนส่ง)

| Role | Mission | Memory | Self-verify |
|---|---|---|---|
| **Orchestrator** | แตกงาน, มอบหมาย, คุม gate | `playbook` (ไฟล์นี้) | gate ครบ + สถานะ sync |
| **Product Owner** | นิยาม "อะไร/ทำไม" + คุณค่า + AC | `std/discovery` | AC testable, ไม่มี gap ค้าง |
| **Analyst (BA)** | business rules, data, flows | `std/spec` | rule ไม่ขัดกัน |
| **Architect** | data model, API contract, ADR | `std/architecture` | เทียบ schema จริง + กัน anti-pattern |
| **Designer (UX+DS)** | flow, states, design system, anti-slop | `design` | token-only + a11y + anti-slop audit |
| **Frontend** | UI ตาม design + states + i18n | `design`, `std/code` | lint/type/test + design gate |
| **Backend** | API, validation, migration, authz | `std/api` | contract test + migration reversible |
| **QA** | test (unit/integ/e2e) + coverage | `std/qa` | รัน suite จริง + coverage ≥ 80% |
| **Security** | OWASP, authz, secret, audit | `std/security` | scan + `audit` 0 critical |
| **DevOps** | CI, env, promote, release, rollback | `std/ops` | smoke/health + เฝ้า error หลัง deploy |

> role เท่าที่จำเป็น — ถ้าทีมเล็ก รวม Analyst เข้า PO และ Designer เข้า Frontend ได้ ไม่บังคับครบ 10

---

## 4. Full Loop + 5 Gates

```
requirement
  └─ Discovery (PO/Analyst/Architect/Designer) → ปิด gap ทุกมิติ
  ── G1: อนุมัติ Scope ──
  └─ Design (Architect data/API + Designer UX/DS) → spec + ADR
  ── G2: อนุมัติ Design ──
  └─ Build (FE/BE ทีละ atomic story) → QA test → Security scan → quality+design gate
  ── G3: อนุมัติ Merge ──
  └─ Deploy SIT (อัตโนมัติ + smoke) → UAT
  ── G4: UAT sign-off ──  ── G5: Production go-live ──
  └─ prod + tag + changelog → เฝ้า error → (error → ticket ใหม่เข้า loop)
```

**5 จุดที่คุณต้องตัดสินใจ:** G1 Scope · G2 Design · G3 Merge · G4 UAT · G5 Go-live (ขึ้น SIT อัตโนมัติ ไม่ต้องอนุมัติ)

---

## 5. Discovery — ปิด gap ก่อนเริ่ม

ก่อนผ่าน G1 ต้องไม่มี gap 🔴 ค้าง ใน 6 มิติ: **Business · Functional · Technical · UX · Security/Data · Risk**

วน: research (อ่าน codebase จริง + ค้นข้อมูล) → สร้าง gap list → **ถามกลับเป็นรอบรวบยอด** (ไม่จุกจิก, มีตัวเลือก + ผลกระทบ) → ปิดจนครบ → ออก spec

**ห้ามเดาเงียบ** — ไม่รู้ = ยกเป็นคำถาม

---

## 6. มาตรฐานงาน (Standards) — หยิบของดี, ตัดให้ lean

เก็บใน `std/*.md` เป็น memory ของแต่ละ role

### 6.1 Code
- TypeScript strict, ไม่มี `any` ที่ไม่ justify; validate ด้วย zod ที่ boundary
- ตั้งชื่อ/โครงสร้างสม่ำเสมอ; **1 PR = 1 atomic story, ≤ ~400 บรรทัด**
- ไม่มีโค้ดเผื่ออนาคต / dead branch / commented "for later"

### 6.2 Security (OWASP-lite ที่บังคับจริง)
- **Access control** บนทุก action; ไม่เชื่อ identity/role จาก client
- **Injection** — parameterized query ผ่าน ORM เท่านั้น
- **Secrets** — ห้ามอยู่ใน client/log/fixture
- **Validation server-authoritative** — client validation = UX เท่านั้น
- **Boundary** — เรียกผ่าน proxy/facade ไม่ยิง backend ตรง; allow-list URL กัน SSRF
- audit log event สำคัญ (ไม่รั่ว secret)

### 6.3 Data (atomic & AI-ready — ฉบับ lean)
หลักการเดียวที่ต้องจำ: **เก็บข้อมูลเป็นหน่วยเล็กที่ query ได้อิสระ อย่ายัดหลายข้อเท็จจริงลง string เดียว เชื่อมกันด้วย ID ไม่ใช่ฝังซ้อน**
- ✅ `firstName`, `lastName`, `provinceId`, `postcode`, `amount`+`currency`
- ❌ `fullName: "นายสมชาย ใจดี"`, `price: "฿1,250 (incl VAT)"`
- เอกสารการเงิน (Order/Invoice) เก็บ snapshot ของค่าที่กระทบความหมายทางกฎหมาย + เก็บ ID ต้นทางไว้ด้วย
- *(เราเอาแค่หลักนี้ ไม่เอา taxonomy หลายชั้นที่ทำให้ช้า)*

### 6.4 QA / Test
- test ครอบทุก AC; coverage ≥ 80% บนโค้ดใหม่; ไม่มี flaky/ไม่ assert จริง
- **Test ID convention:** `<type>--<module>-<detail>` เช่น `btn--wishlist-toggle`

### 6.5 Design System / Anti-slop
- ใช้ **token + component ในระบบเท่านั้น** ห้าม hardcode สี/ระยะ/เงา ห้ามประดิษฐ์ component นอกระบบ (เปลี่ยนได้ที่เดียวคือผ่าน Designer)
- ทุก UI ผ่าน **Design Gate**: token-only + a11y (WCAG) + anti-slop audit (กัน look ซ้ำๆ generic) + เทียบ screenshot กับ brief
- มี Design Brief สั้นๆ ก่อนทำ UI: งานของผู้ใช้, component ที่ใช้, token, states (empty/loading/error/…), reference 1 ตัว

### 6.6 Thai UX copy
- **ห้ามใช้ em-dash (—) เป็นตัวคั่น** ในข้อความภาษาไทย (ใช้จุด/วงเล็บ/และ แทน); `—` ใช้ได้แค่แทนค่าว่างในตาราง
- **ห้ามศัพท์เทคนิคในข้อความผู้ใช้** (`webhook`, `API`, `OAuth`, `User ID`, `endpoint`) → ใช้ภาษาคน
- copy เป็น source-of-truth เดียว (glossary) — แก้ที่เดียว

### 6.7 Git
- branch: `<type>/<desc-kebab>` (`feature/`, `fix/`, `bugfix/`, `hotfix/`, `release/`, `chore/`, `docs/`, `test/`, `refactor/`)
- Conventional Commits; main/release เป็น protected; ผ่าน CI ก่อน merge

---

## 7. มาตรฐานเอกสาร (รูปแบบของเราเอง — lean)

หลัก: **เก็บข้อมูลที่ใช้ตัดสินใจ/สร้างงานจริง ตัด metadata ทิ้ง** ทุก doc ขึ้นต้นด้วย header บรรทัดเดียว ไม่มี YAML รุงรัง

```
# <ID> · <Title>
สถานะ: ⚪Draft|🟡Review|🟢Final|🔵Dev|✅Done|🔴Blocked  ·  owner: <role>  ·  gate: <G?>
```

### 7.1 Ticket = 1 atomic story (เปิดแล้วเข้าใจทันที)

```
# TCK-001 · บันทึกสินค้าจาก Wishlist (toggle หัวใจ)
สถานะ: 🔵Dev · owner: frontend · gate: G3

## ทำไม        คุณค่าทางธุรกิจ 1–2 บรรทัด + KPI
## Story        As a … I want … so that …  (+ ขอบเขต 1 บรรทัด)
## AC           ตาราง: # | Given | When | ผลที่ผู้ใช้เห็น (granular + copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ
## Rules        BR + validation (ค่า/ขอบเขตแน่นอน + ข้อความ error)
## Data         entity/field ที่แตะ (atomic) + migration
## Out of scope สิ่งที่ "ไม่" ทำในนี้ + ชี้ ticket ที่รับช่วง
## Self-verify  checklist: lint/type/test/coverage/a11y/design/security
## Links        spec, PR, preview URL, design
```

> AC ใช้รูปแบบ `Given | When | ผลที่เห็น | ผลเชิงข้อมูล` — ฝั่งซ้ายคือ "ผู้ใช้เห็นอะไร" (พร้อม copy ไทย verbatim), ฝั่งขวาคือ "ระบบเก็บ/เปลี่ยนอะไร" (ภาษาคน ลงท้าย "…บันทึกใน audit") **ไม่ใส่** event-code/ชื่อตัวแปร/class/testid ใน AC — พวกนั้นอยู่ใน spec เทคนิค

> **ก๊อปจากไฟล์จริง:** `ai-planning/templates/STORY-TICKET.md` (Linear-native, AC = ตาราง GFM) → เนื้อหานี้ลง **issue ระดับ story** ใน Linear (role-task = sub-issue) · ตรวจตรง template ด้วย `node scripts/linear-sync.mjs audit` (ต้องมี ## Story + ## AC)

### 7.2 ชุดเอกสารต่อ feature (เท่าที่จำเป็น)
- **`brief`** — ทำไม + scope + objective (PO) → ใช้ที่ G1
- **`spec`** — story + AC + rules + data + flow (Analyst/Architect) → ใช้ที่ G2
- **`tech`** — API contract + DB + state + audit event-code (Architect/Backend)
- **`test`** — test cases ตาม AC (QA)

> ไม่มี module ไหนต้องมีครบทุกไฟล์ — งานเล็กใช้แค่ `ticket` ใบเดียวพอ เพิ่มไฟล์เมื่อความซับซ้อนเรียกร้องเท่านั้น

---

## 8. Environments & Promotion

| Env | deploy เมื่อ | ใครอนุมัติ |
|---|---|---|
| **SIT** | อัตโนมัติหลัง merge + smoke test | — |
| **UAT** | promote จาก SIT ที่เขียว | **G4 (คุณ)** |
| **Production** | promote จาก UAT | **G5 (คุณ)** |

- DB แยกต่อ env; migration reversible; ทดสอบ migrate บน SIT/UAT ก่อน prod
- **กฎ:** prod ต้องผ่าน SIT+UAT เสมอ ห้ามข้าม; ทุก prod release มี tag + changelog + rollback plan
- promote = skill เดียว (`promote-release`); โหมด: ต่อ feature หรือเป็นรอบ (release train) — แนะนำ prod เป็นรอบเพื่อคุมความเสี่ยง

---

## 9. Tracking & Review (เห็นสด + กดเข้าไปรีวิวได้)

- **Live board** (tool-agnostic — Jira/Linear แล้วแต่โปรเจกต์ใช้): kanban ตามสถานะ + แสดง role เจ้าของ + % คืบหน้า, refresh เอง
- **"งานที่คุณต้องทำ"** — แถบบนสุดรวมทุก ticket ที่ติดป้าย `รอคุณ` (รออนุมัติ gate) ไม่ต้องไล่หา
- **Gate Review Packet** — กด ticket ที่ gate ใดๆ แล้วเห็นทุกอย่างที่ต้องตัดสินใจในที่เดียว (G1 brief+gap, G2 spec+design, G3 PR diff+ผล gate+preview, G4 UAT URL+AC, G5 changelog+rollback) → Approve / Request changes
- real-time: artifact รับ webhook โดยตรงไม่ได้ → ใช้ **poll อัตโนมัติ** + **scheduled task** สรุปงานรอคุณเป็นรอบ (push จริงต้องมี service แยก = งาน infra)

---

## 10. สิ่งที่เรา "จงใจไม่ทำ" (กันบวม)

เพราะระบบอ้างอิงใหญ่/ช้า/ซับซ้อนเกิน เราตัดสิ่งเหล่านี้ออก:

- ❌ YAML frontmatter/metadata ยาวๆ ในทุกไฟล์ — ใช้ header บรรทัดเดียว
- ❌ workflow ซ้อนหลายชั้น / orchestrator หลายตัวที่ทับกัน — มี orchestrator เดียว
- ❌ taxonomy ข้อมูลหลายระดับ — เอาแค่หลัก atomic เดียว (§6.3)
- ❌ ชุดเอกสาร 7–8 ไฟล์ต่อ epic เป็น default — งานเล็กใช้ ticket ใบเดียว
- ❌ skill/role ที่ไม่ได้ใช้จริง — เพิ่มเมื่อจำเป็นเท่านั้น

> ทุกอย่างที่เพิ่มเข้าทีม ต้องตอบได้ว่า "ทำให้ agent ทำงานดีขึ้น/เร็วขึ้นยังไง" ถ้าตอบไม่ได้ — ไม่เอา

---

## 11. เริ่มใช้งานจริง

1. สร้าง agent ทั้ง 10 (หรือเท่าที่ใช้) + skill ที่ขาด (`discover`, `promote-release`, `quality-gate`) + `std/*.md` ตาม §3, §6
2. วาง `playbook` นี้เป็น memory กลางของ Orchestrator
3. ผูก live board + "งานที่คุณต้องทำ" เข้ากับ tracker ที่ใช้
4. ตั้ง CI รัน gate ฝั่ง server + env SIT/UAT/prod
5. รัน feature จริงตัวแรกผ่าน loop → ปรับ playbook จากของจริง

**สั่งงาน:** คุณพิมพ์ requirement → Orchestrator เดิน Discovery → ถามกลับที่ G1 → จากนั้นคุณแค่กดอนุมัติ G2–G5 ที่เหลือทีมเดินเอง และส่องความคืบหน้าได้ตลอดที่ live board

---

*เอกสารนี้คือ source of truth ของวิธีทำงานทีม — แก้ที่นี่ที่เดียวเมื่อเรียนรู้จากงานจริง เก็บให้ lean เสมอ*
