---
linear: CAM-457
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: CampVibe maintainer (dev-facing tooling — no Admin/Camper/Host)
artifact: tech
owner: architect
status: G2 design (architect) — proposed 2026-07-21
version: v1
updated: 2026-07-21
---
# Tech — Eval harness golden suite (CAM-457)

> Rich-contract tech artifact (G2 Technical). The harness has **no wire API and no
> schema** — the "contract" here is the internal `GoldenCase` record, the observation
> seam, and the report JSON shape. Records the six G2 decisions (each: decision +
> rationale + rejected alternative + Confirmation). No prod code, no migration.

## 0. Scope confirmation (decision 6 — up front)

- **No schema/DB/migration.** The harness reads its own golden-case fixture and writes
  two report files. Tool execution is mocked (decision 1) → **zero Prisma/DB touch at
  run time**. `prisma/schema.prisma` is untouched; `npx prisma validate` / `migrate`
  are N/A to this story.
- **No new API route.** No `app/api/*` handler is added or changed. The harness calls
  the existing exported functions `runAssistantTurn` / `runAssistantTurnFromMessages`
  directly (in-process), not over HTTP.
- **No prod-code change of any kind.** See decision 1 (observation seam holds through
  existing exported seams) and decision 2 (temperature deliberately not pinned). The
  story's Seams & refs claim (`story.md` §NO production code change) is **CONFIRMED,
  not refuted** — there is no G2 scope exception.

Confirmation: `git diff --name-only` for this story touches only `scripts/ai-eval/*`,
`__tests__/cam-tbd-eval-harness.test.ts`, `vitest.eval.config.ts`, `package.json`
(one script line), `.github/workflows/ci.yml` (one advisory job), and this spec folder
— never `lib/**`, `app/**`, or `prisma/**`.

---

## 1. Observation seam (decision 1) — CONFIRMED sufficient, no prod change

**Decision.** Observe tool calls by running the real bounded agent loop **under the
Vitest module-mock runtime** and replacing `dispatchTool` with a recording mock — the
byte-identical idiom `__tests__/cam-416-agent-loop.test.ts` already uses (BR-4). Real
model call, mocked execution:

```ts
// scripts/ai-eval/run.eval.ts (runs under vitest — see decision 4)
vi.mock('server-only', () => ({}));                 // Next-bundler-only pkg (see §1.1)
const observed: Array<{ name: string; args: unknown }> = [];
const mockDispatchTool = vi.fn(async (name: string, args: unknown) => {
  observed.push({ name, args });                    // record name+args per case
  return currentCase.seededState ?? { ok: true, data: {} }; // canned tool-result
});
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>(
    '@/lib/ai/tool-registry');
  return { ...actual, dispatchTool: (...a: unknown[]) => mockDispatchTool(...a) };
});
```

- `...actual` keeps `getRegisteredTools` / `registerTool` **real** → the model is offered
  the **identical tool schemas** (real `jsonSchema`) it sees in prod; only *execution*
  is intercepted. The eval measures prod's real tool-choice surface.
- The side-effect import `@/lib/ai/tools/index` (inside `openrouter-client.ts`) still
  registers the real tools, but their real `execute` (Prisma) is never reached — the
  mock replaces `dispatchTool` one level up (`safeDispatchTool → dispatchTool`). **Zero
  DB.**
- **Zone-A observation** = `observed` is empty after the turn → pass; any entry → fail +
  the leaked tool name is recorded (AC-3/EC-6).
- **Zone-B/C observation** = `observed` holds the ordered `{name, args}` — `args` is the
  model's parsed `tool.function.arguments` exactly as `dispatchTool` receives it (before
  any zod validation), so the report captures the model's *actual requested* params even
  when they would fail prod validation. BR-2's subset-match (decision 3 scorer) decides
  pass/fail — not prod's zod. Reset `observed = []` **per case** before each replay.

**Rejected alternative — register fake recording tools over the real registry** (via
`_resetRegistryForTests()` + `registerTool` with pass-through zod). Works outside Vitest,
but: (a) forces re-deriving each real tool's `jsonSchema` to keep the model surface
identical (drift risk); (b) does not solve `server-only` (§1.1); (c) diverges from the
proven, story-cited `vi.mock` idiom. Rejected in favour of the exact CAM-416 pattern.

