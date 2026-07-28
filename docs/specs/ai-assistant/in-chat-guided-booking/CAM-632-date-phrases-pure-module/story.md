---
artifact: story
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
story: date-phrases-pure-module (CAM-632)
status: In Progress (spec-lite, S — G1 folded into the G3 packet)
version: v1
updated: 2026-07-29
---

<!--
Spec-lite class (S): behaviour-preserving refactor, no schema/migration, no new API contract, single file-surface (plus a thinned sibling), expected diff well under ~150 lines of real logic (the pure module's body is a verbatim MOVE of existing lines, not new code). G1 folds into the G3 packet per ops.md Gate policy v2.
This is a refactor story, not a new-behaviour story — the "AC" table below asserts NON-behaviour-change (every existing test still passes unmodified) rather than a new user-facing outcome. There is no new UI, no new empty/loading/error/success state to design (a pure function has none of those) — the ticket exists so a FUTURE story (CAM-640+) can import date resolution into a client component.
-->

## Story
As a **Camper** (indirectly — via a future in-chat booking flow), I want the Thai date-phrase resolver (`เสาร์หน้า`, `15 ส.ค.`, `พรุ่งนี้`, `สิ้นเดือน`) to be importable from a browser component with no model turn and no server round-trip, so that typing a date phrase into an in-chat booking flow resolves instantly client-side (the actual booking UI is a separate follow-up story, CAM-640+).
Why: `lib/ai/tools/resolve-dates.ts` imports the Prisma client at module scope (`import { prisma } from '@/lib/prisma'`), which pulls in server-only code — a client component cannot import this file today even though its core (`resolveDatesCore`) is already pure and takes `holidays` as a plain parameter, never touching the DB itself.
Scope: split the existing, already-pure `resolveDatesCore` (+ every private helper it calls) out of `lib/ai/tools/resolve-dates.ts` into a new zero-server-dependency module, `lib/ai/date-phrases.ts`. The tool file is thinned to re-export the pure module's surface unchanged and keeps ONLY the DB-touching wrapper (`resolveDatesTool`, the `ThaiHoliday` lookup, the model-facing `jsonSchema`). No signature, output, or string changes anywhere. No new feature, no chat/booking UI, no holiday data delivered to the browser (that is CAM-640).
Depends on: CAM-462 (the original resolver + `ThaiHoliday` this splits) · CAM-479 (the single-weekday rule folded into the same core) · epic CAM-630 (in-chat guided booking, the consumer this unblocks)

## AC
<!-- This is a behaviour-preservation refactor: "Then" asserts NO OBSERVABLE CHANGE (same result for every input, same public import surface) rather than a new outcome. There is no user-visible Thai copy change (the resolver itself never renders copy — see CAM-462 story.md). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Any existing caller imports `resolveDatesCore`/`resolveDatesTool`/`MAX_DATE_SET_RANGES`/`DateRange`/`ThaiHolidayInput` from `@/lib/ai/tools/resolve-dates` | The module resolves (build/typecheck/test run) | No visible change to the camper — the assistant's date resolution behaves identically | Every existing import path keeps resolving; zero call-site changes required anywhere in the repo | EC-1 |
| AC-2 | The same `(text, now, holidays)` triple is given to `resolveDatesCore` before and after the split | The function runs | No visible change | Byte-identical result (same `ok`/`dates`/`interpretation`/`reason`) — the full pre-existing `cam-462`/`cam-479` unit-test suite passes with **zero edits to any existing assertion** | EC-2 |
| AC-3 | A future client component imports `lib/ai/date-phrases.ts` | The bundler/typechecker resolves the import | N/A (no UI in this story) | The imported module carries no Prisma import, no `fetch`, no React — safe for a client bundle | EC-3 |

## Rules
- BR-1 The pure module (`lib/ai/date-phrases.ts`) contains `resolveDatesCore` and every private helper it calls (date-string math, weekend/holiday-span/date-SET/single-weekday math, the `MAX_DATE_SET_RANGES` cap, the `DateRange`/`ThaiHolidayInput`/`ResolveDatesResult` types, `resolveDatesArgsSchema`) with **zero import of the Prisma client, zero `fetch`, zero React** — grep-verifiable (`grep -c "lib/prisma" lib/ai/date-phrases.ts` → 0).
- BR-2 `lib/ai/tools/resolve-dates.ts` re-exports every symbol it previously exported, unchanged in name and shape, so no existing `import … from '@/lib/ai/tools/resolve-dates'` anywhere in the repo needs to change. It keeps the Prisma import, the `isHolidayPhrase` DB-gate check, `executeResolveDates`, and the `resolveDatesTool` registration (model-facing `jsonSchema` stays here — it is part of the tool's contract, not the pure core).
- BR-3 No behaviour, signature, or string changes anywhere in the split — this is a pure move. Any test-assertion edit required to make the suite pass means behaviour moved, not just location, and is reported as blocked rather than silently "fixed".

## Edge cases
- EC-1 IF a repo-wide grep finds any import of `@/lib/ai/tools/resolve-dates` this split did not account for THEN that import must still resolve after the split (verified by the full `npm test` run, not just the two resolve-dates test files).
- EC-2 IF the `cam-462-resolve-dates.test.ts` / `cam-479-resolve-dates-weekday.test.ts` suites require an assertion change to stay green THEN stop and report it as `blocked_on` — do not edit the assertion to make it pass (that would hide a behaviour change inside a refactor story).
- EC-3 IF the new pure module is ever imported from a "use client" component THEN the bundler must not pull in the Prisma client — no dynamic/lazy Prisma import path exists in `lib/ai/date-phrases.ts` to trip this later.

## Data
- No schema/model change. `ThaiHoliday` (from CAM-462) is untouched; its lookup stays entirely inside the thinned `resolve-dates.ts` wrapper. Migration: none.

## Seams & refs
- Reuse: `lib/ai/tools/resolve-dates.ts` is the ONLY existing owner of this logic (CAM-462/CAM-479) — this story relocates it, it does not duplicate a second implementation. Consumers unaffected (no-change): `lib/ai/tools/index.ts` (imports `resolveDatesTool`), `lib/ai/tools/bulk-availability.ts` (imports `MAX_DATE_SET_RANGES`, `DateRange`) — both keep importing from `@/lib/ai/tools/resolve-dates`, which now simply re-exports from `@/lib/ai/date-phrases`.
- Refs: epic CAM-630 (in-chat guided booking) · CAM-640 (follow-up: delivering the holiday list to the browser so the client-side resolver can resolve holiday-type phrases too — explicitly out of scope here).

## Out of scope
- Delivering `ThaiHoliday` data to the browser (client-side holiday-phrase resolution needs the seeded rows client-side) → CAM-640.
- Any chat/booking UI, any new date-phrase pattern, any behaviour change → none planned in this story; a future capability story if needed.

## Self-verify
- AC-1/AC-2 → unit (the full existing `cam-462-resolve-dates.test.ts` + `cam-479-resolve-dates-weekday.test.ts` suites, unmodified, green) + repo-wide `npm test` (every consumer of the old import path still resolves).
- AC-3 → static (grep: zero Prisma-client import in the new pure module).
- Story-specific: no existing test assertion touched · `npm run lint` / `npm run typecheck` clean · `git diff origin/dev --stat` shows only the new module, the thinned tool file, and this spec.
- Gate = /quality-gate (spec-lite: G1 folds into the G3 packet) · Done = merged into `dev` with the above green on localhost.

## Changelog
- v1 (2026-07-29) — created; spec-lite (S), authored in-branch alongside the code per the dispatch contract.
