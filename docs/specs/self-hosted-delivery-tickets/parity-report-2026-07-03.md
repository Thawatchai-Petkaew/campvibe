# Parity report — Linear vs delivery DB (G4 evidence)

Run: 2026-07-03 (local app @ delivery DB, after import of 282 issues + 8 comments)

| metric | linear | db |
|---|---|---|
| total issues (non-archived) | 223 | 223 |
| gates (awaiting-you) | 0 | 0 |
| released | 19 | 19 |
| byEpic / byStateType lanes | equal | equal |

Benign deltas (DB more correct than Linear):
- 11 legacy "Epic · story" tickets (CAM-12..18, 128..131): the `[role]` tag sat after the `·` prefix where the old title parser could not see it — import recovers it into `currentRole` (+5 backend, +3 devops, +1 frontend, +1 qa workload counts).
- 1 junk `role:test` label (CAM-172, _synctest artifact) dropped by enum mapping; preserved in `legacyLabels`.

E2E on the new store (staging DB, local app): CAM-283 create → start → raiseGate (Telegram fired) → approve (audit trail complete) → invalid transition correctly rejected 400 → cancel + archive. `delivery_gate_dispatch_failed` logged when GH creds absent (observability proven).
