---
description: Start the full delivery loop from a requirement (Discovery -> G1..G5)
---
Take requirement: $ARGUMENTS

Follow the orchestrator role (.claude/agents/orchestrator.md):
1. /discover to close gaps across every dimension → ask at G1
2. After G1 → architect+designer (G2) → frontend/backend one atomic story at a time → qa → security → /quality-gate
3. G3 merge→`staging` (auto deploy + smoke = Done after verifying AC on the Staging URL) → G4 staging sign-off → /promote-release --to prod (G5 = Released: tag+changelog+rollback)
At every step run /update-status to sync Linear
