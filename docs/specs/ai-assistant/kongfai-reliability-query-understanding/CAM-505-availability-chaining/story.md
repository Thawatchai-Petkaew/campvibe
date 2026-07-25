---
artifact: story
feature: ai-assistant
epic: CAM-? (Kongfai reliability — query understanding, gap-closure)
story: availability-chaining-reliability (CAM-505, spec-lite/S — prompt-nudge refinement)
version: 1
class: S (single file-surface — prompt text + tool descriptions only, no schema/migration, no new contract, ~30 line diff)
---

# CAM-505 — availability-chaining reliability: strengthen the resolveDates→availability nudge + tool-selection clarity

## Story

As a **Camper**, I want an availability question ("ว่างไหม" / "โล่งสุด" / "เสาร์ไหนว่าง") to always get a real availability answer, so that the assistant never stops at "let me check the dates" and leaves my question unanswered.

**Scope:** prompt-text refinement only in `buildSystemPrompt` (`lib/ai/openrouter-client.ts`) — (1) strengthens the existing CAM-477 resolveDates→availability chaining nudge into an explicit "MUST end this turn with checkAvailability or bulkAvailability" rule with named trigger words, and (2) sharpens checkAvailability-vs-bulkAvailability tool selection to cover the ONE-named-camp-but-MANY-candidate-dates case (a superlative like "เสาร์ไหน...โล่งสุด" for one camp still needs `bulkAvailability`, not `checkAvailability`, since `checkAvailability` reports only one date range per call). Also reinforces the same two points at the tool-description (JSON-schema) level on `checkAvailabilityTool`/`bulkAvailabilityTool` (description text only — no schema/logic change).

**Depends on:** CAM-462 (resolveDates tool), CAM-465 (bulkAvailability tool), CAM-477 (Theme A — the original chaining + tool-selection nudges this story strengthens).

Why: golden eval kept showing the model call `resolveDates` and stop (never chaining into an availability tool), or pick `checkAvailability` for a one-camp-many-dates superlative that needs `bulkAvailability` — P3-09, P4-12, P12-30, P17-41..45.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | camper asks about a named camp's availability over a relative/holiday date phrase | "วันหยุดยาวรอบหน้า ภูทับเบิกว่างไหม" | assistant reports real live availability, never "let me check the dates" alone | `resolveDates` → chains to `checkAvailability` with the resolved range, same turn | EC-1 |
| AC-2 | camper asks which Saturday of a named camp is freest (one camp, many candidate dates) | "เสาร์ไหนของเดือนหน้าภูชี้ฟ้าโล่งสุด" | assistant compares across the candidate Saturdays and names the freest one | `resolveDates` → `bulkAvailability` with `keyword="ภูชี้ฟ้า"` and every candidate range — never `checkAvailability` | EC-2 |
| AC-3 | camper asks an open-ended "who's free" question with no camp named | "ว่าง 2 คืนติดกันมีที่ไหนบ้างเดือนนี้" | assistant lists which camps have 2 free consecutive nights this month | `bulkAvailability` with no camp filter, every mentioned range | — |

## Rules

- **BR-1 (chaining, strengthened):** any availability/openness question (words: ว่างไหม / วันไหนว่าง / โล่งสุด / ช่วงไหนว่าง / เต็มไหม) MUST end that turn with a `checkAvailability` or `bulkAvailability` call. `resolveDates` is a date-conversion helper ONLY — never a sufficient last step by itself; once it returns ranges, the model must immediately chain into the availability tool, never stop/summarize/answer after `resolveDates` alone.
- **BR-2 (tool selection, sharpened):** `checkAvailability` = ONE named camp over ONE single date range only. `bulkAvailability` covers MANY camps, MANY dates (including alternative/conditional dates), OR a superlative over dates/camps — **even when only one camp is named** (e.g. "which Saturday is freest" for camp X still routes to `bulkAvailability` with `keyword` set to that camp's name, because `checkAvailability` cannot compare across multiple ranges in one call).
- **BR-3:** the same two rules are echoed, briefly, in `checkAvailabilityTool.description` and `bulkAvailabilityTool.description` (schema-level reinforcement, description text only).

## Edge cases

- **EC-1:** IF `resolveDates` returns `ok:false` THEN ask the camper for the dates instead of guessing — unchanged from CAM-462/477 (not weakened by this story).
- **EC-2:** IF a question names exactly one camp but spans multiple candidate dates or asks a superlative THEN `bulkAvailability` (with `keyword`) is required, not repeated `checkAvailability` calls — this is the P4-12 gap this story closes.

## Data

No schema/migration. No change to `scripts/ai-eval/golden-cases.json` — the P3-09/P4-12/P12-30/P17-* golden cases already carry the correct expected tool (verified during this story; not debatable, so nothing was silently changed). Re-running the eval harness against the strengthened prompt is the orchestrator's next step (paid-model call, out of scope for this backend dispatch).

## Seams & refs

Reuses the existing CAM-477 nudge lines in `buildSystemPrompt` (edited in place, not duplicated) and the existing `checkAvailabilityTool`/`bulkAvailabilityTool` description fields — no new tool, no new schema field, no new function surface.

## Out of scope

Re-running the golden eval against the live model (orchestrator's step, requires paid API spend). Any change to `resolveDates`, `checkAvailability`, or `bulkAvailability` execution logic. Any change to the CAM-500/501/502/503/504 place-resolution instructions (confirmed unweakened — see self-verify).

## Self-verify

- `npx vitest run __tests__/cam-457-eval-harness.test.ts __tests__/cam-416-agent-loop.test.ts __tests__/cam-462-prompt-date-tool.test.ts __tests__/cam-459-answer-policy-3-zones.test.ts __tests__/cam-460-guest-forge-security.test.ts __tests__/cam-270-openrouter-client.test.ts` → 125/125 pass.
- `grep -n "CAM-500\|CAM-501\|Never infer, guess, or default a province" lib/ai/openrouter-client.ts` — all CAM-500/501/504 place/guardrail lines present, byte-identical (only shifted line numbers from the edit above them).
- Full suite: 8506 passed / 2 failed (both `delivery-client.test.ts` family — missing generated Prisma delivery client + Turbopack symlink build error in this worktree; pre-existing/env-dependent, unrelated to this diff — none of the touched files are in the delivery/prisma surface).
- `npm run typecheck`: same pre-existing `@/prisma/delivery/generated/delivery-client` errors only; zero new errors from this diff.
- `npm run lint`: 0 errors (265 pre-existing warnings, none in the 3 touched files).
- `npm run build`: fails in this worktree with a Turbopack "Symlink node_modules is invalid, it points out of the filesystem root" error — an environment/sandbox limitation of the symlinked `node_modules` in this scratchpad worktree, not caused by this diff (the diff is prompt-text/description strings only, touches no import graph). Not independently re-verified against origin/dev in this session; flagged for the orchestrator/QA to confirm on a non-symlinked checkout.
- `git diff origin/dev --stat`: only `lib/ai/openrouter-client.ts`, `lib/ai/tools/check-availability.ts`, `lib/ai/tools/bulk-availability.ts` (+ this story.md) touched.