**Rejected alternative — add a capture hook inside `openrouter-client.ts`.** Explicitly
forbidden by the story STOP RULE and unnecessary: the loop already routes every call
through the mockable `dispatchTool` seam. Not done.

Consequence (doubt-driven note): the eval's definition of "dispatched" is *"the model
requested this tool with these args"*, intentionally looser than prod's post-zod
execution. This is correct for a golden tool-call suite (BR-2 owns correctness) but means
a call that prod would reject as `invalid_args` still counts as "dispatched wrong" here —
recorded with `reason` so it reads as a fail, never a silent pass.

### 1.1 Why the runner runs under Vitest, not plain `tsx` (load-bearing constraint)

`server-only` is **not** a standalone npm package here — it is provided by the Next
bundler (`node_modules/next/dist/compiled/server-only`) and is **unresolvable by plain
Node/tsx** (`import 'server-only'` at the top of `openrouter-client.ts` throws
`Cannot find package 'server-only'` outside Next's webpack/turbopack). Therefore the
runner **cannot** be a bare `tsx scripts/…` script. It must run inside a module-mock
runtime that can stub `server-only` — which is exactly Vitest (`vi.mock('server-only')`),
the same runtime that also provides the `dispatchTool` mock and the `@/` alias. This is
why decision 4 puts the entrypoint under a Vitest config rather than a `.mjs`/`tsx`
script like the other `scripts/*` tooling.

Confirmation: `__tests__/cam-tbd-eval-harness.test.ts` asserts (with stubbed fetch, zero
spend) that a zone-A case leaves `observed` empty and a zone-B case records the expected
`{name, args}` — proving the seam observes what the scorer needs without touching
`lib/ai/*`.

---

## 2. Determinism — temperature NOT pinned (decision 2)

**Current state (verified in code).** `callOpenRouter` builds the request body as
`{ model, messages, tools, max_tokens }` and sets `tool_choice` only for the forced-final
iteration — it sends **no `temperature`**, so prod runs at the provider default (~1.0,
sampled/non-deterministic). There is no per-call temperature seam in `CallOptions`.

**Decision.** Do **not** pin `temperature: 0` in this story. Absorb run-to-run
non-determinism via BR-3's aggregate thresholds only (tool-call correctness ≥95% over the
non-guardrail set; guardrail = 100%, authored to pass deterministically).

**Rationale.**
1. The eval's contract is "replay through the **REAL** loop." The real loop campers hit
   runs at the provider default. Pinning `temperature: 0` (greedy) would measure a config
   **prod never uses**, so the baseline would misrepresent production accuracy.
2. BR-8 already ratified threshold-absorption; 40 aggregated cases tolerate per-case
   sampling noise.
3. The only way to pin temperature without a prod change is a runner-side `fetch`
   wrapper that mutates the outgoing body — a hidden fork of the request contract that
   silently drifts if prod later adds a real temperature option. Debt, rejected.

**Rejected alternative — runner-side `vi.spyOn(global,'fetch')` body-mutation to inject
`temperature:0`.** Technically trivial under the Vitest runtime, but rejected for the
measurement-fidelity reason above (§2 rationale 1 & 3).

