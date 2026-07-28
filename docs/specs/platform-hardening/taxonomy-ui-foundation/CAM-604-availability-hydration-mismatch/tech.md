---
linear: CAM-604
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — the host availability screen renders twice (CAM-604)

## The literal warning, read directly (not guessed)

Reproduced locally (this story, both `next dev` cold-Turbopack and a real `next build && next start`) via a throwaway `renderToString` + `hydrateRoot` harness with react-dom 19.2.3. Verbatim:

```
A tree hydrated but some attributes of the server rendered HTML didn't match the client
properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.
...
  <div
    data-testid="cell--calendar-day-2026-07-28"
+   className="min-h-24 rounded-2xl border border-border p-2 flex flex-col gap-1 bg-background"
-   className="...bg-background ring-1 ring-p..."
  >
    <span
+     className="text-sm tabular-nums font-medium text-foreground"
-     className="text-sm tabular-nums font-bold text-primary-ink"
    >
+     28
```

This is React's OWN documented cause list, matched exactly: **"Variable input such as `Date.now()`... which changes each time it's called."**

## The divergence, named

`components/availability-calendar.tsx` (before this fix):
```ts
const today = useMemo(() => new Date(), []);
...
const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
```
Both calls to `new Date()` run once during the SERVER render and once again during the CLIENT's first (hydrating) render — two separate JS invocations in two separate processes (Node during SSR, the browser during hydrate) that agree almost always, but can disagree the instant a day/month boundary falls between them. The output that depends on `today`/`month` is: the month-label text, the two nav buttons' `disabled` bound, and each day-cell's `isToday`-driven className + day-number font weight.

This is exactly one of the ticket's own named "usual suspects" (a value unstable across the two render passes), and it is React's own documented #1 hydration-mismatch cause — confirmed by reading the actual warning, not by guessing which suspect applied.

## Why `suppressHydrationWarning`, not a value-level fix

Considered seeding `today`/`month` with a fixed, SSR-matching placeholder and only setting the real value in a `useEffect` post-mount (the "defer to client-only" pattern). Rejected: the month-label `<span>` and the nav buttons render UNCONDITIONALLY — outside the `showSkeleton` gate — so a placeholder would flash a wrong month ("January 1970") on every single load, trading a real, always-visible regression for an astronomically rare (day/month-boundary-only) one.

React's own hydration docs name exactly this situation — a value that legitimately reflects "now" and may rarely disagree between server and client — as the sanctioned use case for `suppressHydrationWarning` (their own worked example is literally `<h1>{new Date().toLocaleDateString()}</h1>`). Applied here, scoped to only the elements that read `today`/`month` (BR-1 in `story.md`): the month-label `<span>`, both nav `<Button>`s, and each day-cell's outer `<div>` + day-number `<span>`. Not applied to anything else in the component.

## Prove-It — failing red, then green (real component, real mechanism)

`__tests__/cam-604-availability-calendar-hydration.test.ts` imports the REAL `AvailabilityCalendar` (not a stand-in), wraps it in the real `LanguageProvider`, and drives a genuine `renderToString` (system time pinned to local 23:59:59.9 on a given day) → `hydrateRoot` (system time advanced to local 00:00:00.1 the next day) pass, with `console.error` captured.

Verified manually during this story (not left as a permanent toggle in the suite): with every `suppressHydrationWarning` temporarily removed from `components/availability-calendar.tsx`, the AC-2 test failed RED with the exact warning above (day cells `2026-07-28`/`2026-07-29` shown mismatching, matching the literal excerpt at the top of this file). Restoring the fix turned it GREEN. `npx vitest run __tests__/cam-604-availability-calendar-hydration.test.ts` → 3/3 pass with the fix in place.

`vi.useFakeTimers({ toFake: ["Date"] })` (not the default full-timer fake) is used deliberately — faking `setTimeout` too would stall React's own internal scheduling and the warning would never fire (found the hard way: an earlier draft using plain `vi.useFakeTimers()` produced zero captured warnings even in the unguarded case, until narrowed to `Date`-only). Local-time constructors (`new Date(2026, 6, 28, 23, 59, 59, 900)`), not UTC ISO strings, are used to pin the boundary — an earlier draft using UTC strings never actually crossed the LOCAL calendar day on this machine's timezone (UTC 23:59:59 already maps to the next local day here), producing a false "no repro" until corrected.

## The discarded first pass — checked per the ticket's scope item 3

If a hydration mismatch elsewhere forced React to discard-and-regenerate this route's subtree, any client state built during the FIRST pass would be thrown away, and effects could double-fire. Checked: `page.tsx`'s `loadData`, `AvailabilityCalendar`'s `loadMonth`, and `HostHoldsSection`'s `loadHolds` — none of the three have a monotonic requestId gate (the CAM-359 fix shape). This is a real, but NOT this-ticket's-scope, exposure: if the AC-3 finding below (a genuine double-render) ever causes these effects to double-fire with overlapping in-flight requests, a stale response could win over a fresh one, the exact CAM-359 class. **Reported, not fixed** — out of this atomic story's scope (the ticket only names the hydration divergence, not a requestId-hardening pass across three unrelated fetch effects); flagged for a follow-up ticket alongside the AC-3 finding.

## AC-3 — the dominant, separately-caused defect (reported, not fixed)

