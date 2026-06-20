---
description: เริ่ม full delivery loop จาก requirement (Discovery -> G1..G5)
---
รับ requirement: $ARGUMENTS

ทำตามบทบาท orchestrator (.claude/agents/orchestrator.md):
1. /discover ปิด gap ทุกมิติ → ถามที่ G1
2. หลัง G1 → architect+designer (G2) → frontend/backend ทีละ atomic story → qa → security → /quality-gate
3. G3 merge → /promote-release SIT(auto)->UAT(G4)->prod(G5)
ทุกขั้น /update-status sync Linear
