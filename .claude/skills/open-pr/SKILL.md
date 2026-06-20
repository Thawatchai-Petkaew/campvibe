---
name: open-pr
description: สร้าง branch + commit (Conventional Commits) + เปิด PR base `staging` พร้อม checklist ผ่าน gh CLI — 1 PR ต่อ 1 atomic story. ใช้เมื่อ story พร้อมส่งเข้า review/merge เพื่อมุ่ง Done. ห้ามใช้ตอน promote `staging`→`main` ขึ้น prod (ใช้ /promote-release --to prod)
---
# open-pr — ปิด atomic story ด้วย branch+commit+PR เข้า `staging` (=มุ่ง Done)
อ่านก่อน: CLAUDE.md (Git) · std/ops.md (3-env, Done vs Released) · std/code.md (ขนาด PR)

## Input / preconditions
- มี ticket/story อ้างอิงได้ (Linear issue ระดับ story, มี ## Story + ## AC) — ไม่มี spec → หยุด
- โค้ดเสร็จจริง 1 atomic story (code + states + validation + self-test) ไม่มี dead code/เผื่ออนาคต
- quality-gate เขียวครบแล้ว (lint · typecheck · test+coverage ≥80% · build · audit · design gate ถ้าเป็น UI)
- มี `gh` auth แล้ว; ทำงานบน branch feature (ไม่ commit ตรงเข้า `staging`/`main`)

## วิธีทำ
1. branch `<type>/<kebab>` — `feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`
2. commit แบบ Conventional Commits (`type(scope): subject`) — โยงกลับ ticket/AC ได้
3. เปิด PR: `gh pr create --base staging` (feature → `staging` = มุ่ง **Done**)
4. PR body ใส่ครบ: ticket link · AC ที่ครอบ · ผล quality-gate · self-verify checklist · Vercel Preview URL
5. รอ CI (`.github/workflows/ci.yml`) เขียว ก่อนขอ merge (`staging`/`main` protected)

## ต้องคำนึง
- **1 PR = 1 atomic story, ≤ ~400 บรรทัด** — เกิน/หลาย story → แตก PR
- base ต้องเป็น `staging` เสมอ (ห้าม `main`) — release ขึ้น prod = PR `staging`→`main` ผ่าน `/promote-release --to prod` ไม่ใช่ skill นี้
- ห้าม secret/ค่า env หลุดใน diff/commit message
- merge เข้า `staging` ยัง **ไม่ใช่ Done** จนกว่า verify AC บน Staging URL จริง

## Output / postconditions
- 1 PR เปิดอยู่ base `staging` พร้อม body ครบ + Preview URL + CI กำลังรัน
- 1 branch + commit Conventional Commits โยง ticket ได้
- หลัง merge: auto deploy → Staging + smoke → จากนั้นจึง verify AC บน Staging URL → state `Done`

## Verify
- `gh pr view` แสดง base=`staging`, body มี ticket/AC/gate result/Preview URL ครบ
- CI เขียว · diff ≤ ~400 บรรทัด · ไม่มี secret ใน diff
- `node scripts/linear-sync.mjs audit` ผ่าน (ticket มี ## Story + ## AC)