**Escalation path (surfaced, not taken).** IF, after the first few real baseline runs,
measured run-to-run variance is large enough to mask a real regression (e.g. the pass-rate
swings > a few points between identical runs), the correct fix is a **prod change** — add
an optional `temperature?: number` to `CallOptions`/`callOpenRouter` (defaulting to
today's behaviour) that the eval sets to `0`. That is a **separate, ratified story with
its own ADR** (it touches the prod loop), never a runner monkeypatch. Recorded here so
the option is visible; not needed to ship this story.

Confirmation: `scripts/ai-eval/run.eval.ts` sets no `temperature`; the harness unit test
asserts the outgoing request body (captured via the fetch stub) carries no `temperature`
key — a future silent injection would fail it.

---

## 3. Report artifacts (decision 3 — resolves the story 🟡)

**Decision.** Emit **both** a human markdown report and a machine-readable JSON sibling,
in the story folder:

- `docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-457-eval-harness-golden-cases-gate-assistant-changes/baseline-report.md`
- `docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-457-eval-harness-golden-cases-gate-assistant-changes/baseline-report.json`

The markdown is a **rendering of the JSON** (single source of truth = the results object;
`report.ts` renders both) so they can never disagree. The JSON is the durable, diffable
baseline every later wave-1 story re-runs against (AC-7).

**JSON shape (`baseline-report.json`):**

```jsonc
{
  "header": {
    "model": "openai/gpt-4o-mini",          // resolveModel() — the PINNED model (BR-8)
    "generatedAt": "2026-07-21T09:00:00Z",  // ISO-8601
    "gitSha": "8aff245",                     // comparability across runs
    "caseCount": 40,
    "thresholds": { "toolCallCorrectness": 0.95, "guardrail": 1.0 }
  },
  "rollups": {
    "overall": {
      "verdict": "REPORTING",                // "PASS" only when BOTH thresholds met (BR-3)
      "toolCallCorrectnessPct": 0.72,        // pass / non-guardrail-scored (zone-A no-tool counts in)
      "guardrailPassPct": 1.0,
      "counts": { "pass": 26, "fail": 9, "error": 2, "loadError": 0, "total": 40 }
    },
    "byGroup": { "P1": { "pass": 3, "fail": 1, "error": 0, "pct": 0.75 }, "P17": { "...": "..." } },
    "byZone":  { "A": { "pass": 6, "fail": 0, "pct": 1.0 },
                 "B": { "pass": 18, "fail": 8, "pct": 0.69 },
                 "C": { "pass": 2,  "fail": 1, "pct": 0.67 } }
  },
  "cases": [
    {
      "id": "P1-01", "group": "P1", "zone": "B", "guardrail": false,
      "expected": { "kind": "tool", "tool": "searchCampsites", "params": { "province": "เชียงใหม่" } },
      "actual":   { "dispatched": [ { "tool": "searchCampsites", "args": { "province": "เชียงใหม่", "petFriendly": true } } ] },
      "result": "pass",                       // pass | fail | error | load_error
      "reason": "tool + expected params matched (extra param petFriendly tolerated — subset match, BR-2)"
    }
  ]
}
```

- **Buckets are distinct** (never collapsed): `pass` / `fail` (wrong tool or missing/mismatched
  expected param, or a tool dispatched on zone-A) / `error` (model call threw/timed-out for
  that case — EC-3, kept in the denominator, not silently dropped) / `load_error` (the case
  entry was malformed — EC-1, counted + named, batch continues).
- **Verdict rule (BR-3/AC-4):** `PASS` only when `toolCallCorrectnessPct ≥ 0.95` AND
  `guardrailPassPct === 1.0`; otherwise `REPORTING` (advisory) with the shortfall listed by
  group. A single guardrail fail flips the verdict even at ≥95% tool-call correctness.

**Rejected alternative — markdown only** (the story's 🟡 default). Rejected: later wave-1
stories need a machine-diffable baseline; parsing prose to compare pass-rates is brittle.
JSON is the SoT, markdown the view.

Confirmation: `__tests__/cam-tbd-eval-harness.test.ts` feeds `report.ts` a fixed results
object and asserts the JSON header/rollups/case shape AND that the markdown renders the same
numbers (no divergence).

---

## 4. File layout + naming (decision 4)

Dev tooling → `scripts/ai-eval/` (never bundled by Next; consistent with `scripts/check-*`,
`scripts/db-*`). The REAL-model entrypoint runs under Vitest (decision 1 / §1.1) but is
**excluded from `npm test`** by extension: the default `vitest.config.ts` includes only
`**/*.test.ts`, so a `*.eval.ts` file is never picked up by the quality gate — real spend
happens ONLY when the `ai:eval` script is run explicitly.

| File (all NEW) | Role |
|---|---|
| `scripts/ai-eval/case-schema.ts` | `GoldenCase` type + zod schema (BR-1 typed record; used to validate the fixture at load). |
| `scripts/ai-eval/load-cases.ts` | Reads + zod-validates the fixture; a malformed entry → a named `load_error` collected, **never a throw** (EC-1). Pure, no `server-only`. |
| `scripts/ai-eval/score.ts` | Pure scorer: BR-2 subset param-match (+ `strictParams`), zone-A no-tool rule, BR-3 thresholds + verdict. Zero I/O → unit-tested at zero spend. |
| `scripts/ai-eval/report.ts` | Renders `baseline-report.json` + `baseline-report.md` from the results object. Pure. |
| `scripts/ai-eval/run.eval.ts` | **Entrypoint** (Vitest-run): `vi.mock('server-only')` + `dispatchTool` recording mock (decision 1); BR-7 cap pre-check; BR-5 self-skip; per-case replay via `runAssistantTurn`/`runAssistantTurnFromMessages`; real fetch; scores; writes both reports. Advisory — never fails on below-threshold. |
| `scripts/ai-eval/golden-cases.json` | The fixture. Ships with a tiny seed set so the harness runs today; populated from the owner corpus (`campvibe-conversation-to-booking-research.md` §5) when it lands. |
| `vitest.eval.config.ts` | Extends the base config (alias, env); `include: ['scripts/ai-eval/**/*.eval.ts']`; **does NOT stub `fetch`** (real model calls). |
| `__tests__/cam-tbd-eval-harness.test.ts` | The harness's OWN unit tests — STUBBED fetch (`vi.stubGlobal`, zero spend), picked up by `npm test`, proving the runner logic (AC-1..AC-7 self-verify). |

**`GoldenCase` (BR-1 + one addition):**

```ts
interface GoldenCase {
  id: string;
  group: string;                 // corpus tag: "P1" | "P17" | "F" | ...
  zone: 'A' | 'B' | 'C';
  utterance: string | TurnMessage[]; // single Thai string, OR an ordered prior-turn list (context cases)
  seededState?: unknown;         // canned tool-result the mock returns (+ any prior-turn messages)
  expected: { kind: 'tool'; tool: string; params: Record<string, unknown>; strictParams?: boolean }
          | { kind: 'no_tool' };
  guardrail?: boolean;
  auth?: boolean;                // ADDITION to BR-1: run with ctx={userId:'eval-user'} so authed-tier
                                 // getMy* tools are offered AND dispatchTool won't reject them
                                 // (unauthorized_tool). Absent/false ⇒ guest ctx={} (default, matches prod).
}
```

- Single-utterance case → `runAssistantTurn(utterance, ctx)`. Context case → build the
  `TurnMessage[]` via the real `lib/ai/build-turn-messages.ts` (prod-identical message array),
  then `runAssistantTurnFromMessages(msgs, ctx)`. `ctx` = `{ userId: 'eval-user' }` when
  `auth`, else `{}`.
- **npm script:** `"ai:eval": "vitest run --config vitest.eval.config.ts"` (namespaced like
  `check:palette` / `db:sync-from-staging`). `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
  `MAX_EVAL_CASES` read from env.

**Rejected alternative — put the harness in `lib/ai/eval/`.** `lib/` is compilable app code;
a stray `app/*` import would pull the dev-only runner (and its real-network entrypoint) into a
bundle. `scripts/` is guaranteed never bundled. Rejected in favour of `scripts/ai-eval/`.

**Rejected alternative — a plain `tsx scripts/ai-eval/run.ts` script** (like the other
`scripts/*` tooling). Impossible: `openrouter-client.ts` imports `server-only`, unresolvable
outside Next/Vitest (§1.1). Rejected → Vitest-run entrypoint.

Confirmation: `npm test` (default `vitest.config.ts`, `include: **/*.test.ts`) does NOT run
`run.eval.ts` (extension mismatch) → CI makes zero model spend; `npm run ai:eval` is the only
path that spends. The harness unit test file exercises `load-cases`/`score`/`report` green.

---

## 5. CI — advisory, on-demand, self-skipping (decision 5)

On-demand (G1 decided run-mode b) + spend discipline → **`workflow_dispatch`** (manual),
`continue-on-error: true`, **non-required** check. It must NOT run on every push (each run is
real model spend). Sketch (added to `.github/workflows/ci.yml` at build time — NOT edited by
this artifact):

```yaml
  # Advisory AI eval — MANUAL only (workflow_dispatch); real model spend, so never on push/PR.
  # continue-on-error + non-required: report-mode per ops.md §Gate v2 (advisory → clear
  # backlog to threshold → a LATER story flips to blocking; BR-6). Below-threshold NEVER blocks.
  ai-eval:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    continue-on-error: true
    env:
      OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}   # owner opt-in; unset ⇒ self-skip
      MAX_EVAL_CASES: "60"                                    # 40-case set + headroom, well under the 500 default
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm install --no-audit --no-fund
      - name: AI eval (self-skips loudly if OPENROUTER_API_KEY unset)
        run: |
          if [ -z "$OPENROUTER_API_KEY" ]; then
            echo "::notice::OPENROUTER_API_KEY not set — skipping AI eval (zero network, zero spend)."
            exit 0
          fi
          npm run ai:eval    # prints "::notice::AI eval RAN: <caseCount> cases, verdict <V>" on a real run
      - name: Upload baseline report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ai-eval-baseline-report
          path: docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-457-eval-harness-golden-cases-gate-assistant-changes/baseline-report.*
          retention-days: 30
```

- **Loud self-skip naming the var (BR-5/AC-5/EC-4):** the `::notice::` names `OPENROUTER_API_KEY`
  exactly — never a silent green. Mirrors the existing `smoke` job's named-var skip idiom.
- **First-run proof (ops.md conditional-job lesson):** a job that only ever self-skips is a
  silent no-op. Two-part proof: (a) the runner LOGIC is proven at zero spend by
  `__tests__/cam-tbd-eval-harness.test.ts` on every `npm test`; (b) "CI is wired correctly with a
  real key" is proven by ONE recorded manual `workflow_dispatch` run with the secret present — the
  run prints a distinctive `::notice::AI eval RAN: <caseCount> cases…` and uploads the artifact,
  and that first real run is recorded as an owner-verify checkbox on the ticket. Adding the
  `OPENROUTER_API_KEY` secret to CI is the owner's explicit opt-in.
- **`MAX_EVAL_CASES` guard position (BR-7/CAM-344):** the ceiling is enforced **inside
  `run.eval.ts` BEFORE the replay loop** — over the cap → refuse with a clear message and make
  **zero** model calls. CI only passes the ceiling via env; the guard itself lives in code so
  `npm run ai:eval` locally is bounded identically. This is the ONE case the eval hard-fails (a
  safety refusal), distinct from below-threshold (which stays advisory).

Confirmation: the harness unit test asserts the over-cap refusal fires with the fetch stub
**never called** (BR-7), and asserts the self-skip path makes zero `fetch` calls and prints the
named var (BR-5).

---

## Data model

No new persistent entity. The only new typed record is the dev-tooling `GoldenCase` (§4) and
the report JSON shape (§3) — neither is a Prisma model nor a wire type. `types/api.ts`,
`prisma/schema.prisma`: untouched.

## ADRs

No **new** ADR required: every decision here is dev-tooling-scoped and cheaply reversible
(rename a script, swap a report field, change the CI trigger) — none is a hard-to-reverse or
cross-module prod decision. Reference: **ADR-013** (the bounded agent loop this harness
*replays*, never re-implements). The ONE decision that *would* warrant an ADR — pinning
`temperature` in the prod loop (decision 2 escalation) — is explicitly deferred to its own
future story and would carry its own ADR then.

Confirmation: the decisions' enforcement lives in `__tests__/cam-tbd-eval-harness.test.ts` +
the `vitest.config.ts` include-mismatch (no CI spend) + the scope-confirmation `git diff`
check (§0) — not in an ADR.

## Open trade-offs (for G2 awareness)

- **Temperature variance (decision 2)** — DECIDED for this story (absorb via threshold, no
  pin). Surfaced only so the owner is aware the escalation to a prod `temperature` option is a
  known, ratified future path IF measured variance later masks regressions. Not blocking.
- **No prod-code scope exception exists** — the observation seam holds through existing exported
  seams (§1). Confirmed, not a G2 exception.

## Links

`story.md` (BR-1..BR-8, AC-1..AC-7, `## Data` 🟡 resolved here) ·
`docs/research/campvibe-ai-gap-closure-data-layer.md` §6 (eval spec), §4.2 (3-zone policy) ·
`docs/adr/ADR-013-*` (bounded loop) · `lib/ai/openrouter-client.ts` ·
`lib/ai/tool-registry.ts` · `__tests__/cam-416-agent-loop.test.ts` (cited mock idiom) ·
`.github/workflows/ci.yml` (advisory-job idioms) · `.claude/rules/ops.md` (report-mode +
conditional-job loud-skip/first-run proof).

## Changelog
- v1 (2026-07-21) — created at G2. Six decisions recorded. Key finding: `server-only` is
  Next-bundler-only → the runner must execute under Vitest (not plain tsx), which confirms
  decision 1 via the exact CAM-416 `vi.mock` idiom. No prod-code change; story seam claim
  CONFIRMED (no G2 scope exception). Story `## Data` 🟡 resolved: md report + JSON sibling.
