---
linear: CAM-621
feature: platform-hardening
epic: taxonomy-ui-foundation (CAM-522)
persona: Platform
artifact: tech
owner: devops-release
status: backlog
version: v2
updated: 2026-07-28
---
# Tech — should `e2e-regression` become a blocking CI gate? (CAM-621)

## Method — measured, not reasoned (per `.claude/rules/code.md`'s lesson), same procedure both rounds

Every claim below is a real `npx playwright test --project=regression` run against a real `next dev` server (Turbopack, port 3621), a real local Postgres database, `CI=true` (forces `workers: 1`, matching the CI job), `.next` cleared before each run (forcing a genuinely cold Turbopack compile — the worst-case timing), and the database **dropped and recreated** between runs (`campvibe_e2e_cam621`, never the shared long-lived `campvibe_e2e`) — the exact method CAM-626 used and reported, re-run independently rather than trusted on its word.

## Round 1 (2026-07-28, first investigation) — summary (full detail: this ticket's original description/comments; not re-derived here)

- CI: 29 consecutive green runs at `e2e-regression` job level.
- Local, CI-faithful (fresh seed, `workers:1`), 3 runs: **2 FAILED**, both the same "duplicate-DOM" signature (`cam-540-dialog-select-dismiss.spec.ts`, `ac6-spot-lifecycle.spec.ts`).
- Conclusion at the time: an unexplained contradiction between a long CI-green streak and a majority-red local run-set. Refused to flip on either signal alone; handed the contradiction to CAM-626 rather than guess.

## Round 1 resolved — CAM-626's finding (summary; full method + numbers: `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-626-csp-under-dev/tech.md`)

