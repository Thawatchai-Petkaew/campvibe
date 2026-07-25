# Retro — CAM-498 Place Resolver arc (P0–P3 + follow-ups)

**Trigger:** owner request ("เปิด retro", 2026-07-25). The arc also carried real failures that gate-policy v2 requires replayed in full (not summarized) — recorded below.

**Scope of the arc (all closed/merged):**
CAM-500 de-anchor (P0) → CAM-501 place resolver (P1) → CAM-502 proximity (P2) → CAM-503 landmark (P3) → CAM-504 GEO-2 exact-vs-near → CAM-505 availability chaining → CAM-497 db:sync m2m → eval-harness fidelity fix (PR #582).

**Durable evidence:** `git log` (commits `11e7243`→`51501c7`), the per-story `story.md`/`test.md` under `docs/specs/ai-location-search/CAM-498-place-resolver/*`, the golden eval `baseline-report.md`, and the ticket history.

## Real failures replayed (the anti-rubber-stamp requirement)

1. **P0 over-correction — found by the OWNER, not by tests (CAM-500→501).** Removing the "Chiang Mai" example from the `province` param to de-anchor the model made it *drop* a user-named province: "แคมป์ริมน้ำเชียงใหม่" returned southern camps mislabeled as Chiang Mai. The static check (was the example removed? yes) passed; the model's *behavior* regressed. Caught only when the owner reproduced it by hand. → CAM-501 (mandatory place-hint + honest scope) fixed it, and every location fix since ships a `strictParams` golden case + a real-endpoint reproduction.

2. **DEF-1 Thai substring false-match (CAM-501).** The province/region substring scan matched ordinary words — `ใต้ต้นไม้`→ภาคใต้, `ตากแดด`→จ.ตาก, `เยอะเลย`→จ.เลย. QA's Prove-It (red-before-green) caught it. Fix: region requires the `ภาค` prefix; short ambiguous province names (เลย/ตาก/ตราด/น่าน/แพร่/ตรัง/ยะลา) excluded from the bare scan.

3. **DEF-2 landmark false-match (CAM-503).** The flagship term `เขาใหญ่` collided with เขา(he/she)+ใหญ่(big). QA Prove-It caught it. Fix: a camping-context guard — ambiguous landmark names resolve only when a camping marker is near the bare name.

4. **Batch-delete-before-merge recurrence (CAM-504).** The branch was deleted (local+remote) and the story marked Done in the *same batch* as a merge that was actually BLOCKED (BEHIND after CAM-497 merged first). Recovered only because the commit was still in the object store (`git push origin <sha>:refs/heads/…` → reopen → update-branch → merge). A recurrence of the "confirm ground truth before cleanup" family.

## What went well

- The de-anchor→resolver→proximity→landmark phasing let each layer prove out before the next; geo crosses province boundaries where a province filter can't.
- QA's Prove-It (red regression before the fix) caught both substring defects at the story, not in production.
- The eval-harness fidelity fix turned an invisible systematic undercount into a visible, honest number (+5.6 correctness) and revealed the true residual (tool-selection variance), rather than chasing the artifact.

## Lessons distilled → see `docs/specs/LESSONS.md` (5 rows, status `proposed`)

| # | role | mistake → better rule | provenance | destination |
|---|---|---|---|---|
| A | qa | A prompt/LLM-behavior change can pass a static diff read while behavior regresses → verify behaviorally (strictParams golden case + real-endpoint repro), never a diff read alone | CAM-500 | `.claude/rules/qa.md` |
| B | code/backend | Thai substring/lexicon matching over user text collides with common words → guard with a boundary/prefix/context marker + a red regression proving the false-match first | CAM-501/503 | `.claude/rules/code.md` |
| C | qa | An eval/test harness whose mock returns empty data makes a multi-step expected outcome unreachable → systematic false-negatives; a mock must return a chainable/reachable shape, and an unreachable expected tool is a harness defect, not a model miss | eval-harness / CAM-460 | `.claude/rules/qa.md` |
| D | devops | A Prisma data-sync copy list that names only models silently drops implicit m2m join tables (`_A_to_B`) → synced rows lose their relations; include join tables + verify by row-count | CAM-497 | `.claude/rules/ops.md` |
| E | orchestrator/devops | (strengthen the CAM-203 row) never delete a branch or mark a story Done in the same batch as its merge → gate all cleanup on a confirmed `state=MERGED` | CAM-504 | `.claude/rules/ops.md` |
