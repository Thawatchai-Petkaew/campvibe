---
doc_id: ai-delivery-layer
title: AI Autonomous Delivery & Governance Layer
scope: allkons-marketplace
version: v1.0
status: ⚪ Draft
author: AI Orchestration
date: 2026-06-20
references:
  - docs/ai/roles/spec-forge-orchestration.md
  - docs/ai/roles/README.md
  - docs/ai/workflows/TEAM-COLLABORATION.md
  - docs/modules/template-module/ (documentation standard)
  - docs/ai/rules/atomic-data-architecture.md
---

# AI Autonomous Delivery & Governance Layer — allkons-marketplace

> **อ่านก่อน:** เอกสารนี้ **ไม่สร้างทีม AI ใหม่** — allkons มีระบบ spec + role + design system + doc standard ที่สมบูรณ์อยู่แล้ว (`/spec-forge`, roles, rules, skills, `template-module`) เอกสารนี้คือ **เลเยอร์ที่เพิ่มขึ้นมาบนของเดิม**: orchestrator ที่ขับงานครบ loop (spec → build → QA → SIT/UAT/prod), gate อนุมัติของมนุษย์, การ track งานแบบ live, และ env promotion — ทั้งหมดยึด **มาตรฐานเอกสารของ allkons** (`template-module` + status legend + AC format + CR-FORMAT)

**Status legend** (ตามมาตรฐาน allkons): ⚪ Draft / 🟡 In Review / 🟢 Final / 🔵 In Dev / ✅ Done / 🔴 Blocked / ⏸️ Deferred

## Change Log

| Version | Date | Changes | Author | Status |
|---------|------|---------|--------|--------|
| v1.0 | 2026-06-20 | Initial — retarget delivery/governance layer เข้า allkons; map roles/skills/gates; adopt doc standard | AI Orchestration | ⚪ Draft |

---

## 1. หลักการ: ใช้ของเดิม + เพิ่มเลเยอร์ delivery

allkons มี **Phase 1 (spec) + design system** ที่แข็งแรงผ่าน `/spec-forge` (PO → BSA → Tech Lead → UX) และ skills ราย role อยู่แล้ว สิ่งที่ยังขาดสำหรับ "ทีม agent ที่ทำงานครบ loop อัตโนมัติ" คือเลเยอร์ delivery + governance + tracking ที่ครอบบนของเดิม เอกสารนี้ระบุเฉพาะส่วนนั้น และห้าม reinvent สิ่งที่ allkons มีแล้ว

## 2. Mapping — concept ของเรา ↔ ของ allkons (ที่มีอยู่แล้ว)

| สิ่งที่เคยออกแบบ (CampVibe draft) | ของ allkons ที่มีอยู่แล้ว → ใช้อันนี้ | สถานะ |
|---|---|---|
| Discovery & Gap-Closure | `/spec-forge` + write-prd/write-brd cognitive protocol + **Usability Gates + BR Conflict detection** | ✅ มีแล้ว — ใช้ของเดิม |
| Orchestrator (spec phase) | `/spec-forge` (PO→BSA→Tech Lead→UX, Phase 1) + `/product-designer` | ✅ มีแล้ว |
| product-owner | role **PO** + `write-prd` | ✅ |
| business-analyst (BSA) | role **BSA** + `write-brd`, `write-srs`, `gen-permission-matrix` | ✅ |
| architect | role **Tech Lead** + `write-tech-spec`, `dev-api` | ✅ |
| ux-designer / Design Guardian | role **UX Designer** + `write-ux-spec` + **`ds` skill + DS-CONFORMANCE-CHECKLIST + registries + ui-quality-gate** | ✅ (design governance + anti-slop มีแล้ว) |
| frontend-engineer | role **UI Developer** + **Developer** + `write-frontend-spec`, `implement-feature` | ✅ |
| backend-engineer | role **Developer** + `dev-api`, `dev-test-api`, `api-testing` | ✅ |
| qa-engineer | role **QA Analyst** (`design-test-cases`) + **QA Automation** (`api-testing`) | ✅ |
| doc standard / ticket template | **`template-module`** (prd/brd/epic/srs/tech-spec/frontend-spec/test-spec + AC format + CR-FORMAT) | ✅ — เป็นมาตรฐานหลัก |
| atomic data / AI-ready | **`atomic-data-architecture.md` (Pixel·Set·Buffet)** mandate | ✅ |
| issue tracking | **`jira-sync` skill (Jira)** | ✅ — allkons ใช้ Jira |

## 3. สิ่งที่ "เพิ่มใหม่" (gap ที่ allkons ยังไม่มี)

`/spec-forge` หยุดที่ Phase 1 (specs) เลเยอร์นี้เติมส่วนที่เหลือของ loop:

1. **Delivery Orchestrator** — ขับงานต่อจาก spec: dispatch implement-feature → QA → promote ข้าม env จนถึง prod (ของเดิมจบที่ spec/prototype)
2. **Gate model G1–G5 (human approval)** — จุดที่มนุษย์อนุมัติ: G1 PRD/Scope, G2 Tech+UX spec (design), G3 Merge, G4 UAT sign-off, G5 Production go-live
3. **Environments & promotion** — SIT (auto หลัง merge) → UAT (G4) → Production (G5) + skill `promote-release` + promotion rules (prod ต้องผ่าน SIT+UAT)
4. **Live delivery tracking + Human Action Queue** — หน้า dashboard ดึงสดจาก **Jira** (ผ่าน jira-sync) แสดงสถานะทุก ticket, ใครทำอะไร, และ "งานที่รอคุณ" (รออนุมัติ gate)
5. **Gate Review Packet** — เมื่อกด ticket ที่ gate ใด ๆ เห็นทุกอย่างที่ต้องตัดสินใจในที่เดียว (อ้าง template ด้านล่าง)
6. **Production feedback loop** — ผูก error monitoring (เช่น Sentry) → error จริง → เปิด ticket กลับเข้า loop อัตโนมัติ

## 4. Full Loop (ผูกกับ skills ของ allkons)

```
requirement
  └─/spec-forge → PRD(PO) → BRD+Epics(BSA) → Tech Spec(Tech Lead) → UX Spec(UX)
                 [Usability Gates + BR conflicts ของ allkons]
  ── G1 (Scope/PRD approve) ── G2 (Tech+UX spec approve) ──
  └─/write-frontend-spec(UI Dev) → /design-test-cases(QA Analyst)
  └─/implement-feature(Dev) + /dev-api + ui-quality-gate + DS-CONFORMANCE
  └─/api-testing(QA Automation) + engineering-guardrails + atomic-data check
  ── G3 (Merge approve) ──
  └─promote-release → SIT(auto+smoke) → UAT
  ── G4 (UAT sign-off) ── G5 (Production go-live) ──
  └─prod + tag + changelog → Sentry watch → (error → new ticket)
```

> ทุก gate sync สถานะกลับ **Jira** ผ่าน `jira-sync`; dashboard อ่านจาก Jira

## 5. Documentation Standard (บังคับ — ยึด allkons)

ทุก deliverable + ticket **ต้องตาม `template-module`** เพื่อให้ "เปิด ticket แล้วอ่านเข้าใจ":

- **เอกสารต่อ module:** `prd.md` · `brd.md` · `architecture.md` · `data-model.md` · `er-diagram.mermaid` · `cr.txt`
- **เอกสารต่อ epic:** `01-epic.md` · `00-srs.md` / `00-srd.md` · `02-technical-spec.md` · `03-frontend-spec.md` · `05-test-spec.md` · (`06-automate-spec.md`) · `PERMISSION-MATRIX.md`
- **ทุกไฟล์ต้องมี:** frontmatter + Change Log + References table + Status (legend ด้านบน)
- **AC format (canonical):** ตาราง `# | Given | When | Functional | Non-functional` ต่อ 1 User Story — Functional = ผลลัพธ์ที่ผู้ใช้เห็น granular (พร้อม Thai copy verbatim), Non-functional = ผลเชิงข้อมูล/ระบบเป็นภาษาคน ("…; recorded in the audit trail")
- **CR:** `cr.txt` ตาม `CR-FORMAT.md` (`[ ]`/`[x]` + free-form, AI flip + append Resolution Summary)
- **Atomic Data mandate:** ทุก schema/dictionary/API/fixture ตาม `atomic-data-architecture.md` (Pixel·Set·Buffet)

ตัวอย่างจริงที่เขียนตามมาตรฐานนี้: `sample/buyer-wishlist/01-epic.md`

## 6. Gate Review Packet (กดเข้า ticket แล้วรีวิวได้)

แต่ละ gate วาง packet ใน Jira ticket (description/comment) ให้กดเข้าไปตัดสินใจได้ทันที:

| Gate | สิ่งที่อยู่ใน packet | ตัดสินใจ |
|---|---|---|
| G1 Scope/PRD | PRD summary + objectives + scope in/out + BR conflicts (ถ้ามี) | Approve / ส่งกลับ |
| G2 Design | `02-technical-spec` + `03-frontend-spec` (Ph1) + DS conformance | Approve / request changes |
| G3 Merge | PR diff + test/coverage + ui-quality-gate + engineering-guardrails + SIT preview | Approve merge |
| G4 UAT | UAT URL + AC coverage matrix + test-spec result | Sign-off |
| G5 Go-live | changelog + rollback + migration summary | Go-live / hold |

## 7. Roadmap

- **P1:** ยืนยัน mapping + ตั้ง Delivery Orchestrator + gate G1–G5 บน workflow เดิม
- **P2:** promote-release + env (SIT/UAT/prod) + CI gate ฝั่ง server
- **P3:** live dashboard อ่านจาก Jira + Human Action Queue + Gate Review Packet
- **P4:** production feedback loop (Sentry → ticket)
- **P5:** วัดผล (lead time, gate pass rate, defect escape) แล้ว optimize

---

*ยึดมาตรฐาน allkons เป็นหลัก — เอกสาร/ticket ทุกชิ้นที่ทีม agent สร้าง ต้องผ่านได้ถ้าเอาไปเทียบกับ `template-module`*
