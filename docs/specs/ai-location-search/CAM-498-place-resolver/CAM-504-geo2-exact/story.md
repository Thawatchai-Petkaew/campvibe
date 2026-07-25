---
artifact: story
feature: ai-location-search
epic: CAM-498 (Place Resolver)
story: geo2-exact-province-fix (CAM-504, spec-lite/S — re-eval gap-closure fix)
version: 1
class: S (single file-surface, no schema/migration, no new contract, ~90 line diff)
---

# CAM-504 — GEO-2 fix: "ใน X" / bare province resolves EXACT, not near

## Story

As a **Camper**, I want "ในกรุงเทพ" (or just naming a province with no proximity word) to search EXACTLY that province, so that I don't get a wider "camps around Bangkok" result when I asked for camps strictly inside it.

**Scope:** fix `resolvePlace`'s bare-Bangkok detection (`place-resolver.ts`) so it fires on BOTH the proximity and exact paths (previously proximity-only, leaving an exact/bare Bangkok mention fully unresolved — no hint at all); strengthen the mandatory `province` hint (`openrouter-client.ts`) to explicitly forbid `near` as well, mirroring the symmetric wording the `near` hint already carries against `province`. **No change to `executeSearchCampsites`/`buildCampSiteWhere`** — the DB-level `province` resolution already handled bare "กรุงเทพ" correctly via its existing `contains` lookup; only the pre-pass hint was the gap.

**Depends on:** CAM-501 (Place Resolver P1, `resolvePlace` + mandatory hint), CAM-502 (P2 geo proximity, `near` param + proximity markers).

Why: golden case GEO-2 (re-eval) failed — "ในกรุงเทพ" dispatched `near="กรุงเทพ"` instead of `province="Bangkok"`. Root cause: after P2 added `near`, an un-hinted turn (the bare-Bangkok exact case had no hint at all, `{}`) let the model default to the newer `near` capability instead of the correct exact `province`.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | camper names a province with "ใน" and no proximity word | "ในกรุงเทพ" | เห็นเฉพาะลานในกรุงเทพ (ผู้ช่วยบอกว่าค้นใน "กรุงเทพ") | `resolvePlace` → `{province:"Bangkok"}`; hint forces `province="Bangkok"`, forbids `near` | EC-1 |
| AC-2 | camper names a bare province, no "ใน", no proximity word | "กรุงเทพมีลานกางเต็นท์ไหม" | เห็นเฉพาะลานในกรุงเทพ | same exact path as AC-1 | EC-1 |
| AC-3 | camper uses a proximity marker + province (GEO-1, unchanged) | "ลานกางเต็นท์ใกล้กรุงเทพ" | เห็นลานรอบกรุงเทพ เรียงใกล้→ไกล | `resolvePlace` → `{near:"กรุงเทพ"}`; hint forces `near`, forbids `province` | — |

## Rules

- **BR-1:** `isBareBangkokMention` (place-resolver.ts) is now checked UNCONDITIONALLY inside `resolvePlace` (not only when `hasProximityMarker` is true): `proximity ? {near:'กรุงเทพ'} : {province:'Bangkok'}`. A non-Bangkok province was already unaffected — its full Thai name is short enough to substring-match directly (`detectProvince`); only Bangkok's formal/casual name-length mismatch caused the original gap.
- **BR-2:** the mandatory `province` hint block (`buildPlaceHintBlock`, openrouter-client.ts) now explicitly states "do NOT set `near` for this place instead" and names the proximity markers that would be required for `near` to apply — mirrors the existing `near`-branch wording that already forbids `province`.

## Edge cases

- **EC-1:** IF the camper's message contains BOTH "กรุงเทพ" and a proximity marker (e.g. "ใกล้กรุงเทพ") THEN the proximity path wins (`near`), never the exact path — unchanged mutual-exclusivity from P1/P2.

## Data

No schema/migration. `scripts/ai-eval/golden-cases.json` gains one case (GEO-4, bare-province Bangkok, `strictParams:true`); both CAM-457 and CAM-459 fixture-size ceiling assertions bumped 59→60 (two-ceilings trap, handled).

## Seams & refs

Reuses `resolvePlace` (CAM-501) and the `near`/`province` hint pair (CAM-501/502) — no new function surface, no new tool param.

## Out of scope

Non-Bangkok bare-province precision (already correct pre-fix, per BR-1 note). Landmark near-detection (CAM-503, untouched).

## Self-verify

- `npx vitest run __tests__/cam-504-geo2.test.ts __tests__/cam-501-place-resolver.test.ts __tests__/cam-502-geo-proximity.test.ts __tests__/cam-457-eval-harness.test.ts __tests__/cam-459-answer-policy-3-zones.test.ts` → 143/143 pass.
- Full suite: 8506 passed / 2 pre-existing env-dependent failures (`delivery-client.test.ts` family — missing generated Prisma delivery client in this worktree, unrelated to this diff, confirmed via `git stash` before/after comparison).
- `npm run typecheck`: same pre-existing `@/prisma/delivery/generated/delivery-client` errors as origin/dev (confirmed via stash diff); zero new errors from this diff.
- `npm run lint`: 0 errors (265 pre-existing warnings, none in touched files).
