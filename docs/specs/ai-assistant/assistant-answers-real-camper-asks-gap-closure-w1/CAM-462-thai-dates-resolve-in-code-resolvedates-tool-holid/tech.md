---
linear: CAM-462
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: In Progress — G2 design (architect)
version: v1
updated: 2026-07-24
---
# Tech — Thai dates: resolveDates tool + ThaiHoliday table (CAM-462)

> ONE new deterministic read-only tool (`resolveDates`, guest tier) + ONE new
> reference table (`ThaiHoliday`, seeded) + ONE prompt-line swap (BR-6). No
> change to any existing tool contract, no change to `ToolContext`, no schema
> change to any existing model. Six G2 decisions below; all reversible/additive.

## D1 — resolveDates delivery: model-called TOOL (confirm PO), not server pre-parse
**Decision:** a model-called **tool**, guest tier, registered alongside the existing read-only tools (`lib/ai/tools/index.ts`), mirroring `checkAvailabilityTool` exactly. The tool is deterministic-by-construction: its `execute` runs **no LLM**. Two layers:
- **Pure core** `resolveDatesCore(text, now, holidays): ResolveResult` — no clock, no DB, no network; fully deterministic given its 3 inputs. This is what the AC-1..AC-6 unit tests call with an INJECTED `now` + a fixed `ThaiHoliday` fixture array (Self-verify).
- **Tool wrapper** `resolveDatesTool.execute(args)` — reads today from the server wall-clock (pinned Asia/Bangkok, D3), does the ONE read-only holiday fetch when the phrase is holiday-type (`prisma.thaiHoliday.findMany`), and hands both to the core. Lives in `lib/ai/tools/resolve-dates.ts` (tool + core co-located, same file convention as `check-availability.ts`).

**Anti-spoof (server-injected today):** the model-facing `jsonSchema` exposes **only** `{ text }`. `today`/`tz` from BR-1 are internal params of the pure core (testability + default), **never** in the zod `parameters` or `jsonSchema` → the model literally cannot pass a `today`, so it can never spoof the date. `today` is computed server-side the SAME way the CAM-408 prompt line already computes it (`formatTodayContextLine`), so the tool's "today" and the prompt's "today" always agree. This is a stronger control than adding `today` to `ToolContext`: the field simply does not exist in the model's contract (ToolContext is unchanged — D6).

**Tool contract (BR-1, discriminated union — api.md §11):**
```ts
parameters: z.object({ text: z.string().min(1) })        // ONLY field the model sees
type Range = { startDate: string /* ISO YYYY-MM-DD, inclusive check-in  */,
               endDate:   string /* ISO YYYY-MM-DD, EXCLUSIVE checkout   */ }
type ResolveResult =
  | { ok: true;  dates: Range[]; interpretation: string } // interpretation = plain gloss the model can echo, e.g. "สุดสัปดาห์นี้ 25–27 ก.ค."
  | { ok: false; reason: 'ambiguous' | 'unsupported' | 'no_match' | 'too_many' }
tier: 'guest'   // same as checkAvailability — no identity, ctx unused
```
The **`ok:false` branch IS the "unresolved" path** the dispatch prompt calls `unresolved:true` — reconciled to story canon (a single discriminant + a machine `reason`, not a second redundant flag; behavior fixed at G1). On `ok:false` the model asks the camper (BR-6) — never a fabricated date (BR-5). An empty set is never `ok:true` (BR-2): a no-match returns `{ ok:false, reason:'no_match' }`.

**Rationale:** a tool is both deterministic (no LLM in `execute`) AND model-orchestrated (the LLM decides WHEN a date phrase needs resolving, mid-conversation) — the exact composition the existing loop already uses (resolveDates → checkAvailability, sibling tools). It moves error-prone LLM date arithmetic out of the prompt (the CAM-408 defect this story fixes) while keeping the model in control of turn flow.
**Rejected:** a **server-side pre-parse** (parse every incoming message before the model turn, inject resolved dates into context). Rejected: (a) the server would have to NLP-classify which utterance in a multi-turn chat is even a date phrase — that IS an LLM job, defeating the point; (b) it breaks the model's tool-calling loop (the model can no longer decide it needs dates for a follow-up); (c) it duplicates orchestration the tool layer already owns.
**Confirmation:** `__tests__/cam-462-resolve-dates.test.ts` asserts `resolveDatesTool.jsonSchema.properties` has ONLY `text` (no `today`/`tz`) AND that AC-1..AC-6 pass against an injected `now` + fixture; the tool is present in `getRegisteredTools('guest')`.

