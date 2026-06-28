---
name: loading-ui-standard
description: Loading-UI standard for CampVibe — decision matrix (nothing/<100ms, delayed-spinner, skeleton, optimistic, progress+cancel), skeleton-mirrors-layout rule, section-level Suspense, a11y (aria-busy/role=status/prefers-reduced-motion), and anti-flicker. Use when designing or building any async state on a page/component. Use when choosing between skeleton, spinner, optimistic, or progress-bar for a new loading region. Do NOT use for API response-time targets (→ .claude/rules/performance.md) or token/color choices (→ DESIGN.md).
---

# Loading-UI Standard

## Overview

A wrong loader breaks trust faster than a slow page. Loading UI is a first-class design concern — choose the right loader for the wait duration, make the skeleton mirror the real layout exactly (CLS = 0), keep the chrome visible while only the async section loads, and wire a11y from the start. Every rule here is anchored on Nielsen's 0.1s/1s/10s response-time limits and NN/g's loader-pattern research.

## Quick Reference

**Decision matrix — pick one loader per loading region:**

| Wait / scenario | Loader | Show after | Source |
|---|---|---|---|
| < ~100ms | Nothing | — | NN/g: instant = no loader needed; a flash annoys |
| ~100ms–1s, unknown layout | Delayed spinner (or nothing) | ~300ms | NN/g: flow uninterrupted below 1s; delay kills flicker |
| > ~1s, route nav / known layout (list, cards, detail) | **Skeleton matching that route** | immediate | NN/g: skeleton previews structure, reduces perceived wait |
| > ~1s, isolated module/widget | Spinner | immediate | NN/g: spinners fit modules where layout context isn't needed |
| User action / form submit / button | Inline spinner on the control | immediate | Keep feedback local; never a page overlay for a button action |
| Mutation with predictable result (like, toggle, add) | **Optimistic UI** (`useOptimistic`) | immediate | Apply expected state now; reconcile/rollback on response |
| > ~10s OR determinate (upload, export, import) | **Progress bar + cancel** | immediate | NN/g/Nielsen: >10s needs percent-done + interrupt path |
| Background refetch over already-shown data | Subtle inline indicator | — | Never blank content the user is already reading |

**Section-level vs full-page — the default rule:**

> DEFAULT = section-level. Render the static chrome (navbar/layout) instantly. Wrap ONLY the async section in `<Suspense fallback={<SectionSkeleton/>}>`. Use a full-page `loading.tsx` skeleton ONLY for a true cold-load/navigation where the whole route is async.

**Anti-flicker (context-dependent):** Suspense fallbacks → delay-before-show via `loading-delay` CSS utility (~300ms); min-display N/A. Client-fetch skeletons → both delay + min-display via `useMinimumLoading` hook.

**a11y pair:** `aria-busy="true"` on the region + `role="status" aria-live="polite"` with a text label (`กำลังโหลด…`).

## When to Use

- Designing or reviewing any async state on a page or component.
- Choosing between skeleton, spinner, optimistic UI, or progress bar for a new loading region.
- Building a per-route `loading.tsx` or a `<Suspense>` boundary in the App Router.
- Running the loading check at the Design Gate before a PR merges.

**NOT for:**

- API response-time targets (p95 < 200ms) — see `.claude/rules/performance.md`.
- Token/color choices for skeleton or spinner — see `DESIGN.md` §2 (use `muted` for skeleton fill).
- Defining the data-fetch strategy or Suspense architecture — see `.claude/rules/architecture.md`.
- Writing tests for loading states — see `.claude/rules/qa.md`.

## Prerequisites

Read first: this file · `DESIGN.md` §5 (8 states — loading is required) · `DESIGN.md` §6 (Design Gate — loading check is a gate item) · the research synthesis at `.claude/plans/hover-stage-of-imperative-stearns-agent-aa98cc7940b1462be.md`. Know: Next.js App Router `loading.js` file convention, `<Suspense>`, `useOptimistic`.

## Standards

### 1. Decision matrix (mandatory — pick before building)

Apply the Quick Reference matrix above before touching code. One loading region = one loader. Never stack multiple loaders on the same region (nested/duplicate loaders block).

### 2. Skeleton mirrors the real layout (load-bearing rule)

