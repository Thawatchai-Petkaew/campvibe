# AI-First SDLC Agent Team — สถาปัตยกรรมและ Bootstrap Prompt

> **เอกสารฉบับนี้คืออะไร**
> เอกสารออกแบบ "ทีม AI agent" ที่ทำงานครบ loop ของ software development lifecycle ตั้งแต่ Product Owner จนถึง Release โดยมี **มนุษย์ (คุณ) เป็นผู้สั่งงานและผู้อนุมัติ** และมี **Orchestrator agent** เป็นผู้แปลง requirement ไปสั่ง sub-agent + skill ให้ทำงานอัตโนมัติภายใต้กรอบมาตรฐาน (code / security / QA) ระดับ production
>
> เอกสารนี้ถูกออกแบบให้ **แก้ไขต่อเนื่องได้** และส่วนท้าย ([§12 Bootstrap Prompt](#12-bootstrap-prompt)) คือ prompt เริ่มต้นที่คุณจะ copy ไปสั่งให้สร้างไฟล์ agent/skill จริงในโปรเจกต์
>
> - **เป้าหมายโปรเจกต์ตัวอย่าง:** CampVibe (Next.js App Router + TypeScript + Prisma/PostgreSQL + Tailwind/shadcn, deploy บน Vercel)
> - **Progress tracking:** Cowork live artifact + ไฟล์ `STATUS.json` ใน repo
> - **เวอร์ชันเอกสาร:** v0.1 — 2026-06-20

---

## สารบัญ

1. [เป้าหมายและหลักการ AI-First](#1-เป้าหมายและหลักการ-ai-first)
2. [Operating Model — ใครทำอะไร](#2-operating-model)
   - 2.5 [Team-wide Adoption Pattern (สูตร 3 ส่วน)](#25-team-wide-adoption-pattern-สูตร-3-ส่วน)
3. [สถาปัตยกรรมภาพรวม](#3-สถาปัตยกรรมภาพรวม)
4. [โครงสร้างไดเรกทอรีในโปรเจกต์](#4-โครงสร้างไดเรกทอรี)
5. [Orchestrator Agent (Delivery Lead)](#5-orchestrator-agent)
   - 5.5 [Requirements Discovery & Gap-Closure Engine](#55-requirements-discovery--gap-closure-engine)
6. [Sub-Agents ทุก role ใน SDLC loop](#6-sub-agents)
7. [Skills ที่ต้องสร้าง (reusable)](#7-skills)
8. [Governance & Quality Gates](#8-governance--quality-gates)
9. [Lifecycle Workflow — full loop](#9-lifecycle-workflow)
   - 9.5 [Environments & Release Promotion (SIT → UAT → Production)](#95-environments--release-promotion-sit--uat--production)
10. [Real-time Progress Tracking](#10-real-time-progress-tracking)
11. [ขั้นตอน Setup โปรเจกต์ + Git](#11-ขั้นตอน-setup)
12. [Bootstrap Prompt](#12-bootstrap-prompt)
13. [Roadmap / Next steps](#13-roadmap)
14. [References & Proven Patterns](#14-references--proven-patterns)

---

## 1. เป้าหมายและหลักการ AI-First

**เป้าหมาย:** คุณป้อน requirement ระดับ "feature/epic" หนึ่งครั้ง แล้วทีม agent เดินงานเองครบ loop — วิเคราะห์ → ออกแบบ → เขียนโค้ด → ทดสอบ → ตรวจ security → review → เตรียม release — โดยหยุดขออนุมัติจากคุณเฉพาะที่ "gate" สำคัญเท่านั้น

หลักการที่ยึด:

- **Human-in-the-loop ที่ gate ไม่ใช่ทุก step** — คุณอนุมัติที่ 5 จุด: (1) Requirement/Scope, (2) Architecture & Plan, (3) ก่อน merge, (4) UAT sign-off, (5) Production go-live จุดอื่นทำอัตโนมัติ (รวมถึง deploy ขึ้น SIT)
- **Single source of truth** — งานทุกชิ้นมี ticket ใน `docs/backlog/` และสถานะรวมใน `STATUS.json` ห้าม agent ทำงานนอก ticket
- **Spec-first, test-first** — เขียน spec และ acceptance criteria ก่อนโค้ด เขียน/ปรับ test ให้ผ่านก่อนปิดงาน
- **Gates บังคับ ไม่ใช่คำแนะนำ** — lint, typecheck, test coverage, security scan ต้องผ่านจริง (ตรวจด้วยคำสั่งจริง ไม่ใช่ "น่าจะผ่าน")
- **เล็กและตรวจสอบได้** — แตกงานเป็น task เล็ก แต่ละ task = 1 PR ที่ review ได้ใน <400 บรรทัด
- **ทุก agent เขียน trace** — บันทึกการตัดสินใจลง ticket เพื่อให้ตรวจย้อนหลังและ track progress ได้

---

## 2. Operating Model

| บทบาท | ใคร | หน้าที่ |
|---|---|---|
| **Requester / Approver** | คุณ (มนุษย์) | ป้อน requirement, อนุมัติที่ gate, ตัดสินใจ trade-off ที่ agent ชี้ |
| **Orchestrator (Delivery Lead)** | AI agent หลัก | แปลง requirement → backlog, มอบหมาย sub-agent, คุม gate, รายงาน progress |
| **Sub-agents** | AI agents เฉพาะทาง | ทำงานตาม role ของตน (PO/BA, Architect, FE, BE, QA, Security, DevOps, Docs) |
| **Skills** | ความสามารถ reusable | ขั้นตอนมาตรฐานที่ agent หลายตัวเรียกใช้ร่วมกัน (เช่น create-ticket, run-quality-gate) |

**กฎทอง:** Orchestrator ไม่เขียนโค้ดเอง — มันวางแผนและมอบหมาย sub-agent ส่วน sub-agent ทำงานเฉพาะทางและส่งงานกลับผ่าน handoff contract ที่กำหนดไว้

---

## 2.5 Team-wide Adoption Pattern (สูตร 3 ส่วน)

> **หลักการกลาง:** สิ่งที่เราทำกับ role UX (DESIGN.md + skill anti-slop + design gate) ไม่ใช่เรื่องเฉพาะ UX — เป็น **"สูตร" ที่ทุก role ต้องมีครบ** ทุกเฟรมเวิร์กที่ research ([§14](#14-references--proven-patterns)) เห็นตรงกันว่า *"ให้ agent ตรวจงานตัวเองได้คือ leverage สูงสุด"*

ทุก sub-agent ต้องมีครบ 3 ส่วนนี้:

1. **Memory** — ไฟล์ single source of truth ที่ agent **อ่านก่อนทำงานทุกครั้ง** (เช่น `DESIGN.md`, `docs/standards/*.md`, ADR) → กัน drift ข้าม session
2. **Constrained Skill** — skill ที่ encode good-defaults + anti-patterns ของ domain นั้น → เริ่มจากจุดที่ดีกว่า prompt เปล่า
3. **Self-Verification Gate** — ตรวจงานตัวเองด้วย "คำสั่งจริง" ก่อน handoff (รัน test / scan / เทียบ screenshot / audit) → ห้ามส่งงานที่ยังไม่ verify

ตารางสรุปต่อ role (รายละเอียดใน [§6](#6-sub-agents)):

| Role | Memory | Skill + anti-pattern | Self-verify |
|---|---|---|---|
| PO/BA | `standards/discovery.md` | `discover-gaps` | Gap Matrix ปิดครบ |
| Architect | ADR + `standards/architecture.md` | pattern checklist (กัน N+1/over-engineering) | ADR review + เทียบ schema จริง |
| UX Guardian | `DESIGN.md` | `hallmark` | Design Quality Gate |
| Frontend | `DESIGN.md` | `hallmark`+`react-best-practices` | Design Quality Gate |
| Backend | `standards/api.md` (อิง `schema/`) | zod-validation + error patterns | contract test + migration reversible |
| QA | `standards/qa.md` | test-pattern | coverage ≥80% |
| Security | `standards/security.md` (OWASP) | `security-review` | 0 critical + `npm audit` |
| DevOps | runbook + rollback | release-checklist | deploy verify + Sentry post-release |

**Cross-cutting 4 ข้อ** (ดู [§8.8](#88-team-wide-rules-cross-cutting)): แยกเฟส planning/dev เข้ม · output schema สม่ำเสมอ · self-verify เป็น DoD ทุก role · gate fail → auto-file Linear ticket

---

## 3. สถาปัตยกรรมภาพรวม

```
                 ┌──────────────────────────────┐
   Requirement → │   คุณ (Requester/Approver)    │ ← Approve ที่ 5 gates
                 └───────────────┬──────────────┘
                                 │ requirement
                                 ▼
                 ┌──────────────────────────────┐
                 │   ORCHESTRATOR (Delivery Lead)│
                 │  - แตก epic → tickets         │
                 │  - มอบหมาย + คุม gate         │
                 │  - อัปเดต STATUS.json         │
                 └───────────────┬──────────────┘
        ┌──────────┬─────────────┼─────────────┬──────────┬──────────┐
        ▼          ▼             ▼             ▼          ▼          ▼
   ┌────────┐ ┌─────────┐  ┌──────────┐  ┌────────┐ ┌─────────┐ ┌────────┐
   │ PO/BA  │ │Architect│  │ FE / BE  │  │  QA    │ │Security │ │ DevOps │
   │ spec   │ │ design  │  │  build   │  │  test  │ │  review │ │ release│
   └────────┘ └─────────┘  └──────────┘  └────────┘ └─────────┘ └────────┘
        │          │             │             │          │          │
        └──────────┴─────────────┴──────┬──────┴──────────┴──────────┘
                                        ▼
                        ┌──────────────────────────────┐
                        │  Shared state:                │
                        │  docs/backlog/*.md (tickets)  │
                        │  STATUS.json (progress)       │
                        │  Git (branch/PR ต่อ ticket)   │
                        └───────────────┬──────────────┘
                                        ▼
                        ┌──────────────────────────────┐
                        │  Cowork Live Artifact         │
                        │  (real-time dashboard)        │
                        └──────────────────────────────┘
```

ใช้ความสามารถ subagent + skill ของ Claude Code/Agent SDK:
- **Sub-agents** = ไฟล์ `.claude/agents/<role>.md` (มี frontmatter `name`, `description`, `tools`, `model`)
- **Skills** = โฟลเดอร์ `.claude/skills/<name>/SKILL.md`
- **Project memory / มาตรฐาน** = `CLAUDE.md` ที่ root
- **Slash commands** สำหรับสั่งงานซ้ำ = `.claude/commands/*.md`

---

## 4. โครงสร้างไดเรกทอรี

```
campvibe/
├─ CLAUDE.md                      # มาตรฐาน + กฎประจำ repo (โหลดอัตโนมัติ)
├─ DESIGN.md                      # design tokens + rationale (Guardian + FE อ่านก่อนทำ UI)
├─ STATUS.json                    # สถานะงานรวม (machine-readable, real-time)
├─ AI_SDLC_TEAM_ARCHITECTURE.md   # เอกสารนี้
├─ .claude/
│  ├─ agents/                     # นิยาม sub-agent ทุก role
│  │  ├─ orchestrator.md
│  │  ├─ product-owner.md
│  │  ├─ architect.md
│  │  ├─ ux-designer.md
│  │  ├─ frontend-engineer.md
│  │  ├─ backend-engineer.md
│  │  ├─ qa-engineer.md
│  │  ├─ security-reviewer.md
│  │  ├─ devops-release.md
│  │  └─ tech-writer.md
│  ├─ skills/                     # capability reusable
│  │  ├─ create-ticket/SKILL.md
│  │  ├─ update-status/SKILL.md
│  │  ├─ run-quality-gate/SKILL.md
│  │  ├─ open-pr/SKILL.md
│  │  └─ write-spec/SKILL.md
│  ├─ commands/                   # slash command เริ่มงาน
│  │  ├─ new-feature.md
│  │  ├─ status.md
│  │  └─ release.md
│  └─ settings.json               # hooks: บังคับ gate ก่อน commit
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                    # lint+typecheck+test+audit ทุก PR (gate ฝั่ง server)
│     └─ promote.yml               # deploy SIT (auto) + promote UAT/prod (manual approval)
├─ .env.example                    # template
│  # ค่าจริงตั้งใน Vercel env แยกต่อ SIT / UAT / Production (DATABASE_URL ฯลฯ)
└─ docs/
   ├─ backlog/                    # ticket ทีละไฟล์ (.md)
   │  └─ TICKET-0001.md
   ├─ adr/                        # Architecture Decision Records
   ├─ specs/                      # spec + acceptance criteria + Requirements Brief
   └─ standards/                  # memory files ราย role (อ้างจาก CLAUDE.md)
      ├─ discovery.md             #   PO/BA: เกณฑ์ DoR + Gap Matrix
      ├─ architecture.md         #   Architect: pattern + anti-pattern
      ├─ api.md                   #   Backend: API/validation (อิง schema/)
      ├─ code.md                  #   Frontend/ทั่วไป: code standards
      ├─ qa.md                    #   QA: test strategy + coverage
      ├─ security.md             #   Security: OWASP checklist
      └─ ops-runbook.md          #   DevOps: deploy + rollback
```

---

## 5. Orchestrator Agent

**ชื่อ:** `orchestrator` (Delivery Lead)
**model:** opus (งานวางแผน reasoning หนัก)
**tools:** Task (spawn sub-agent), Read, Write, Edit, Bash, TaskCreate/Update

**Input:** requirement จากคุณ (free text หรือ slash command `/new-feature`)
**Output:** backlog + การมอบหมาย + การอัปเดต `STATUS.json` + รายงานสรุปต่อคุณ

หน้าที่หลัก (อยู่ใน loop):

1. **Intake** — รับ requirement, ถามคำถามให้ scope ชัด, สร้าง epic
2. **Decompose** — เรียก skill `create-ticket` แตก epic เป็น tickets (แต่ละ ticket = 1 PR เล็ก)
3. **Plan & assign** — กำหนดลำดับ (dependency), ระบุ sub-agent เจ้าของแต่ละ ticket
4. **Gate G1 (Scope)** — ขออนุมัติ scope/backlog จากคุณ
5. **Dispatch** — spawn sub-agent ทีละ ticket ตาม dependency (ขนานได้ถ้าไม่ชนกัน)
6. **Gate G2 (Design)** — รวบ design จาก Architect/UX มาให้คุณอนุมัติก่อน build
7. **Monitor** — อ่านผลจาก sub-agent, อัปเดต `STATUS.json` ทุกครั้งที่สถานะเปลี่ยน
8. **Quality gate** — สั่ง QA + Security ก่อนเข้า review
9. **Gate G3 (Merge)** — สรุป diff + ผล gate ให้คุณอนุมัติ merge
10. **Auto-deploy → SIT** — หลัง merge (G3) DevOps deploy ขึ้น SIT อัตโนมัติ + รัน smoke/integration (ไม่ต้องขออนุมัติ)
11. **Gate G4 (UAT sign-off)** — promote ขึ้น UAT, ให้คุณทดสอบ acceptance แล้วอนุมัติ
12. **Gate G5 (Production go-live)** — promote ขึ้น prod (เดี่ยวหรือเป็น release train), tag เวอร์ชัน, เฝ้า Sentry หลัง deploy
13. **Report** — สรุปสิ่งที่ทำ, ปัญหา, next step

**กฎ:** Orchestrator ห้ามเขียน production code เอง และห้ามข้าม gate ที่ต้องอนุมัติจากมนุษย์

---

## 5.5 Requirements Discovery & Gap-Closure Engine

> **หลักการสำคัญ:** ไม่มี ticket ใดผ่าน Gate G1 ได้ ถ้ายัง "ปิด gap ไม่ครบทุกมิติ" — ทีมต้อง **วิเคราะห์ → research → ถามกลับ** วนซ้ำจนไม่เหลือช่องว่างทั้งฝั่ง Business, Tech/Feature, UX และมิติอื่น ๆ ก่อน เป็นด่านแรกและสำคัญที่สุดของ loop

ปัญหาที่ engine นี้แก้: agent มักจะ "เดาเงียบ" แล้วเริ่มสร้างของบนสมมติฐานผิด ที่นี่บังคับให้ทุกความไม่ชัดเจนถูกยกขึ้นมาเป็นคำถาม และห้ามเริ่ม build จนกว่าจะปิดครบ

### 5.5.1 มิติของ Gap (Gap Dimensions)

ทุก requirement ถูกซักผ่านมิติเหล่านี้ — แต่ละมิติมี sub-agent เจ้าของที่ research เอง:

| มิติ | เจ้าของ | ตัวอย่างสิ่งที่ต้องปิด |
|---|---|---|
| **Business** | product-owner | เป้าหมาย, value/ROI, KPI/success metric, stakeholder, scope & out-of-scope, priority, ข้อจำกัดงบ/เวลา |
| **Functional / Feature** | product-owner | behavior ที่ต้องการ, business rules, edge cases, acceptance criteria (Given/When/Then) |
| **Technical** | architect | feasibility, ผลกระทบต่อ data model (Prisma), integration/dependency, performance budget, migration/backward-compat |
| **UX** | ux-designer | persona, user flow, states (empty/loading/error/success), a11y (WCAG), i18n (TH/EN), responsive + **Design Brief 5 ช่อง** ([§8.7](#87-design-system-governance--anti-slop-gate)) เพื่อกัน UI slop ตั้งแต่ต้น |
| **Data & Privacy** | architect + security | ข้อมูลอะไรถูกเก็บ/ประมวลผล, PII, retention, consent |
| **Security & Compliance** | security-reviewer | authz/authn, threat surface, ข้อกำหนด compliance |
| **Operations** | devops-release | observability (Sentry), rollout/rollback, feature flag, alert/monitoring |
| **Risk & Assumptions** | orchestrator | สมมติฐานที่ตั้งไว้, ความเสี่ยง, unknowns ที่ต้อง spike |

### 5.5.2 สถานะของแต่ละ Gap (Gap Status)

- 🟢 **closed** — ข้อมูลครบ ยืนยันแล้ว
- 🟡 **assumption** — มีสมมติฐานชั่วคราว ต้องให้มนุษย์ confirm
- 🔴 **open** — ยังไม่รู้ ต้องถามกลับ (ห้ามเดาเงียบ)
- ⚪ **n/a** — ไม่เกี่ยวกับงานนี้ (ต้องระบุเหตุผลสั้น ๆ)

**เงื่อนไขผ่าน Gate G1:** ทุกมิติต้องเป็น 🟢 หรือ ⚪ หรือ 🟡 ที่มนุษย์ "accept risk" อย่างชัดเจนแล้วเท่านั้น — ห้ามมี 🔴 ค้าง

### 5.5.3 Discovery Loop (วนจนปิด gap)

```
1. INTAKE      orchestrator รับ requirement ดิบจากคุณ
                     │
2. RESEARCH    spawn PO + architect + ux + security ขนานกัน → research:
   (parallel)   • อ่าน codebase จริง (schema, lib, components ที่มี)
                • ค้น web/benchmark + best practice (WebSearch)
                • query งานเดิมใน Linear / Sentry (production data จริง) / Notion
                     │
3. GAP MATRIX  รวมผลเป็นตาราง "มิติ × สถานะ × คำถามที่ค้าง"
                     │
4. ASK-BACK    orchestrator รวมคำถาม 🔴/🟡 ทั้งหมด → ถามคุณ "เป็นรอบ"
                (batch, แบบ multiple-choice ตอบเร็ว — ไม่ถามทีละคำ)
                     │
5. UPDATE      เติมคำตอบ → ลดสถานะ gap → ทำซ้ำข้อ 2–4 ถ้ายังมี 🔴
                     │
6. EXIT        เหลือ 0 open gap → ออก "Requirements Brief" + spec + ADR
                + acceptance criteria → DoR ครบ → เสนอ Gate G1
```

**กฎการถามกลับ:** ถามเป็นรอบรวบยอด ไม่จุกจิก, แต่ละคำถามมีตัวเลือกแนะนำ + ผลกระทบของแต่ละทางเลือก, และระบุเสมอว่า "ถ้าไม่ตอบ จะใช้สมมติฐานอะไร" เพื่อให้คุณตัดสินใจได้เร็ว

### 5.5.4 Output: Requirements Brief (เก็บใน `docs/specs/`)

```markdown
# Requirements Brief — <TICKET-ID>
## 1. Business      เป้าหมาย / value / KPI / scope & out-of-scope
## 2. Functional    user stories + acceptance criteria (Given/When/Then)
## 3. Technical     ผลกระทบ data model/API + ADR refs + performance budget
## 4. UX            flow + states + a11y + i18n
## 5. NFR           security / privacy / ops / observability
## 6. Risks & Assumptions   (พร้อมสถานะ accept-risk ของมนุษย์)
## 7. Gap Matrix    ตารางทุกมิติ = 🟢/⚪/🟡(accepted) ครบแล้ว
## 8. Open Questions  ว่าง (ต้องว่างก่อนผ่าน G1)
```

Discovery เปิด issue ใน **Linear** เพื่อ log คำถาม/คำตอบ/การตัดสินใจ และดึง **Sentry** มาเป็น input (เช่น "feature นี้แก้ error ที่เกิดบ่อยจริงไหม") ทำให้การวิเคราะห์อิงข้อมูลจริง ไม่ใช่สมมติ

---

## 6. Sub-Agents

ทุก sub-agent มี **handoff contract** เหมือนกัน: รับ `ticket_id` → อ่าน ticket + spec → ทำงาน → เขียนผลลัพธ์กลับ ticket → อัปเดต `STATUS.json` → คืน summary ให้ orchestrator

### 6.1 Product Owner / BA — `product-owner`
- **Input:** epic/idea จาก orchestrator
- **ทำ:** เป็นเจ้าของมิติ Business + Functional ใน Discovery loop ([§5.5](#55-requirements-discovery--gap-closure-engine)) — research, หา gap, ตั้งคำถามกลับ, แล้วเขียน user story, acceptance criteria (Given/When/Then), edge cases, Requirements Brief ลง `docs/specs/`
- **Memory:** `docs/standards/discovery.md` (เกณฑ์ DoR + รูปแบบ Gap Matrix)
- **Skill + anti-pattern:** `discover-gaps` (กันการเดาเงียบ, scope creep, acceptance criteria คลุมเครือ)
- **Self-verify:** Gap Matrix ไม่มี 🔴 ค้าง + acceptance criteria testable ก่อน handoff
- **Output:** spec ที่ "Definition of Ready" ครบ (Gap Matrix ปิด)
- **tools:** Read, Write, WebSearch (ดู benchmark/มาตรฐาน), Linear MCP (log issue/คำถาม), Sentry MCP (อ้าง production data), Notion MCP (sync ถ้าต้องการ)

### 6.2 Solution Architect — `architect`
- **ทำ:** ออกแบบ data model (Prisma schema), API contract, component boundary, เลือก pattern, เขียน **ADR** ลง `docs/adr/`, ประเมิน trade-off ที่ต้องให้มนุษย์ตัดสิน
- **Memory:** `docs/standards/architecture.md` + ADR เดิม (อ่านก่อนตัดสินใจ)
- **Skill + anti-pattern:** checklist เลือก pattern + กัน anti-pattern (N+1 query, over-engineering, premature abstraction)
- **Self-verify:** review ADR เทียบ data model จริง + ตรวจผลกระทบ migration ก่อน handoff
- **Output:** design doc + ADR + รายการ task ทางเทคนิค
- **tools:** Read, Write, Bash (ดู schema/โครงปัจจุบัน), Figma MCP (อ่าน design ถ้ามี)

### 6.3 UX / Design System Guardian — `ux-designer`
> เป็นทั้งคนออกแบบ **และ** ผู้ถือกฎ design system — มีอำนาจ "block" PR ที่ละเมิดกฎ (ดู [§8.7](#87-design-system-governance--anti-slop-gate)) บทบาทนี้คือคำตอบของปัญหา "UI slop / ไม่สร้างสรรค์"
- **ทำ:** เจ้าของมิติ UX ใน Discovery (ต้องออก **Design Brief** ก่อน build), ดูแล `DESIGN.md` (tokens + rationale) เป็น single source of truth, แปลง requirement → UI flow/states, ทำ design-to-code ผ่าน Figma MCP (`get_design_context`, `generate_design`, Code Connect), บังคับ token + a11y, และรัน anti-slop audit
- **กำกับใคร:** ทั้ง **คนออกแบบ** (ให้ยึด token/theme เดียวกัน) และ **frontend-engineer** (ห้าม hardcode ค่า ห้ามสร้าง component นอกระบบ)
- **Output:** Design Brief + component spec + a11y/anti-slop report
- **tools:** Figma MCP, Read, Write, Bash (รัน design lint/audit), Skills: `hallmark`, `web-design-guidelines`, `accessibility`

### 6.4 Frontend Engineer — `frontend-engineer`
- **ทำ:** สร้าง/แก้ component ใน `app/`, `components/` ด้วย Next.js App Router + TS + Tailwind + shadcn, ทำ i18n (`locales/`), เขียน component test
- **มาตรฐาน:** strict TS, server/client component ถูกต้อง, ไม่มี `any`, a11y ผ่าน, **อ่าน `DESIGN.md` ทุกครั้งก่อนทำ UI — ใช้ได้เฉพาะ token/component ในระบบ ห้าม hardcode สี/ระยะ/เงา ห้ามประดิษฐ์ component ใหม่นอกระบบ** (ถ้าต้องมีใหม่ ต้องผ่าน Design System Guardian ก่อน)
- **ต้องผ่าน Design Quality Gate** ([§8.7](#87-design-system-governance--anti-slop-gate)) ก่อนเสนอ merge
- **tools:** Read, Write, Edit, Bash (lint/build/test/design-lint), Skills: `hallmark`, `web-design-guidelines`, `accessibility`, `react-best-practices`

### 6.5 Backend Engineer — `backend-engineer`
- **ทำ:** API routes/server actions, Prisma schema + migration, business logic, auth (NextAuth), validation (zod), error handling
- **Memory:** `docs/standards/api.md` (อิง `schema/api-schema.json` + `types/api.ts` ที่มีอยู่)
- **Skill + anti-pattern:** zod-validation ทุก boundary + error-handling patterns (กัน unhandled error, secret leak, missing authz)
- **Self-verify:** contract test ผ่าน + ตรวจ migration reversible + รัน endpoint จริงก่อน handoff
- **มาตรฐาน:** input validation ทุก endpoint, ไม่รั่ว secret, migration reversible
- **tools:** Read, Write, Edit, Bash (prisma/test)

### 6.6 QA / Test Engineer — `qa-engineer`
- **ทำ:** เขียน/ขยาย unit + integration + e2e test (Playwright), ตรวจ acceptance criteria ครบ, รัน coverage, รายงาน defect กลับเป็น ticket ย่อย
- **Memory:** `docs/standards/qa.md` (test strategy + เกณฑ์ coverage)
- **Skill + anti-pattern:** test-pattern skill (กัน flaky test, test ที่ไม่ assert จริง, mock เกินจำเป็น)
- **Self-verify:** รัน test suite จริง + coverage ≥80% บนโค้ดใหม่ ก่อน handoff
- **Output:** ผล test + coverage + defect list
- **tools:** Read, Write, Bash (test runner), Edit
> หมายเหตุ: โปรเจกต์ยังไม่มี test runner — งานแรกของ role นี้คือ setup Vitest (unit/integration) + Playwright (e2e) + เพิ่ม script `test`/`typecheck` ใน `package.json`

### 6.7 Security Reviewer — `security-reviewer`
- **ทำ:** static review (OWASP Top 10), ตรวจ authz/authn, secret leak, dependency vuln (`npm audit`), injection, SSRF, ใช้ skill `security-review`
- **Memory:** `docs/standards/security.md` (OWASP checklist + กฎ secret/authz)
- **Skill + anti-pattern:** `security-review` (มีอยู่แล้ว) + รายการ anti-pattern (route seed/scrape เปิด public, missing authz, hardcoded secret)
- **Self-verify:** รัน `npm audit` จริง + scan diff ก่อนสรุป — 0 critical finding
- **Output:** security report + ระดับความเสี่ยง (block ได้ถ้า critical)
- **tools:** Read, Bash, Grep, Skill `security-review`, Sentry MCP (ดู error/abuse จริง)

### 6.8 DevOps / Release — `devops-release`
- **ทำ:** ดูแล CI (GitHub Actions), env/secret config ต่อ env (SIT/UAT/prod), Vercel deploy, prisma migrate deploy, **promote ข้าม env (SIT → UAT → prod)**, versioning/changelog, rollback plan, release train
- **Memory:** `docs/standards/ops-runbook.md` (deploy + promote + rollback ต่อ env)
- **Skill + anti-pattern:** `promote-release` + release-checklist (กัน deploy ข้าม env, ขึ้น prod โดยไม่ผ่าน UAT, ไม่มี rollback, secret หลุด)
- **Self-verify:** smoke/health check ผ่านต่อ env + verify URL จริง + เฝ้า Sentry หลัง release ก่อนปิดงาน
- **Gate:** บังคับ promotion rules ([§9.5](#95-environments--release-promotion-sit--uat--production)) — prod ต้องผ่าน UAT sign-off (G4) + go-live approval (G5)
- **Output:** release checklist + deploy result
- **tools:** Read, Write, Bash (git/gh CLI), Sentry MCP (post-release monitoring)
> หมายเหตุ: ใช้ `git` + `gh` CLI ผ่าน shell แทน GitHub connector — เร็วและคุมได้กว่า; งานแรกคือเพิ่ม `.github/workflows/ci.yml` รัน gate ฝั่ง server

### 6.9 Tech Writer — `tech-writer`
- **ทำ:** อัปเดต README, API docs, changelog, ADR index, คู่มือผู้ใช้
- **tools:** Read, Write, Edit, Skill `docx`/`pdf` (ถ้าต้องส่งเอกสารทางการ)

### 6.10 Code Reviewer (gate)
- ใช้ skill `review` ในขั้น Gate G3 — ตรวจ diff เทียบ spec + standards ก่อนเสนอ merge ให้คุณ

---

## 7. Skills

Skill = ขั้นตอนมาตรฐานที่หลาย agent เรียกใช้ซ้ำ ทำให้พฤติกรรมสม่ำเสมอและ track ได้

| Skill | ทำอะไร | ใครเรียก |
|---|---|---|
| `create-ticket` | สร้างไฟล์ ticket ใน `docs/backlog/` ตาม template + เพิ่ม entry ใน `STATUS.json` | orchestrator, PO |
| `discover-gaps` | รัน Discovery loop §5.5: research ขนาน → สร้าง Gap Matrix ทุกมิติ → รวมคำถามกลับเป็นรอบ → วนจนปิด gap | orchestrator, PO, architect, ux |
| `write-spec` | แปลง requirement → Requirements Brief + spec + acceptance criteria ตามรูปแบบ DoR | PO, architect |
| `update-status` | อัปเดตสถานะ ticket ใน `STATUS.json` แบบ atomic + timestamp + actor | ทุก agent |
| `run-quality-gate` | รัน lint + typecheck + test + coverage + audit แล้วสรุป pass/fail | QA, FE, BE, orchestrator |
| `open-pr` | สร้าง branch, commit ตาม convention, เปิด PR พร้อม checklist | FE, BE, devops |
| `promote-release` | deploy/promote ข้าม env (SIT→UAT→prod) + migrate + smoke test + tag + rollback ตาม promotion rules §9.5 | devops |
| `security-review` (มีอยู่แล้ว) | สแกน security ของ diff ปัจจุบัน | security-reviewer |
| `review` (มีอยู่แล้ว) | รีวิว PR เทียบ standards | code reviewer gate |

**Anti-slop / design skills (ดึงจาก open-source — ดู [§14 References](#14-references--proven-patterns)):**

| Skill | ทำอะไร | source |
|---|---|---|
| `hallmark` | บังคับให้ UI ไม่เป็น "slop" (เลี่ยง Inter-only, purple gradient, nested cards) ผ่าน 4 verbs (Build/Audit/Redesign/Study) + 65 slop-test gates + self-critique | `nutlope/hallmark` (Together AI, MIT) |
| `web-design-guidelines` | ตรวจ semantic HTML, focus states, image dimensions, ข้อผิดพลาด FE ที่เลี่ยงได้ | vercel-labs/agent-skills |
| `accessibility` + `core-web-vitals` | WCAG + LCP/INP/CLS | addyosmani/web-quality-skills |
| `react-best-practices` | เลี่ยง re-render เกิน, client work หนัก | vercel-labs/agent-skills |

ติดตั้งใน Claude Code ได้ที่ `~/.claude/skills/<name>/` หรือ `.claude/skills/<name>/` (project) แต่ละ skill = `SKILL.md` พร้อมคำสั่ง/สคริปต์ที่จำเป็น

### 7.1 Built-in skills/commands ที่ "wire" เข้าทีม (ไม่ต้องเขียนเอง)

| ของที่มีในระบบ | ใช้กับ | ยกระดับมาตรฐาน |
|---|---|---|
| `review` | Code Reviewer (G3) | รีวิว PR เทียบ standards อัตโนมัติก่อน merge |
| `security-review` | security-reviewer | สแกน security ของ diff เป็น gate |
| `init` | bootstrap `CLAUDE.md` | generate standards memory จาก codebase จริง |
| `skill-creator` (+ eval framework) | สร้าง/ทดสอบ agents+skills ของเรา | `run_eval.py` + `grader.md` + `quick_validate.py` → **พิสูจน์ว่า agent ทำงานตามมาตรฐานจริง ไม่ใช่ vibe** + `improve_description.py` คุม trigger |
| `docx` / `pdf` / `xlsx` | tech-writer, QA, PO | release note / UAT sign-off / security & test report เป็นเอกสารมาตรฐาน |
| `schedule` | ทั้งทีม | nightly regression, daily digest, เตือน review ค้าง |
| `consolidate-memory` | ดูแล `docs/standards/*` | กัน memory file ล้าสมัย/ซ้ำ |

> หลักการ: ของที่มีอยู่แล้วให้ **wire เข้า gate/role** ก่อน เขียน skill ใหม่เฉพาะส่วนที่ไม่มี (`discover-gaps`, `promote-release`, `run-quality-gate`, `update-status`)

---

## 8. Governance & Quality Gates

มาตรฐานทั้งหมดเก็บใน `docs/standards/` และอ้างจาก `CLAUDE.md` เพื่อให้ทุก agent ยึดถือ

### 8.1 Definition of Ready (DoR) — ก่อนเริ่ม build
- **Gap Matrix ปิดครบทุกมิติ** (Business/Functional/Technical/UX/Data/Security/Ops/Risk) — ไม่มี 🔴 open ค้าง ตาม [§5.5](#55-requirements-discovery--gap-closure-engine)
- มี Requirements Brief + user story + acceptance criteria (Given/When/Then)
- ระบุ non-functional req (performance, a11y, i18n, security)
- มี design/ADR สำหรับงานที่กระทบ architecture
- แตกเป็น task ที่ทำเสร็จได้ใน 1 PR เล็ก

### 8.2 Definition of Done (DoD) — ก่อนปิด ticket
- **Self-verify ผ่าน (ทุก role):** agent ตรวจงานตัวเองด้วย "คำสั่งจริง" ของ domain ตน ก่อน handoff — ห้ามส่งงานที่ยังไม่ verify (ดู [§2.5](#25-team-wide-adoption-pattern-สูตร-3-ส่วน))
- โค้ดผ่าน **ทุก** gate ด้านล่าง (ตรวจด้วยคำสั่งจริง)
- acceptance criteria ผ่านครบ มี test คุม
- เอกสาร/changelog อัปเดต
- `STATUS.json` = `done` พร้อม PR link

### 8.3 Quality Gates (บังคับ — skill `run-quality-gate`)

| Gate | เครื่องมือ (CampVibe) | เกณฑ์ผ่าน |
|---|---|---|
| Lint | `npm run lint` (eslint) | 0 error |
| Type check | `tsc --noEmit` | 0 error, ห้าม `any` ที่ไม่ justify |
| Unit/Integration | `npm test` | ผ่านทั้งหมด |
| Coverage | coverage report | ≥ 80% บนโค้ดใหม่ |
| E2E | Playwright | flow หลักผ่าน |
| Build | `npm run build` | สำเร็จ (รวม `prisma generate`) |
| Dependency audit | `npm audit --omit=dev` | 0 high/critical |
| Security review | skill `security-review` | 0 critical finding |

### 8.4 Code Standards (สรุป — รายละเอียดใน `docs/standards/code.md`)
- TypeScript strict, ไม่มี implicit any, ใช้ zod validate ที่ boundary
- Next.js App Router: แยก server/client component ถูกต้อง, ไม่เรียก DB จาก client
- ตั้งชื่อ/โครงสร้างตามที่มีใน repo, PR ≤ 400 บรรทัด
- Commit แบบ Conventional Commits (`feat:`, `fix:`, `chore:`...)

### 8.5 Security Standards
- ไม่ commit secret (ใช้ `.env`, ตรวจด้วย hook), least privilege, authz ทุก mutation
- ตาม OWASP Top 10, validate/sanitize ทุก input, parametrized query (Prisma)
- รัน `npm audit` + secret scan ใน CI

### 8.6 Hooks บังคับ
ตั้งใน `.claude/settings.json`: `PreToolUse`/`pre-commit` รัน lint + typecheck + secret scan — ถ้าไม่ผ่าน **block** การ commit

### 8.7 Design System Governance & Anti-Slop Gate

> **นี่คือคำตอบโดยตรงของปัญหา "UI slop / ไม่สร้างสรรค์"** — เปลี่ยน design system จาก "ไฟล์ Figma ที่ไม่มีใครบังคับ" ให้เป็น "กฎที่ enforce ได้จริงทั้งคนออกแบบและ FE" หลักการ (จาก Shopify/Uber/Vercel/Google ดู [§14](#14-references--proven-patterns)): *"A design system without enforcement is just a Figma file."*

**รากของปัญหา slop:** LLM ถูกเทรนบน template ชุดเดียวกัน จึงคายของเหมือนกันหมด — ฟอนต์ Inter, gradient ม่วง-น้ำเงิน, การ์ดซ้อนการ์ด, โครง hero→features→testimonials→CTA ที่คาดเดาได้ แก้ได้ด้วยการ **บังคับ constraint + memory + การตรวจ**

**กลไก 3 ชั้น:**

1. **Memory — `DESIGN.md` (single source of truth)** ตามมาตรฐาน Google Labs DESIGN.md: YAML front matter เก็บ design facts (สี OKLCH, typography, spacing, radius, component tokens) + Markdown อธิบาย rationale ("ควรรู้สึกอย่างไร", "สีไหนใช้ตอนไหน", "อะไรห้ามทำ") ทั้ง `ux-designer` และ `frontend-engineer` อ่านไฟล์นี้ก่อนทำงานทุกครั้ง → ไม่มี drift ข้าม session

2. **Constraint — Design Brief ก่อน build** ทุกงาน UI ต้องมี Brief 5 ช่อง: (1) user job + success state, (2) screen inventory (component/action ที่ต้องมี), (3) token constraints (palette/type/spacing/elevation), (4) interaction states ต่อ component (empty/loading/error/hover/focus), (5) reference 1 ตัวที่จับ brand tone — บังคับให้ระบุก่อน ปิด gap "ไม่สร้างสรรค์" ตั้งแต่ต้นทาง

3. **Verify — Design Quality Gate (บังคับก่อน merge)** เพิ่มเข้า quality gate §8.3:

   | Check | เครื่องมือ | เกณฑ์ |
   |---|---|---|
   | Token coverage / no hardcoded values | design lint (เช่น `@google/design.md lint`, custom eslint rule) | ต้องใช้ token เท่านั้น |
   | Anti-slop audit | skill `hallmark audit` (65 anti-patterns) | 0 high-severity |
   | A11y | skill `accessibility` (WCAG) | ผ่าน |
   | Visual self-critique | agent ถ่าย screenshot เทียบ Design Brief แล้ววิจารณ์ตัวเอง + แก้ลูปอย่างน้อย 1 รอบ | ตรง brief |
   | Component reuse | ตรวจว่าไม่สร้าง component ใหม่นอกระบบโดยไม่อนุมัติ | pass |

   **บังคับแบบ Uber-style:** ถ้า fail → block merge + เปิด Linear ticket อัตโนมัติให้แก้ ห้ามข้าม

**กฎที่ผูกคนออกแบบกับ FE:** การเปลี่ยน token/component ทำได้ที่เดียวคือผ่าน `ux-designer` (Guardian) ลง `DESIGN.md` → designer ออกแบบบน token ชุดเดียว, FE ใช้ token ชุดเดียวกัน → ทั้งสองฝั่งสอดคล้องเสมอ และ diff ของ design ตรวจสอบย้อนได้เหมือน code

### 8.8 Team-wide Rules (Cross-cutting)

กฎ 4 ข้อที่ใช้กับ **ทุก** role ไม่ใช่เฉพาะ design:

1. **แยกเฟส Planning / Dev เข้ม (BMAD-style)** — ห้ามเขียน production code ก่อน spec (G1) + design (G2) ผ่าน orchestrator บล็อกการ dispatch dev จนกว่าสองเฟสแรกจะ approve
2. **Output schema สม่ำเสมอทุก sub-agent** — ทุก handoff คืนรูปแบบเดียวกัน: `{ticket_id, status, artifacts[], gates{}, self_verify{}, summary, next}` → orchestrator merge/track ง่าย (Claude Code best practice)
3. **Self-verify เป็น DoD ของทุก role** — ดู [§8.2](#82-definition-of-done-dod--ก่อนปิด-ticket)
4. **Gate fail → auto-file Linear ticket (Uber-style)** — ทุก gate (quality/design/security) เมื่อ fail ต้องเปิด Linear ticket อัตโนมัติ + อัปเดต `STATUS.json` ห้ามข้ามเงียบ

---

## 9. Lifecycle Workflow

State machine ของแต่ละ ticket (สะท้อนใน `STATUS.json`):

```
backlog → ready → in_design → [G2 approve] → in_dev → in_test
        → in_security → in_review → [G3 approve] → merged
        → deploying_sit → on_sit → on_uat → [G4 UAT sign-off]
        → [G5 go-live] → released → done
```

ลำดับเต็มเมื่อคุณสั่ง `/new-feature "..."`:

1. **Orchestrator** intake → รัน **Discovery & Gap-Closure loop** ([§5.5](#55-requirements-discovery--gap-closure-engine)): research ขนาน (PO/Architect/UX/Security) → สร้าง Gap Matrix → ถามกลับเป็นรอบจนปิด gap ทุกมิติ → ออก Requirements Brief
2. **PO** สรุปเป็น spec + acceptance criteria (`write-spec`) → ticket เข้าสถานะ `ready` (DoR ครบ)
3. **Gate G1:** คุณอนุมัติ scope/backlog (จะเห็น Gap Matrix = ปิดครบแล้ว)
4. **Architect/UX** ออกแบบ → ADR + design → `in_design`
5. **Gate G2:** คุณอนุมัติ design
6. **FE/BE** build (ขนานตาม dependency) → `in_dev` → เปิด PR (`open-pr`)
7. **QA** test + coverage → `in_test`; **Design Quality Gate** (§8.7) สำหรับงาน UI: token/a11y/anti-slop + visual self-critique; defect → ticket ย่อยกลับเข้า loop
8. **Security** review → `in_security`
9. **run-quality-gate** ต้องเขียว → **Reviewer** รีวิว → `in_review`
10. **Gate G3:** คุณอนุมัติ merge → `merged`
11. **DevOps** (`promote-release`) auto-deploy → **SIT** + รัน smoke/integration → `on_sit` (ไม่ต้องอนุมัติ)
12. **DevOps** promote → **UAT** (รัน migration บน UAT DB) → `on_uat`
13. **Gate G4 (UAT sign-off):** คุณทดสอบบน UAT แล้วอนุมัติ
14. **Gate G5 (Production go-live):** คุณอนุมัติ → promote ขึ้น **prod** (เดี่ยว/release train) + tag เวอร์ชัน + changelog → `released`
15. **DevOps** เฝ้า Sentry หลัง deploy; error → เปิด bug ticket กลับเข้า loop → `done`
16. **Orchestrator** สรุปผล + อัปเดต artifact

> รายละเอียด environment + การ promote ดู [§9.5](#95-environments--release-promotion-sit--uat--production)

ทุก transition → เรียก `update-status` → artifact อัปเดต real-time

---

## 9.5 Environments & Release Promotion (SIT → UAT → Production)

> **คำถามที่ว่า "เป็น skill หรือ rule?" — เป็นทั้งคู่:**
> - **Skill `promote-release`** = *วิธีทำ* (DevOps agent รันจริง: build, deploy ไป env, รัน smoke test, tag)
> - **Promotion Rule (governance)** = *นโยบายบังคับ*: ต้องผ่าน SIT → UAT และได้อนุมัติก่อนขึ้น prod ห้ามข้าม ห้าม deploy prod ตรงจาก dev

### 9.5.1 Environments

| Env | ใช้ทำอะไร | deploy เมื่อ | ใครอนุมัติ | DB |
|---|---|---|---|---|
| **local/dev** | พัฒนา + test ในเครื่อง | ตลอดเวลา | — | dev DB |
| **SIT** (System Integration Testing) | รวมโค้ดทุก ticket + ทดสอบ integration/e2e อัตโนมัติ | **อัตโนมัติ** หลัง merge (G3) | ไม่ต้อง (แค่ smoke test ต้องเขียว) | SIT DB แยก |
| **UAT** (User Acceptance Testing) | ให้คุณ/ผู้ใช้จริงทดสอบยอมรับ | promote จาก SIT ที่เขียว | **Gate G4 (คุณ)** | UAT DB แยก |
| **Production** | ผู้ใช้จริง | promote จาก UAT ที่อนุมัติ | **Gate G5 (คุณ)** | prod DB |

**CampVibe (Vercel) mapping:** ใช้ Vercel environments + DATABASE_URL แยกต่อ env — SIT/UAT เป็น deployment แยก (branch `develop` → SIT, `release/*` → UAT, tag บน `main` → prod) แต่ละ env มี env-vars/DB ของตัวเอง; รัน `prisma migrate deploy` ต่อ env

### 9.5.2 โหมดการ promote (เลือกได้)

- **Per-feature (continuous):** แต่ละ ticket ไหลผ่าน SIT→UAT→prod เอง — เร็ว เหมาะงานเล็ก/ความเสี่ยงต่ำ
- **Release train (เป็นรอบ):** รวบหลาย ticket เป็น `release/x.y.0` ปล่อยพร้อมกันตามรอบ (เช่นรายสัปดาห์) — คุมง่าย เหมาะ production จริง

> ค่าเริ่มต้นที่แนะนำ: ขึ้น SIT แบบ continuous (เห็นของรวมเร็ว) แต่ขึ้น **prod เป็น release train** เพื่อคุมความเสี่ยง

### 9.5.3 Skill `promote-release` (DevOps)

```
promote-release <ticket|release> --to <sit|uat|prod>
  1. ตรวจ pre-condition: env ก่อนหน้าเขียว (เช่น prod ต้องผ่าน UAT sign-off แล้ว)
  2. build + prisma migrate deploy บน DB ของ env เป้าหมาย
  3. deploy (Vercel)
  4. รัน smoke test + health check
  5. tag เวอร์ชัน + อัปเดต changelog (เฉพาะ prod)
  6. อัปเดต STATUS.json + Linear; ถ้า fail → rollback + เปิด ticket
  7. หลัง prod: เฝ้า Sentry N นาที — error spike → auto-rollback + แจ้ง
```

### 9.5.4 Promotion Rules (บังคับ)

1. ห้าม deploy prod โดยไม่ผ่าน SIT + UAT (enforce ใน pipeline + skill pre-condition)
2. prod และ UAT ต้องมี **human approval** (G5/G4) เสมอ
3. ทุก prod release ต้องมี **rollback plan + tag + changelog**
4. migration ต้อง reversible และทดสอบบน SIT/UAT ก่อน prod
5. fail ที่ env ใด → หยุด promote + เปิด Linear ticket อัตโนมัติ (ดู [§8.8](#88-team-wide-rules-cross-cutting))

---

## 10. Real-time Progress Tracking

ใช้ **Cowork live artifact** (ตามที่เลือก) อ่านจาก `STATUS.json` ใน repo เป็น single source of truth

### 10.1 `STATUS.json` schema

```json
{
  "project": "campvibe",
  "updated_at": "2026-06-20T10:00:00Z",
  "epics": [
    {
      "id": "EPIC-001",
      "title": "Host team management",
      "status": "in_progress",
      "tickets": [
        {
          "id": "TICKET-0001",
          "title": "เพิ่มสมาชิกทีมเข้า host dashboard",
          "owner": "backend-engineer",
          "status": "in_test",
          "gates": { "lint": "pass", "typecheck": "pass",
                     "test": "pass", "coverage": "82%",
                     "security": "pending" },
          "pr": "https://github.com/.../pull/12",
          "updated_at": "2026-06-20T09:50:00Z",
          "history": [
            {"ts": "...", "actor": "po", "event": "spec ready"},
            {"ts": "...", "actor": "backend-engineer", "event": "PR opened"}
          ]
        }
      ]
    }
  ]
}
```

### 10.2 Dashboard artifact
- เป็นหน้า HTML ที่ render board แบบ kanban ตามสถานะ + แถบ gate สี (เขียว/แดง/รอ)
- มีปุ่ม Reload (ในตัวอยู่แล้ว) ดึง `STATUS.json` ล่าสุด — เห็นความคืบหน้าของทุก sub-agent
- แสดง: % เสร็จต่อ epic, ticket ที่ block, gate ที่ fail, env ปัจจุบัน (SIT/UAT/prod), รายการรออนุมัติ (G1–G5)
- สร้างได้ด้วย `create_artifact` หลัง `STATUS.json` มีข้อมูลจริง (จะทำในขั้น setup)

> หมายเหตุ: ใช้ **Linear เป็น source of truth** สำหรับ tracking (artifact ดึงสดจาก Linear) และ mirror สรุปลง `STATUS.json` ใน repo ได้

### 10.3 Gate Review — กดเข้า ticket แล้วรีวิวได้ (ไม่ใช่แค่ดู)

แต่ละ gate ที่ต้องให้มนุษย์อนุมัติ ต้องมี **"Gate Review Packet"** ในตัว ticket — agent โพสต์เป็น description/comment ให้คุณกดเข้าไปแล้วรีวิว + ตัดสินใจได้ทันที ไม่ต้องไปไล่หาเอง

| Gate | สิ่งที่อยู่ใน packet (กดเข้าไปเห็น) | คุณตัดสินใจ |
|---|---|---|
| **G1 Scope** | Requirements Brief + Gap Matrix (ปิดครบ) | Approve scope / ส่งกลับ |
| **G2 Design** | ADR + design + DESIGN.md diff + states | Approve design / request changes |
| **G3 Merge** | PR diff + ผล quality gate (lint/type/test/coverage) + `review` output + security + design audit + SIT preview URL | Approve merge / request changes |
| **G4 UAT** | UAT URL + acceptance checklist + release note (draft) | Sign-off / reject |
| **G5 Go-live** | changelog + rollback plan + migration summary | Go-live / hold |

**กลไก:** ทุก gate agent โพสต์ packet ตาม template (links: PR, preview URL, gate results, artifacts) + checklist + ช่อง decision การ "Approve" = เปลี่ยน status/label ใน Linear (เช่น เอา label `awaiting-you` ออก → agent เดินต่อ); "Request changes" = คอมเมนต์ → agent วนกลับ

### 10.4 Human Action Queue — "งานที่คุณต้องทำ"

หน้า dashboard มีแถบบนสุด **"งานที่คุณต้องทำ"** รวมทุกอย่างที่ค้างรอคุณ ไม่ต้องไล่หา:

- ticket ที่ติด label **`awaiting-you`** (รอ approve ที่ gate ใด ๆ G1–G5)
- ticket priority **Urgent** หรือที่ assign ให้คุณ
- กดเข้าไป → เห็น Gate Review Packet → ตัดสินใจ

> convention: เมื่อ agent ถึง gate ที่ต้องมนุษย์ → ใส่ label `awaiting-you` + โพสต์ packet; พอคุณ approve → เอา label ออก, ticket ไหลต่อ

### 10.5 Real-time: webhook ได้ไหม?

- **ตรง ๆ ใน Cowork artifact: ไม่ได้** — artifact รันใน sandbox รับ inbound webhook ไม่ได้ (ไม่มี server) โมเดลคือ **pull** (ดึงตอนเปิด + ปุ่ม Reload)
- **ใกล้ real-time ที่ทำได้จริง:** artifact **poll อัตโนมัติ** (เช่นทุก 45 วินาทีขณะเปิดหน้าอยู่) → เห็นการเปลี่ยนแปลงเองโดยไม่ต้องกด
- **Push จริงด้วย webhook:** ต้องมี service เล็ก ๆ ภายนอก (เช่น serverless function / Linear webhook → คิวงาน) ซึ่งเป็นงาน infra แยก — ทำเป็น DevOps ticket ได้ถ้าต้องการ
- **แจ้งเตือนเชิงรุก:** ใช้ **scheduled task** (เช่น เช็คทุกชั่วโมง/ทุกเช้า) สรุป "งานรอคุณ" แล้วเตือน — เป็น push ที่ทำได้ในระบบนี้เลย

---

## 11. ขั้นตอน Setup

1. **Clone repo ลงเครื่อง** ในโฟลเดอร์ที่เลือก:
   ```bash
   git clone https://github.com/Thawatchai-Petkaew/campvibe.git
   ```
2. **วางเอกสารนี้** ที่ root (`AI_SDLC_TEAM_ARCHITECTURE.md`)
3. **รัน Bootstrap Prompt** ([§12](#12-bootstrap-prompt)) เพื่อให้สร้างไฟล์ `.claude/agents/*`, `.claude/skills/*`, `CLAUDE.md`, `STATUS.json`, `docs/standards/*`
4. **Commit โครงสร้าง agent**:
   ```bash
   git checkout -b chore/ai-sdlc-setup
   git add .claude CLAUDE.md STATUS.json docs/
   git commit -m "chore: bootstrap AI-first SDLC agent team"
   ```
5. **เปิด PR** และ merge เป็น baseline
6. เริ่มงานจริง: `/new-feature "<requirement ของคุณ>"`

---

## 12. Bootstrap Prompt

> Copy ข้อความด้านล่างนี้ไปสั่ง Claude (ในโปรเจกต์ที่ clone แล้ว) เพื่อสร้างไฟล์ agent/skill จริง — แก้ค่าในวงเล็บก่อนใช้

```
คุณคือผู้ตั้งค่า AI-first SDLC agent team สำหรับ repo CampVibe
(Next.js App Router + TypeScript + Prisma/PostgreSQL + Tailwind/shadcn + NextAuth, deploy Vercel)
อ่าน AI_SDLC_TEAM_ARCHITECTURE.md ที่ root เป็นแหล่งอ้างอิงหลัก แล้วสร้างไฟล์ต่อไปนี้:

1. CLAUDE.md ที่ root — สรุปมาตรฐาน code/security/QA (§8), กฎ "อย่าข้าม gate",
   convention การ commit/branch/PR, และ pointer ไป docs/standards/

2. .claude/agents/*.md ครบ 10 role ตาม §5–6 แต่ละไฟล์มี frontmatter
   (name, description, tools, model) + system prompt ที่ระบุ: หน้าที่, input/output,
   handoff contract (รับ ticket_id → ทำงาน → update STATUS → คืน summary),
   สูตร 3 ส่วน (memory file ที่ต้องอ่าน + skill + self-verify ด้วยคำสั่งจริง),
   และ gate ที่เกี่ยวข้อง orchestrator ใช้ model opus, agent อื่นใช้ sonnet

3. .claude/skills/*/SKILL.md ตาม §7: create-ticket, discover-gaps, write-spec,
   update-status, run-quality-gate, open-pr — พร้อมสคริปต์/คำสั่งจริงของ CampVibe
   (npm run lint, tsc --noEmit, npm test, npm run build, npm audit)
   โดย discover-gaps ต้อง implement Discovery loop §5.5 (Gap Matrix ทุกมิติ +
   การถามกลับเป็นรอบ) และต้องบล็อกไม่ให้ผ่าน G1 จนกว่าจะไม่มี gap 🔴 ค้าง

4. .claude/commands/: new-feature.md, status.md, release.md

5. .claude/settings.json — hook บังคับ lint+typecheck+secret-scan ก่อน commit

6. STATUS.json เริ่มต้น (ว่าง) ตาม schema §10.1

7. docs/standards/ ครบทุก role (discovery, architecture, api, code, qa, security,
   ops-runbook) เป็น "memory file" ที่แต่ละ agent อ่านก่อนทำงาน +
   docs/backlog/, docs/adr/, docs/specs/ พร้อม template ticket/spec/ADR
   *** ทุก role ต้องมีครบสูตร 3 ส่วน (§2.5): memory + constrained skill + self-verify ***
   *** ใส่ cross-cutting 4 ข้อ (§8.8): planning/dev เข้ม, output schema เดียว,
       self-verify ใน DoD, gate fail → auto-file Linear ticket ***

8. DESIGN.md (Google Labs DESIGN.md standard) — scan codebase ปัจจุบัน
   (shadcn tokens, Tailwind config, สี/typography/spacing ที่ใช้จริง) ออกมาเป็น
   tokens + rationale; ติดตั้ง anti-slop skills (hallmark, web-design-guidelines,
   accessibility, react-best-practices) และเพิ่ม Design Quality Gate (§8.7)
   เข้า run-quality-gate (token lint + hallmark audit + a11y + visual self-critique)

9. Environments & promotion (§9.5): skill promote-release,
   .github/workflows/{ci.yml, promote.yml}, ops-runbook ต่อ env,
   ตั้ง Vercel env แยก SIT/UAT/Production (DATABASE_URL แยก) +
   บังคับ promotion rules (prod ต้องผ่าน SIT+UAT, มี G4 UAT sign-off + G5 go-live)

ข้อบังคับ: ก่อนเริ่ม build ทุกงานต้องผ่าน Discovery & Gap-Closure loop (§5.5) —
ห้ามเดาเงียบ ต้องยก gap ทุกมิติ (Business/Tech/UX/NFR) เป็นคำถามแล้วถามกลับเป็นรอบ
จนปิดครบ (ไม่มี 🔴) ก่อนผ่าน G1; ทุก agent ต้องเขียน trace ลง ticket,
ต้องผ่าน quality gate จริงก่อนปิดงาน, และต้องหยุดขออนุมัติจากมนุษย์ที่ 5 gate
(Scope, Design, Merge, UAT sign-off, Production go-live); deploy SIT อัตโนมัติ,
prod ต้องผ่าน SIT+UAT เสมอ (promotion rules §9.5)
หลังสร้างเสร็จ ให้สรุปไฟล์ที่สร้างและเสนอขั้นตอน commit
```

---

## 13. Roadmap

- **Phase 0 (now):** เอกสารสถาปัตยกรรมนี้ + ตกลง gate/มาตรฐาน
- **Phase 1:** รัน Bootstrap Prompt สร้าง agents/skills/standards + commit baseline
- **Phase 2:** สร้าง Cowork live artifact dashboard อ่าน `STATUS.json`
- **Phase 3:** รัน feature จริงตัวแรกผ่าน full loop, ปรับ prompt agent จากผลที่ได้
- **Phase 4:** เพิ่ม CI (GitHub Actions) บังคับ gate ฝั่ง server + (optional) mirror ไป Notion/GitHub Projects
- **Phase 5:** วัดผล (lead time, gate pass rate, defect escape) แล้ว optimize agent/skill

---

*แก้ไขเอกสารนี้ต่อเนื่องได้ตามที่ทีม agent เรียนรู้ — เวอร์ชันถัดไปควรอัปเดต §6 (prompt ราย role) และ §8 (เกณฑ์ gate) ให้ตรงกับของจริงในโปรเจกต์*

---

## 14. References & Proven Patterns

สถาปัตยกรรมนี้อ้างอิงจากเฟรมเวิร์ก/แนวทางที่พิสูจน์แล้วในสนามจริง (research 2025–2026)

### 14.1 Multi-agent SDLC frameworks ที่สำเร็จ — เอามาเทียบ/ยืม pattern

- **BMAD-METHOD** (~49K stars) — "Breakthrough Method for Agile AI-Driven Development" ทีม agent มี role ครบ SDLC + แยกเฟส planning/dev ชัด สเปคก่อนโค้ด → ยืนยันแนวทาง spec-first + role-based ของเรา
- **MetaGPT** (~44.8K stars) — one-line requirement → user stories/architecture/API/code ผ่าน role PM/Architect/Engineer (encode SOP) → ยืนยัน orchestrator + sub-agent
- **GitHub Spec Kit** (~104K devs) — workflow `spec → plan → tasks → implement`, agent-agnostic, ใช้กับ Claude Code ได้ → ยืนยัน Discovery/spec gate (§5.5)
- **AWS Kiro** — IDE spec-driven 3 เฟส Requirements → Design → Tasks ก่อนเขียนโค้ด → ตรงกับ gate G1/G2 ของเรา
- **ChatDev / ChatDev 2.0 (DevAll)** — multi-agent orchestration platform
- **Claude Code orchestration patterns** — hub-and-spoke (coordinator แยกจาก executor), sub-agents vs agent teams (teams ถูกกว่า 3–5x สำหรับงานขนาน), บทเรียนสำคัญ: *"ให้ agent ตรวจงานตัวเองได้ (รัน test/เทียบ screenshot) คือสิ่งที่ leverage สูงสุด"*, ใช้ output schema สม่ำเสมอ, ให้ permission น้อยสุด + reversible + human checkpoint

> ข้อสังเกต: ทุกเฟรมเวิร์กเห็นตรงกันว่า **spec/discovery ก่อนโค้ด + human checkpoint + verification gate** คือหัวใจ ซึ่งคือสิ่งที่ §5.5, §8, §9 ของเราวางไว้

### 14.2 Anti-UI-slop & Design System Governance

- **Hallmark** (`nutlope/hallmark`, Together AI, MIT, ~1.8K stars) — skill กัน UI slop: 4 verbs (Build/Audit/Redesign/Study), 22 themes, 65 slop-test gates + pre-emit self-critique; ติดตั้ง `npx skills add nutlope/hallmark`
- **Impeccable** — skill design taste + commands (teach/document/shape/craft/critique/audit/polish), อ่าน/เขียน PRODUCT.md + DESIGN.md
- **Anthropic `frontend-design`**, **vercel-labs `web-design-guidelines` / `react-best-practices`**, **addyosmani `web-quality-skills`** (accessibility, core-web-vitals, performance, seo), **`make-interfaces-feel-better`**, **`userinterface-wiki`**
- **Google Labs `DESIGN.md` standard** — ไฟล์มาตรฐาน tokens + rationale, lint ได้ด้วย `npx @google/design.md lint DESIGN.md`, ใส่ใน CI ได้
- **Design tokens + OKLCH** — token = "จุดที่ AI หลีกเลี่ยงไม่ได้"; OKLCH คุม lightness/chroma/hue เพื่อ contrast/hierarchy ที่คาดเดาได้
- **Enforcement ในองค์กรจริง:** Shopify (coverage dashboard + lint), Uber (CI block merge เมื่อผิดกฎ + auto-file ticket), GitHub (a11y + token check ทุก PR), Figma MCP (สแกน codebase → rules file, Code Connect)

### 14.3 Sources

- [BMAD-METHOD (GitHub)](https://github.com/bmad-code-org/bmad-method) · [BMAD vs Spec Kit](https://medium.com/@mariussabaliauskas/a-comparative-analysis-of-ai-agentic-frameworks-bmad-method-vs-github-spec-kit-edd8a9c65c5e) · [What is BMAD (Reenbit)](https://reenbit.com/the-bmad-method-how-structured-ai-agents-turn-vibe-coding-into-production-ready-software/)
- [MetaGPT (GitHub)](https://github.com/FoundationAgents/MetaGPT) · [ChatDev (GitHub)](https://github.com/OpenBMB/ChatDev)
- [GitHub Spec Kit guide (IntuitionLabs)](https://intuitionlabs.ai/articles/spec-driven-development-spec-kit) · [Kiro vs Spec Kit](https://medium.com/system-design-mastery-series/aws-kiro-vs-github-spec-kit-the-honest-comparison-every-developer-needs-right-now-8284412d7668)
- [Claude Code: Orchestrate subagents (docs)](https://code.claude.com/docs/en/workflows) · [Agent teams vs sub-agents](https://www.mindstudio.ai/blog/claude-code-agent-teams-vs-sub-agents)
- [Hallmark: Stop AI UI slop](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) · [Fixing Visual AI Slop (Trilogy)](https://trilogyai.substack.com/p/fixing-visual-ai-slop) · [Claude Design: avoid AI slop](https://www.mindstudio.ai/blog/claude-design-avoid-ai-slop-design-system)
- [Your AI coding agent is only as good as your design system](https://medium.com/@aliafsah1988/your-ai-coding-agent-is-only-as-good-as-your-design-system-6055e4667fa9) · [Code is the source of truth, not Figma (Builder.io)](https://www.builder.io/blog/governance-beyond-figma) · [Design Systems & AI: MCP (Figma)](https://www.figma.com/blog/design-systems-ai-mcp/) · [Design tokens AI can read](https://learn.thedesignsystem.guide/p/design-tokens-that-ai-can-actually)
