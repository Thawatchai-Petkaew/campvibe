# docs/delivery — Delivery Artifact Store

ที่เก็บ **output ของทุก workflow เป็นไฟล์** ต่อ **Feature → Epic → Story** — เขียน/ดูแลโดย agent แต่ละตัวตาม loop G1–G5, version ด้วย git + header, ผูกกับ Linear + Master Plan.

> **Source of truth split:**
> - **Linear** = live **status** (state/label/gate) — `/status` อ่านสด · **ห้าม**ถือว่าไฟล์คือสถานะ
> - **`docs/delivery/`** = durable **content** (requirement/spec/design/test/review/ship) — ไฟล์คือเนื้อหาจริง
> - **`docs/project/`** = ทิศทาง/ธุรกิจ (Master Plan) · **`docs/adr/`** = การตัดสินใจสถาปัตยกรรม · **`.claude/`** = machinery (agents/skills/rules/templates)

## โครงสร้าง
```text
docs/delivery/
├── INDEX.md                         # GENERATED จาก Linear — feature→epic→story + by-persona view
└── <feature-slug>/                  # feature = Linear project (context boundary — agent โหลดเฉพาะ subtree นี้)
    ├── feature.md                   # ภาพรวม feature + Architecture overview + Design overview + Master-Plan link
    └── <epic-slug>/
        ├── epic.md                  # requirement/KPI/scope + story rollup
        └── <CAM-id>-<story-slug>/
            ├── story.md             # STORY-TICKET + IDs (AC-n / BR-n) — PO/analyst
            ├── design.md            # designer (N/A ถ้าไม่มี UI)
            ├── test.md              # qa — AC→test matrix
            ├── review.md            # security — 6-area + verdict
            ├── delivery.md          # devops — ship record
            └── tech.md              # architect (OPTIONAL — rich API only)
```

## กติกา
- ทุกไฟล์มี YAML header (`linear`/`feature`/`epic`/`persona`/`artifact`/`owner`/`status`/`version`/`updated`) + `## Changelog`
- **DRY + traceability:** อ้าง canonical source (`.claude/rules/ux.md` validation catalog · `DESIGN.md` tokens · `docs/adr/*` · `prisma/schema.prisma`) ไม่ copy ซ้ำ; โยงข้ามไฟล์ด้วย ID `AC-n`/`BR-n`
- **requirement เปลี่ยน → กลับมาอัปเดต:** story.md (bump version + Changelog) → cascade design/tech/test → epic.md rollup → (ถ้า scope ขยับ) `docs/project/FEATURE-BACKLOG.md`/`master-plan.md` → sync Linear → regenerate INDEX
- สร้าง/ตรวจด้วย: `node scripts/linear-sync.mjs scaffold <CAM-id>` · `… index` · `… audit`