A skeleton must be **content-aware** — it is a structural stand-in, not a gray block. NN/g explicitly discourages "frame-only" skeletons because they don't convey page structure.

Requirements:

- **Exact dimensions** — same `w-*`/`h-*`/`aspect-*` per element so real content arrives with zero layout shift (CLS = 0). Use `next/image` with explicit width/height behind the skeleton.
- **Match shape** — `rounded-full` for avatars, `aspect-video` for media, line-height-sized `<Skeleton>` bars for text rows, button-sized blocks for buttons.
- **Match count** — same number of card placeholders the grid will show (first viewport / page size), not 1.
- **Match container + grid + spacing** — same `max-w-*`, same `grid md:grid-cols-2 lg:grid-cols-3`, same `gap-*`/`py-*`/`mb-*` as the real layout.
- **Build by swapping content in the real component shell** — reuse the wrapper component; swap content elements for `<Skeleton/>`. This guarantees the skeleton cannot drift from the layout (structural coupling).

### 3. Section-level Suspense — default; full-page only for true cold-load

**Default:** render the static chrome (navbar, header, footer, layout) instantly. Wrap only the async section in its own `<Suspense fallback={<SectionSkeleton/>}>`. Move data fetches to the component that needs them; this streams the fast shell immediately and fills slow sections independently.

**Full-page `loading.tsx`** (Next.js file convention): use only when the whole route is async on a true cold-load or navigation. Per-route, tailored to that route's layout — a camp-list skeleton for the list route, a camp-detail skeleton for the detail route.

**Full-screen canvas/map modules (e.g. `/status/map`)**: use a progress indicator only — never a skeleton. A full-screen canvas has no predictable layout to mirror, so a skeleton adds no structural preview and causes visual whiplash. Give such a route its own `loading.tsx` that renders only the progress component (e.g. `<MapProgress />`). Without a route-level `loading.tsx`, Next.js falls back to the nearest ancestor — `app/loading.tsx` = the root neutral skeleton — producing an unwanted skeleton flash before the progress bar appears. (CAM-248 LOAD-4)

**Root `app/loading.tsx`**: minimal, neutral last-resort only. Not a substitute for route-specific skeletons.

**Layout caveat**: uncached/runtime data in `layout.js` (cookies/headers/uncached fetch) will not show the `loading.js` fallback and can block navigation. Move that fetch into `page.js` or wrap it in its own `<Suspense>` (Next.js docs).

### 4. Anti-flicker — context-dependent (Suspense vs client-fetch)

Anti-flicker behaviour differs by how the component fetches. Apply the rule that matches:

**Suspense fallbacks (server async components — e.g. Home catalog grid, any `<Suspense fallback={…}>` boundary):**

- **Delay-before-show IS achievable** via CSS `animation-delay` (~300ms) on the fallback wrapper. Use the `loading-delay` / `skeleton-delay-show` utility class (defined in `app/globals.css` as a `skeleton-appear` keyframe gated inside `@media (prefers-reduced-motion: no-preference)`; immediate-show under `reduce`). Quick responses never flash a loader because the fallback fades in only after the delay elapses.
- **Min-display is NOT applicable.** React swaps the Suspense fallback the instant server data resolves; do NOT rearchitect to a client fetch just to enforce min-display. Accept the instant swap — it is correct behaviour.
- **a11y note:** the `aria-live` announcement fires immediately on Suspense (the CSS delay is visual-only). This is acceptable and good for screen-reader users.

**Client-fetch skeletons (components fetching in `useEffect` / SWR / React Query — e.g. Dashboard, Profile, Bookings):**

- **Both delay-before-show AND min-display ARE achievable.** Use the shared `useMinimumLoading(isLoading, { delay: 300, minDisplay: 400 })` hook (planned at `lib/hooks/use-minimum-loading.ts`, to be added in the rollout). The hook gates a `showSkeleton` flag: it becomes `true` only after `delay` ms of continuous loading, and stays `true` for at least `minDisplay` ms once shown — eliminating both the early-flash and the flash-and-gone.

### 5. Accessibility (mandatory — not optional)