CAM-603's original finding (`getByTestId('btn--availability-add')` resolving to 2 elements, one Thai/one English) was reproduced directly in this story, repeatedly, using the SAME fault-injection method (7 saturating child-process busy-loops on a cold Turbopack/production build, mirroring CAM-603 §4.3). Investigating it fully:

1. **It is NOT the AC-1 mechanism.** A controlled A/B (identical fault injection, but never touching `localStorage`'s language key) still reproduced the duplicate — both copies showed the SAME English text (`['Add blocked dates', 'Add blocked dates']`). The language difference in CAM-603's original finding was incidental (whichever text each copy happened to carry when it rendered), not the cause.
2. **It reproduces in a real production build**, not only `next dev` — ruling out a Fast-Refresh/HMR artifact.
3. **No hydration-mismatch console.error ever fires** for this defect, in dev or prod, across every reproduction — ruling out React's text/attribute hydration-diff path as the mechanism (that path DOES log, per AC-1's literal excerpt above).
4. **The DOM ancestor chain at the moment of duplication, captured directly:**
   ```
   BUTTON_0 (correct):  BUTTON[data-testid=btn--availability-add] < DIV < DIV[data-testid=page--campsite-availability] < MAIN < DIV < DIV < BODY < HTML
   BUTTON_1 (stray):    BUTTON[data-testid=btn--availability-add] < DIV < DIV[data-testid=page--campsite-availability] < DIV#S:1 < BODY < HTML
   ```
   `<div id="S:1">` directly under `<body>` is React Flight's own internal streaming-segment container (the hidden template a streamed Suspense-boundary chunk arrives in, normally moved into place and removed by an inline coordinator `<script>`). The ENTIRE page subtree is duplicated: correctly hydrated inside `<main>`, AND stuck in the leftover streaming container.
5. **Every reproduction's console also shows, every time (regardless of whether the duplicate itself fires):** `Executing inline script violates the following Content Security Policy directive 'script-src ... 'nonce-...' ...'. ... The action has been blocked.` — the app's CSP (`proxy.ts`, per-request nonce via the `x-nonce` header, `.claude/rules/security.md` CAM-203/CAM-218 lineage) is blocking an inline `<script>` that does not carry a nonce matching the response's CSP header.
6. **The Suspense boundary this streams through is `app/dashboard/loading.tsx`** — a shared ancestor for every `/dashboard/**` route (confirmed: neither `page.tsx` nor `availability-calendar.tsx` nor `host-holds-section.tsx` render their own `<Suspense>`).

**Conclusion:** the app's CSP blocks Next.js's own inline segment-relocation script for a route streamed through the `app/dashboard/loading.tsx` Suspense boundary; under CPU pressure the window this leaves the stuck streaming copy visible widens enough for it to coexist with the correctly-hydrated copy and (with a further recovery step, not fully instrumented here) self-resolve a moment later. This is a genuine, reliably-reproducible defect — but its true source (`proxy.ts` CSP nonce propagation into React's streaming-segment scripts, or the streaming/Suspense architecture itself) is shared infrastructure explicitly outside this story's file surface (`app/dashboard/campsites/[id]/availability/**` + the components it renders). Per the ticket's own instruction ("if a shared component is at fault, STOP and report rather than changing a component other screens depend on"), this is reported here, not fixed, and very likely affects OTHER `/dashboard/**` routes too (same shared Suspense boundary) — worth its own ticket, scoped to `proxy.ts`/the CSP nonce contract, owned by whoever handles security/infra.

No e2e test asserting this AC-3 behavior is shipped in the standing regression suite (see `e2e/regression/cam-604-availability-renders-once.spec.ts`'s own header comment) — a fault-injection-dependent assertion on a bug this PR cannot fix would flake under ordinary CI load, which is the exact trap `.claude/rules/qa.md` names ("a flaky test is a defect report until root-caused" — this one now is root-caused, and the root cause is out of scope here).

## Reproduction environment (for whoever picks up the follow-up)
- `next build && next start` on a spare port, real local Postgres dev DB, seeded host `hoster@campvibe.com` / camp `khao-kho-mountain-camp-6`.
- CDP is NOT sufficient alone (`Emulation.setCPUThrottlingRate` only throttles the renderer, not the separate Next.js server process) — real OS-level pressure via 7 separate `child_process.fork` busy-loop processes on this 10-core machine (matching CAM-603 §4.3's method) is what reliably widens the window.
- The duplicate self-resolves within ~1-2s; polling `getByTestId(...).all()` at ~30-40ms intervals during the pressure window is what catches it.

## Links
`../../feature.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-603-e2e-midrun-abort/tech.md` (the sibling investigation this ticket was born from) · `components/availability-calendar.tsx` · `__tests__/cam-604-availability-calendar-hydration.test.ts` · `e2e/regression/cam-604-availability-renders-once.spec.ts` · `.claude/rules/code.md` (CAM-359 requestId lesson, CAM-242 "read the state machine" lesson) · `.claude/rules/security.md` (CAM-203/CAM-218 CSP+nonce lineage) · React docs — hydrateRoot, handling different client/server content: https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content

## Changelog
- v1 (2026-07-28) — created; full investigation record (the real warning read directly, the in-surface fix + Prove-It, and the separate out-of-surface CSP/streaming defect found under fault injection, reported with DOM-level evidence).