## D2 — ThaiHoliday schema + seed
**Schema (new reference/seed table, atomic Pixels):**
```prisma
model ThaiHoliday {
  date          DateTime @id @db.Date   // [Geo/Public] holiday civil date — natural PK, date-only
  nameTh        String                   // [Public] official Thai holiday name
  isLongWeekend Boolean  @default(false) // [Public] part of a contiguous ≥3-day non-working span (BR-4)
  createdAt     DateTime @default(now())
}
```
`date @id @db.Date` = one row per calendar date, date-only (byte-identical convention to `Booking.startDate/endDate @db.Date` — no time/tz drift). Each column passes the Resolution Boundary test and carries a class; no UI-shaped columns. No FK, no relation to any existing model → isolated, reversible.

**`isLongWeekend`: STORED (confirm PO), but provably-derived + test-guarded.** Stored as a seeded boolean whose value is DERIVED at seed-authoring time by the BR-4 rule (a holiday forming a contiguous ≥3-day non-working span with adjacent weekend/holiday/in-lieu days). This is the arch §12 "cache with a derivation trail" pattern — the flag is re-derivable from the row set + weekday math, and a seed-data test re-derives it to keep it honest (below).
**Rationale (STORED over COMPUTED-at-query):** the long-weekend determination spans MULTIPLE rows + weekends + in-lieu days; computing it per `วันหยุดยาว` call means re-scanning the window and grouping contiguous non-working days on every request. Storing collapses that to one indexed filter `where isLongWeekend:true` and keeps the resolver core simple (span logic lives in the seed, not in every call). The data is stable reference data refreshed ~yearly, not per-request — the ideal materialize-at-seed case.
**Rejected:** (a) COMPUTED purely at query time — pushes contiguous-span grouping into the hot resolver path for data that changes yearly; harder to unit-test (span logic entangled with resolution). (b) STORED with NO derivation guard — an unverifiable second source of truth (arch §12 anti-pattern). We keep STORED + the guard test.