- `aria-busy="true"` on the loading region while content loads; flip to `false` when done.
- `role="status"` + `aria-live="polite"` containing a text label: `กำลังโหลด…` (TH) / `Loading…` (EN). Polite = won't interrupt an active screen reader.
- Mark purely decorative skeleton shapes `aria-hidden="true"`. Expose meaning through the single live-region status text, not dozens of announced placeholders.
- `prefers-reduced-motion`: under reduce-motion, disable the shimmer/sweep animation. Use a static or gentle opacity placeholder. (`@media (prefers-reduced-motion: reduce)` → no keyframe animation.)
- Always pair the visual loader with a text label. Purely visual shimmer is invisible to screen readers (Adrian Roselli).

### 6. Tokens and primitives

- Skeleton fill: `bg-muted` (the `muted` token) — never a hardcoded hex or `bg-gray-*`.
- Skeleton shimmer: `animate-pulse` (Tailwind) or the shadcn `<Skeleton>` component which wraps it.
- Primitives to use: `components/ui/skeleton.tsx` (single element) · `components/ui/loading-skeleton.tsx` (composite/route-level) · `components/ui/loading-spinner.tsx` (inline/button).
- New composite skeletons (planned): `CampgroundGridSkeleton` (camp list route) · `DashboardOverviewSkeleton` (operator dashboard) — see `.claude/rules/loading.md` §3.2 pointer in DESIGN.md. Planned: `RootShellSkeleton` · `ProfileFormSkeleton` · `BookingListSkeleton` (S2–S4).

**Anti-flicker mechanism reference:**

| mechanism | file | applies to |
|---|---|---|
| `loading-delay` / `skeleton-delay-show` CSS utility | `app/globals.css` (`skeleton-appear` keyframe) | Suspense fallbacks — delay-before-show only |
| `useMinimumLoading(isLoading, { delay, minDisplay })` hook | `lib/hooks/use-minimum-loading.ts` *(to be added in rollout)* | Client-fetch skeletons — delay + min-display |

## Examples

**Correct — section-level Suspense (default):**

```tsx
// page.tsx — chrome renders instantly; only the grid is async
export default function CampsitesPage() {
  return (
    <PageLayout>
      <PageHeader title="..." />  {/* static, instant */}
      <Suspense fallback={<CampgroundGridSkeleton />}>
        <CampgroundGrid />         {/* async; suspends here only */}
      </Suspense>
    </PageLayout>
  );
}
```

**Correct — skeleton matches the real layout (grid + count + dims):**

```tsx
// CampgroundGridSkeleton — mirrors CampgroundGrid exactly
export function CampgroundGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-3xl overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Correct — a11y wiring on a loading region:**

```tsx
<div
  aria-busy={isLoading}
  aria-label={isLoading ? "กำลังโหลด…" : undefined}
>
  <div role="status" aria-live="polite" className="sr-only">
    {isLoading ? "กำลังโหลด…" : "โหลดเสร็จแล้ว"}
  </div>
  {isLoading ? <CampgroundGridSkeleton /> : <CampgroundGrid />}