- CI was accurate throughout — it gets a fresh database per run.
- The local run-set's instability traced to a DB-accumulation confound: the shared, long-lived local `campvibe_e2e` database had grown to 16 camp sites owned by the seeded host (accumulated across many past local runs on the same machine) vs. a clean seed's handful — heavier queries/renders widen an already-real timing window.
- A separate, real, bounded timing artifact also exists under `next dev`: a transient streaming `<div id="S:...">` container clears in ~200-250ms on a cold compile (Turbopack's on-demand per-route compilation, not a CSP defect — 0 CSP violations logged in every measurement).
- Against a freshly isolated database (`campvibe_e2e_cam626`), CAM-626 measured **3 consecutive full-suite runs, 82/82 PASSED every time** — including both cam-540 and ac6.
- CAM-626 recommended (but did not apply, out of its own file surface): a settle-wait on `body > div[id^="S:"]` before the DOM-count assertions in cam-540/ac6, to absorb the compile window — and explicitly left the flip decision to CAM-621's own re-measurement.

## Round 2 (this retry, 2026-07-28) — my own re-measurement, before touching anything

Isolated database: `campvibe_e2e_cam621` (verified local via `e2e/regression/db-guard.ts`'s allow-list — `localhost`), dropped (`DROP DATABASE IF EXISTS`) and recreated (`CREATE DATABASE`) immediately before EACH of the 3 runs below, then `npx prisma migrate deploy && npx tsx prisma/seed.ts`, then `.next` removed, then `npx playwright test --project=regression` with `CI=true` (`workers: 1`). Dev server on its own port (3621), never the owner's `:3000`.

```
Run 1: 83 passed, 1 failed  (1.9m)
Run 2: 84 passed            (1.9m)
Run 3: 84 passed            (1.9m)
```

(84 total specs now, up from CAM-626's 82 — the two new tests are CAM-626's own `cam-626-csp-dev-mode.spec.ts`, added after CAM-626's baseline.)

**Both cam-540-dialog-select-dismiss and ac6-spot-lifecycle — the two specs this ticket and CAM-626 already investigated — passed clean in ALL 3 runs.** CAM-626's finding on those two specifically is reconfirmed by this independent re-run.

**Run 1's failure was a THIRD, previously-unflagged spec:**

```
1) cam-598-card-location-ellipsis.spec.ts:165 › AiChatDetailCard — location + terrain
   + access + distance stay on one line at 320px (this story's fix)

   Error: combined text missing "ภูเขาและป่าเขาสูง"
   Expected substring: "ภูเขาและป่าเขาสูง"
   Received string:    "ในเมือง, เมืองนครราชสีมา, นครราชสีมา"
     at cam-598-card-location-ellipsis.spec.ts:188:60
```

The immediately-following test at the same file (390px width, same assertion) passed. This spec was already part of CAM-626's 82-test baseline (predates CAM-626 — `CAM-598` shipped earlier, see its own ticket, state `Done`) and passed clean across CAM-626's 3 runs; it simply did not trigger there and did trigger once in mine.

**Read (not yet proven by deliberate fault injection — this ticket's file surface excludes this spec, so no fix or repro campaign was run here):** `AiChatDetailCard.tsx` renders `data-testid="text--ai-chat-detail-province"` as soon as `locationParts.length > 0 || distanceText` — true immediately from the card's own `location.province`, before the async `/api/ai/camp-detail/:id` fetch resolves. Terrain (`ภูเขาและป่าเขาสูง`) and access-type text only get appended to `locationParts` after the `detail` state updates on that fetch's response. The spec's `await row.waitFor({ state: "visible" })` proves the row painted with *some* content, not that the post-fetch re-render already landed. This is the same FAMILY of gap CAM-626's Finding 2 names (next dev's compile/render latency widening a normally-invisible window) but a different concrete mechanism (a client-side async-fetch re-render race, not the RSC streaming-container artifact CAM-626 measured). Opened as **CAM-629** (watch item, single sighting, per this repo's CAM-586 convention — record on first sighting, investigate with deliberate fault injection only on recurrence).

## Decision — refused again, and why this is the right call given BR-2

My own run-set is **not clean**: 1 failure in 3 CI-faithful, isolated-DB runs. The failure is in a spec neither this ticket nor CAM-626 had named, which is actually a stronger signal than a repeat of an already-explained cause — it means the suite carries at least one more intermittent, unexplained race beyond the two already investigated. Flipping `continue-on-error` off now would make CAM-629's still-unproven mechanism a live blocker on every future PR the moment it fires again. **`continue-on-error: true` is left in place; no change to `.github/workflows/ci.yml` this retry.**

This is not "the same refusal, unchanged" — Round 1's refusal was "I cannot explain the contradiction between CI-green and local-red." Round 2's refusal is "I explained Round 1's contradiction (CAM-626), reconfirmed it against my own run, and found a NEW, different reason the suite still isn't provably clean." The bar (BR-2: any failure anywhere blocks the flip, not just a repeat of a named one) held both times, for different underlying reasons.

## Current CI green count — measured fresh, not inherited

`gh run list --workflow=ci.yml --branch=dev --limit 60 --json databaseId,createdAt` then `gh run view <id> --json jobs -q '.jobs[] | select(.name=="e2e-regression") | .conclusion'` per run, most-recent-first:

**36 consecutive `success` runs** at the `e2e-regression` job level (run `30370993879`, 2026-07-28T14:57 back through run `30319871510`, 2026-07-28T01:18), breaking at run `30319601633` (2026-07-28T01:12, `push` to `dev`) which shows `conclusion: failure` at job level. That prior failure is not investigated by this ticket (21+ hours before this retry, out of scope) — noted only so the "36" figure is traceable to a real boundary, not asserted from nowhere. This is NOT reused from Round 1's "29" — that number was itself flagged in Round 1 as measured-then, and this is a fresh count taken in this sitting (BR-1).

## Settle-wait decision (CAM-626's recommendation) — argued, not silent

**Decision: not adding it this retry.** Reasoning:
- Both cam-540 and ac6 passed 3/3 clean against the isolated DB in this round — there is no reproduced failure in either to guard against right now. Adding a wait against a condition that has not been observed to fail is exactly the future-proofing `.claude/rules/code.md` §3 rules out ("no future-proofing code" — write it when there's a real, current caller/need).
- The counter-argument (CI machines vary; a compile window that widens under load could make a newly-required check flaky on innocent PRs) is real and is exactly why CAM-629 exists as a live watch item — but the flip isn't happening this retry regardless, so there is no imminent PR-blocking risk from leaving cam-540/ac6 as-is right now.
- Revisit at the NEXT retry: if either spec starts failing on an isolated-DB run then (recurrence), treat it like CAM-555/CAM-603 — reproduce deliberately with fault injection, name the mechanism, THEN decide the settle-wait with evidence instead of pre-emptively. If they stay clean, the case for adding it stays weak.
- If a settle-wait is ever added, it MUST wait on the real condition clearing (`await expect(page.locator('body > div[id^="S:"]')).toHaveCount(0)`, bounded), never a fixed `sleep` (`.claude/rules/qa.md`).

## Required-checks list — stated for the owner to apply once a future retry's run-set is clean (not applied here; no branch-protection write made)

`quality-gate` · `ai-guardrail-gate` (both already required — unchanged) · **`e2e-regression`** (new, once flipped). Apply only with the PR queue empty (confirmed empty at the time of this retry: `gh pr list --base dev --state open` → none) — a newly-required check on an in-flight branch deadlocks the queue (`.claude/rules/ops.md`).

## Route protection / security surface

Not applicable — this retry touched no application code, only docs + ticket-DB records. `git diff --stat` for `app/`, `lib/`, `components/`, `prisma/` is empty.

## Links
`../../feature.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-626-csp-under-dev/tech.md` (the isolated-DB method + Round 1's resolution) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-603-e2e-midrun-abort/tech.md` (the CAM-555/CAM-603 "reproduce deliberately, don't guess" precedent this ticket follows for CAM-629) · CAM-629 (this retry's new watch-item finding) · CAM-586 (the single-sighting-is-a-watch-item precedent) · `.claude/rules/ops.md` (Gate policy v2 advisory-first rollout + queue-deadlock trap) · `.claude/rules/qa.md` (flaky test = defect report until root-caused).

## Changelog
- v1 (2026-07-28) — Round 1: measured 29 CI-green vs. 2/3 local-red, an unexplained contradiction; refused to flip.
- v2 (2026-07-28, this retry) — Round 2: re-ran CAM-626's isolated-DB method myself (3 runs: 83/84, 84/84, 84/84); reconfirmed CAM-626's finding on cam-540/ac6 (clean 3/3); found a new, different single-occurrence flake (cam-598-card-location-ellipsis) and opened CAM-629 as a watch item; refused the flip a second time on this new evidence; measured the current CI green streak fresh (36, not 29); argued and declined the settle-wait for this round; stated the required-checks list for whenever a future retry's run-set is actually clean. First authoring of this ticket's story.md/tech.md — Round 1's reasoning previously lived only in the ticket description/comments.