**Seed authority + data shape:** official Thai public holidays as announced by the Thai cabinet, published on the **Bank of Thailand (BOT)** financial-institution holiday calendar (BR-4), for the **current + next calendar year** incl. substitution/in-lieu days (~20–40 rows). Data file `prisma/data/thai-holidays.json` (mirrors CAM-458's `prisma/data/thailand-locations.json`), rows `{ date: "YYYY-MM-DD", nameTh, isLongWeekend }`.
**Seed location:** a new reference-data block in `prisma/seed.ts` inserted AFTER the Country/AdminArea block (~L177) and BEFORE the test-users block (~L180) — grouped with the other lookup seeds, separate from the mock-camp block. Idempotent upsert keyed on the PK:
```ts
for (const h of thaiHolidays)
  await prisma.thaiHoliday.upsert({ where: { date: new Date(h.date) },
    update: { nameTh: h.nameTh, isLongWeekend: h.isLongWeekend },
    create: { date: new Date(h.date), nameTh: h.nameTh, isLongWeekend: h.isLongWeekend } })
```

**Reversible migration sketch** (additive, no backfill, no data loss elsewhere):
```sql
-- up
CREATE TABLE "ThaiHoliday" (
  "date" DATE NOT NULL,
  "nameTh" TEXT NOT NULL,
  "isLongWeekend" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThaiHoliday_pkey" PRIMARY KEY ("date")
);
-- down
DROP TABLE "ThaiHoliday";
```
Brand-new isolated table → down = clean drop, nothing else touched. Backend generates it via `prisma migrate dev --create-only` and inspects before applying; prove up→down→up on the dev DB (Self-verify).

**Staging/prod row delivery — release-checklist item (same gotcha as CAM-458).** `migrate deploy` in `vercel-build` runs **NO seed** → the migration creates the table EMPTY on staging/prod; the ROWS need a manual seed at promote. UNLIKE CAM-458's full seed (which also injects 12 mock camps → not prod-safe), `ThaiHoliday` is **pure reference data → a targeted `thaiHoliday`-only upsert IS prod-safe**. Graceful degradation (EC-6): an unseeded table returns `{ ok:false, reason:'no_match' }` for holiday phrases (relative-day phrases still resolve) — a missed seed is a soft-fail, never a crash, but the holiday capability is dead until seeded → **must** be on the checklist.
**Confirmation:** `__tests__/cam-462-thai-holidays-data.test.ts` (pure JSON, no DB) asserts every row is a valid `YYYY-MM-DD`, unique dates, non-empty `nameTh`, covers current+next year, and that **every `isLongWeekend:true` row actually sits in a ≥3-day contiguous non-working span** (re-derives from the row set → catches a mis-flagged seed). CI (`ci.yml`) already runs `migrate deploy && tsx prisma/seed.ts` on clean Postgres → a duplicate/throw fails CI.

## D3 — Date math: deterministic Asia/Bangkok TypeScript (no LLM)
**Timezone:** reuse the `formatTodayContextLine` idiom (`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' })`) to get "today" as a Bangkok civil `YYYY-MM-DD` (do NOT re-implement tz math). Anchor that ISO date to a UTC-noon `Date`, do all day arithmetic in UTC (add-days), re-format on output → server-tz-independent and boundary-safe (AC-6/EC-2: a late-night UTC `now` that is already next-day in Bangkok resolves to the Bangkok date; Thailand has no DST so the UTC-anchored weekday is stable).
**Phrase → range dispatch (deterministic ordered rule list — keyword/regex matchers over normalized Thai text, first match wins, NO LLM):**
| Phrase (+ close variants) | Ranges |
|---|---|
| `พรุ่งนี้` / `มะรืน(นี้)` | 1: start=today+1(/+2), end(excl)=start+1 (one night) |
| `เสาร์อาทิตย์นี้` / `สุดสัปดาห์นี้` | 1: this weekend's Saturday → the following Monday (Sat+Sun nights) |
| `เสาร์อาทิตย์หน้า` / `สุดสัปดาห์หน้า` | 1: this-weekend Saturday + 7 → +Mon (EC-2 crosses month/year via add-days) |
| `วันหยุดยาว(หน้า)` | reads ThaiHoliday: NEXT `isLongWeekend` contiguous span after today → min(date)→max(date)+1 (excl) |
| `เสาร์อาทิตย์ทุกสัปดาห์ของเดือนนี้` | N: one Sat→Mon per remaining weekend in the current Bangkok month (D-cap applies) |
| `ช่วงนี้` (vague) | `{ ok:false, reason:'ambiguous' }` |
| `เมื่อวาน` / any past-resolving phrase | `{ ok:false, reason:'unsupported' }` (EC-1) |
| no rule matches | `{ ok:false, reason:'unsupported' }` (BR-5 — never guess) |
Holiday-phrase with no matching future span → `{ ok:false, reason:'no_match' }` (EC-3); unseeded table → same (EC-6). Invalid/missing injected `today` → fall back to real Bangkok now, never throw (EC-5).

**MAX_DATE_SET_RANGES = 12 — the CAM-344 pre-loop cap.** A named const co-located in `lib/ai/tools/resolve-dates.ts` (mirrors `MAX_STATUS_RANGE_NIGHTS`). For a date-SET phrase the matcher COMPUTES the range COUNT (e.g. remaining weekends in the window) and if `count > 12` returns `{ ok:false, reason:'too_many' }` **BEFORE allocating the array** (EC-4/BR-8: cap before the loop). Value rationale: ≤5 weekends/month → 12 admits up to ~2 months of weekends with headroom while hard-blocking any full-quarter/year expansion (`ทุกวันเสาร์ปีนี้` = 52 → `too_many`); lean, defensible, trivially bumpable.
> Two independent caps, no overlap: (a) **per-range night width** = the shipped `MAX_STATUS_RANGE_NIGHTS=366`, enforced DOWNSTREAM inside checkAvailability — a single resolveDates range is a weekend/long-weekend (a few nights), so it never trips it; (b) **number-of-ranges in a set** = the NEW `MAX_DATE_SET_RANGES=12`, owned here. resolveDates does not touch (a).
**Confirmation:** unit tests assert `ทุกวันเสาร์ปีนี้` → `too_many` (and never allocates >12), the AC weekday/boundary cases, and the EXCLUSIVE-checkout off-by-one (`เสาร์อาทิตย์` = Sat→Mon = 2 nights).

## D4 — Feed to availability: shape is byte-compatible (no off-by-one)
`Range { startDate, endDate(EXCLUSIVE) }` is byte-identical to `checkAvailabilityArgsSchema` `{ startDate: isoDate, endDate: isoDate }` (its `endDate` jsonSchema already reads "Stay checkout date (exclusive)"). resolveDates emits `YYYY-MM-DD` which passes check-availability's `isoDate` `new Date(...)` refine. A SINGLE range → the model passes `range.startDate`/`range.endDate` straight into checkAvailability, zero transformation, zero off-by-one (BR-3: Sat in → Mon excl = Sat+Sun nights, same as `Booking.checkOutDate`). **MULTI-range → N availability calls = CAM-465 (bulkAvailability), OUT OF SCOPE** — this story only CONFIRMS the shape is compatible so CAM-465 can iterate ranges without a mapping layer. No change to checkAvailability's contract (resolveDates is a NEW sibling tool).
**Confirmation:** a type-level + runtime test that a `resolveDates` `Range` satisfies `checkAvailabilityArgsSchema` (minus `campSiteId`) and that `เสาร์อาทิตย์` produces exactly 2 nights end-to-end.

## D5 — Eval: P3 golden cases depend on lifting the CAM-457 8-case ceiling (out of scope)
P3 temporal golden cases attach to the CAM-457 fixture `scripts/ai-eval/golden-cases.json`. `__tests__/cam-457-eval-harness.test.ts` currently pins `cases.length >= 6 && <= 8` — the **8-case ceiling**. Adding P3 cases REQUIRES bumping that `<= 8` assertion, which is **blocked on the owner 40-case corpus import** (not yet in repo) → a follow-up, NOT this story (story Out-of-scope). This story ships the CAPABILITY the P3 cases will measure; the deterministic `resolveDates` unit tests (injected `today` + fixture) carry the real coverage until the corpus lands. When it lands: raise the ceiling + add temporal rows in the same PR.
**Confirmation:** noted for the eval follow-up; no change to `golden-cases.json` or the harness ceiling in this story.

## D6 — Reversible + additive (no existing contract changes)
- ThaiHoliday migration reversible (D2: up create / down drop, isolated table, no FK, no backfill).
- `resolveDates` is a NEW additive tool — registered in `lib/ai/tools/index.ts`; NO change to `checkAvailability` / `searchCampsites` / `getCampDetail` / the personal tools, and NO change to `ToolContext` (the resolver computes today internally, D1).
- The ONLY existing-code edit is the ONE prompt line (BR-6) in `buildSystemPrompt` (`lib/ai/openrouter-client.ts` ~L308): swap "compute the absolute ISO date(s) from today's date above before calling checkAvailability" → "for any relative or holiday Thai date phrase, call resolveDates and use the ranges it returns; if resolveDates returns no result, ask the camper to specify the dates — never assume one." A prompt-string change, not a contract change. Full rollback = revert the line + drop the tool registration + `DROP TABLE "ThaiHoliday"`.
**Confirmation:** a prompt-content unit test asserts the new instruction is present and the old "compute the absolute ISO" text is gone (BR-6); typecheck proves no existing tool signature changed.

## Release checklist flag (for the release note)
> **STAGING/PROD DATA STEP — not covered by `migrate deploy`.** The `ThaiHoliday` migration creates the table EMPTY on staging/prod; rows need a manual seed at promote. Staging: `npm run seed` (additive/idempotent) or a targeted `thaiHoliday`-only upsert. **Prod: a targeted `thaiHoliday`-only upsert IS prod-safe** (pure reference data, unlike the full seed which injects mock camps) — run it at promote. Until seeded, holiday phrases return an honest "no result" (EC-6, no crash), but `วันหยุดยาว` is non-functional → the seed is required for the capability, not for stability.

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (add `ThaiHoliday`) · `prisma/seed.ts` (~L177, new block) · `prisma/data/thai-holidays.json` (new) · `lib/ai/tools/resolve-dates.ts` (new) · `lib/ai/tools/index.ts` (register) · `lib/ai/openrouter-client.ts` (BR-6 prompt line ~L308) · `lib/ai/tools/check-availability.ts` (shape ref) · `story.md`

## Changelog
- v1 (2026-07-24) — created; G2 Technical. Six decisions recorded: resolveDates as a guest-tier deterministic tool (text-only model schema, server-injected today), ThaiHoliday `date @id @db.Date` with STORED+test-guarded `isLongWeekend`, deterministic Asia/Bangkok date math with `MAX_DATE_SET_RANGES=12`, byte-compatible Range→checkAvailability shape, P3 eval deferred to the corpus/ceiling follow-up, all reversible/additive. No open clarification markers.