</div>
```

**Wrong — full-page blank for one slow section:**

```tsx
// loading.tsx blanks the whole page while only the campground list is slow
export default function Loading() {
  return <div className="h-screen bg-background" />;  // ❌ frame-only, whole page
}
```

**Wrong — hardcoded skeleton color:**

```tsx
<Skeleton className="bg-gray-200" />  // ❌ hardcoded; use bg-muted
```

## Reference Files

- NN/g — Skeleton Screens 101: https://www.nngroup.com/articles/skeleton-screens/
- NN/g — Skeleton Screens vs Progress Bars vs Spinners (video): https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/
- NN/g — Response Time Limits (0.1s/1s/10s): https://www.nngroup.com/articles/response-times-3-important-limits/
- Next.js docs — loading.js: https://nextjs.org/docs/app/api-reference/file-conventions/loading
- Next.js docs — Streaming: https://nextjs.org/docs/app/guides/streaming
- MDN — aria-busy: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
- Adrian Roselli — More Accessible Skeletons: https://adrianroselli.com/2020/11/more-accessible-skeletons.html
- Sara Soueidan — Accessible notifications with ARIA Live Regions: https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/
- LogRocket — Skeleton loading screen design / perceived performance: https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/
- `DESIGN.md` §5/§6 — 8 states + Design Gate (loading is a required gate item)
- `.claude/rules/performance.md` — CLS budget (≤ 0.1) + image/layout idioms
- `components/ui/skeleton.tsx`, `components/ui/loading-skeleton.tsx`, `components/ui/loading-spinner.tsx`
- Research synthesis (input): `.claude/plans/hover-stage-of-imperative-stearns-agent-aa98cc7940b1462be.md`

## Next Steps

After authoring a loading state in a Design Brief, the Frontend role builds the skeleton using this standard. Before the PR merges, the Designer runs the loading check at the Design Gate (`DESIGN.md` §6). A missing or wrong loading state is a **Critical** gate violation and blocks merge.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "One global skeleton works for every route — it's consistent." | Generic skeletons match no route's layout; they fail the content-awareness rule (NN/g) and cause CLS when real content arrives. Build per-route, tailored skeletons. |
| "The skeleton shifts a bit on load — that's okay." | A skeleton that shifts on load is a CLS violation (target ≤ 0.1). Reserve exact dimensions; structural coupling via the real component shell prevents drift. |
| "I'll show a frame-only skeleton (header/footer, empty body)." | NN/g explicitly flags frame-only skeletons as failing to convey structure; users read it as broken, not loading. Content placeholders are required. |
| "A spinner is fine for this 15-second file upload." | > ~10s or determinate ops need a percent-done progress bar + cancel path (Nielsen). A bare spinner with no progress is a known source of abandonment. |
| "I'll show the skeleton immediately so users see feedback right away." | A skeleton that appears and disappears in <300ms reads as a glitch, not feedback. For Suspense fallbacks: apply delay-before-show (~300ms) via the `loading-delay` CSS utility. For client-fetch skeletons: apply both delay and min-display (~300–500ms) via `useMinimumLoading`. Do not enforce min-display on a Suspense fallback by switching to a client fetch — that is the wrong cure. |
| "The page has a loading.tsx and also a component-level Suspense and also a client spinner — more feedback is better." | Nested/competing loaders for the same fetch confuse users and indicate a design error. One boundary per loading region. |
| "No loading.tsx needed; the user will wait for the page to paint." | No fallback = blank or frozen page on slow nav (the most damaging loader failure). Always provide an instant fallback at the route or section level. |
| "The shimmer animation is purely visual, no a11y needed." | Purely visual shimmer is invisible to screen readers. Wire `aria-busy` + `role="status"` + `aria-live="polite"` + a text label; disable shimmer under `prefers-reduced-motion`. |
| "I'll use bg-gray-200 for the skeleton — it looks the same." | Hardcoded palette fails `npm run check:palette` (CI exit 1) and breaks dark mode. Use `bg-muted` (the token). |
| "The whole page is slow so I should blank the whole page." | Default = section-level. Render chrome instantly; only the slow section blanks behind its `<Suspense>`. Full-page skeleton only when the entire route has no static shell. |

## Verify (exit criteria)

- [ ] Decision matrix consulted; the correct loader is chosen for each loading region's wait duration and scenario.
- [ ] Skeleton mirrors the real layout: exact dims, matching shape/count/grid/spacing; built on the real component shell where possible.
- [ ] Section-level Suspense is the default; `loading.tsx` is used only where the entire route is async. Chrome renders instantly.
- [ ] Anti-flicker applied per context: Suspense fallback → `loading-delay` CSS utility (~300ms delay-before-show, no min-display); client-fetch skeleton → `useMinimumLoading` hook (delay + min-display ~300–500ms). No Suspense fallback rearchitected as a client fetch solely to gain min-display.
- [ ] a11y: `aria-busy` on the region, `role="status" aria-live="polite"` with `กำลังโหลด…` label, decorative shapes `aria-hidden="true"`, shimmer disabled under `prefers-reduced-motion`.
- [ ] Skeleton fill uses `bg-muted` (token only); `npm run check:palette` is green.
- [ ] Primitives used: `<Skeleton>` / `<LoadingSkeleton>` / `<LoadingSpinner>` from `components/ui/*`; no hand-rolled shimmer.
- [ ] No full-page blank for a section-level async fetch; no nested/duplicate loaders for the same region.
- [ ] Loading state is present for every interactive element with an async dependency (Design Gate §6 — "All 8 states").
- [ ] CLS ≤ 0.1 measured (or stated "not measured") after skeleton integration.
