# docs/specs — Spec & Delivery Artifact Store

ที่เก็บ **spec และ output ของทุก workflow เป็นไฟล์** ต่อ **Feature → Epic → Story** — เขียน/แก้ผ่าน **PR** (files-as-SoT), version ด้วย git + header, ผูกกับ ticket DB + Master Plan.

> **Source of truth split:**
> - **Ticket DB (self-hosted)** = live **status** (state/role/gate) — `/status` อ่านสด ผ่าน `scripts/ticket-sync.mjs` · **ห้าม**ถือว่าไฟล์คือสถานะ
> - **`docs/specs/`** = durable **content** (requirement/spec/design/test/review/ship) — **ไฟล์คือ SoT ของ story**; ticket `description` เป็นแค่สรุป 1 บรรทัด + pointer มาที่ไฟล์
> - **`docs/project/`** = ทิศทาง/ธุรกิจ (Master Plan · platform-blueprint) · **`docs/adr/`** = การตัดสินใจสถาปัตยกรรม · **`.claude/`** = machinery (agents/skills/rules/templates)

## โครงสร้าง

```text
docs/specs/
├── INDEX.md                         # GENERATED จาก ticket DB — feature→epic→story + by-persona view
└── <feature-slug>/                  # feature = lane (featureName บนบอร์ด /status)
    ├── feature.md                   # ภาพรวม feature + Appetite/No-gos + Master-Plan link
    └── <epic-slug>/
        ├── epic.md                  # requirement/KPI/scope (ไม่มี manual status rollup — สถานะดูจากบอร์ด)
        └── <CAM-id>-<story-slug>/
            ├── story.md             # template v2 (.claude/templates/story.md) — PO/analyst; ไฟล์เดียวที่ scaffold สร้างเสมอ
            ├── design.md            # designer — on-demand เฉพาะเมื่อมี UI
            ├── test.md              # qa — AC→test matrix + risk column (on-demand)
            ├── review.md            # security — 6-area + ASVS L2 IDs + verdict (on-demand)
            ├── release.md           # devops — ship record (on-demand)
            └── tech.md              # architect (OPTIONAL — rich API only, on-demand)
```

## กติกา

- **Files-as-SoT:** story.md เขียน/แก้ผ่าน PR เท่านั้น (ไม่แก้ spec ใน ticket description) · `ticket-sync.mjs audit` เช็ก**ไฟล์ก่อน** แล้วค่อย fallback ไป description เฉพาะ ticket legacy ที่เกิดก่อนระบบไฟล์ · marker `[NEEDS CLARIFICATION: …]` ค้างอยู่ = audit fail · ticket state `BACKLOG` (ก่อน DoR) ยังไม่ถูก audit
- **Spec-lite path (story ขนาด S):** ไม่มี schema/contract ใหม่ + surface เดียว + ≤~150 บรรทัด → story.md ไปกับ build PR เลย และ G1 พับรวมเข้า G3 (tap เดียว)
- **On-demand / role-driven:** role artifact (`design/test/review/release.md`, `tech.md`) สร้าง**เมื่อ role นั้นลงมือทำจริง** (copy จาก `.claude/templates/*`) — ไม่ pre-create และไม่ pad ด้วย `N/A` · story ที่ไม่มี UI ก็ไม่มี `design.md` (ถูกต้อง ไม่ใช่ "ไม่ครบ")
- ทุกไฟล์มี YAML header (`ticket`/`feature`/`epic`/`persona`/`artifact`/`owner`/`status`/`version`/`updated`) + `## Changelog`
- **DRY + traceability:** อ้าง canonical source (`.claude/rules/ux.md` validation catalog · `DESIGN.md` tokens · `docs/adr/*` · `prisma/schema.prisma`) ไม่ copy ซ้ำ; โยงข้ามไฟล์ด้วย ID `AC-n`/`BR-n`/`EC-n`
- **requirement เปลี่ยน → กลับมาอัปเดต:** story.md (bump version + Changelog) → cascade design/tech/test → (ถ้า scope ขยับ) `docs/project/product-plan.md`/`master-plan.md` → sync ticket DB → regenerate INDEX
- สร้าง/ตรวจด้วย: `node scripts/ticket-sync.mjs scaffold <CAM-id>` · `… index` · `… audit`
