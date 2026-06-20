---
name: open-pr
description: สร้าง branch + commit (Conventional Commits) + เปิด PR พร้อม checklist ผ่าน gh CLI — 1 PR ต่อ 1 atomic story
---
# open-pr
อ่าน CLAUDE.md (Git)
1. branch `<type>/<kebab>`  2. commit แบบ Conventional Commits
3. gh pr create พร้อม body: ticket link, AC, ผล quality-gate, self-verify checklist, preview URL
1 PR = 1 atomic story, <=400 บรรทัด
